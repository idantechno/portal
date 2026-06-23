import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSdkMcpServer, query } from '@anthropic-ai/claude-agent-sdk';

const DEFAULT_ALLOWED_BUILTIN_TOOLS = ['Read', 'Glob', 'Grep'];
const DEFAULT_MAX_TURNS = 12;

type McpServer = ReturnType<typeof createSdkMcpServer>;

export interface AgentRunInput {
  /**
   * System prompt — built by the caller. Use `string[]` form to mark a prompt
   * cache boundary via SYSTEM_PROMPT_DYNAMIC_BOUNDARY (cache-friendly static
   * prefix followed by per-run dynamic suffix).
   */
  systemPrompt: string | string[];
  /** User-facing prompt — for conversations this is the rendered history. */
  prompt: string;
  /**
   * Working directory for the agent. Used as the cwd of the SDK query AND
   * as the boundary for the built-in filesystem tools (Read/Glob/Grep).
   */
  cwd: string;
  mcpServers?: Record<string, McpServer>;
  /** Fully-qualified MCP tool names (e.g. `mcp__portal__capture_lead`). */
  allowedMcpTools?: string[];
  allowedBuiltinTools?: string[];
  model?: string;
  maxTurns?: number;
  abortController?: AbortController;
  /** Short label included in log lines so multi-agent logs are scannable. */
  runLabel?: string;
}

export interface AgentRunResult {
  finalText: string;
}

export class AgentRunError extends Error {
  constructor(
    public readonly subtype: string,
    public readonly detail?: string,
  ) {
    super(`Agent run failed (${subtype})${detail ? `: ${detail}` : ''}`);
    this.name = 'AgentRunError';
  }
}

/**
 * Generic agent executor. Wraps the Claude Agent SDK's `query()` loop with
 * the defense-in-depth path guard (no filesystem access outside cwd) and a
 * single point of logging. Knows nothing about conversations, channels, or
 * documents — callers compose those concerns above it.
 */
@Injectable()
export class AgentRunner {
  private readonly log = new Logger(AgentRunner.name);

  constructor(private readonly config: ConfigService) {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const model =
      input.model ??
      this.config.get<string>('AGENT_MODEL', 'claude-sonnet-4-6');
    const builtinTools =
      input.allowedBuiltinTools ?? DEFAULT_ALLOWED_BUILTIN_TOOLS;
    const mcpServers = input.mcpServers ?? {};
    const allowedTools = [...builtinTools, ...(input.allowedMcpTools ?? [])];
    const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS;
    const controller = input.abortController ?? new AbortController();
    const label = input.runLabel ?? 'agent';
    const cwd = input.cwd;

    // Defense in depth: cwd is not a filesystem jail. Block Read/Glob/Grep
    // calls whose path argument resolves outside cwd so a misbehaving model
    // can't reach into another tenant's files via absolute paths or `../`.
    const isPathInsideCwd = (target: string | undefined): boolean => {
      if (!target) return true;
      const resolved = path.resolve(cwd, target);
      return resolved === cwd || resolved.startsWith(cwd + path.sep);
    };

    let finalText = '';
    let apiError: { subtype: string; detail?: string } | undefined;

    const q = query({
      prompt: input.prompt,
      options: {
        cwd,
        model,
        systemPrompt: input.systemPrompt,
        tools: builtinTools,
        allowedTools,
        mcpServers,
        settingSources: [],
        persistSession: false,
        permissionMode: 'dontAsk',
        maxTurns,
        abortController: controller,
        // eslint-disable-next-line @typescript-eslint/require-await -- SDK CanUseTool type requires Promise return
        canUseTool: async (toolName, toolInput) => {
          if (builtinTools.includes(toolName)) {
            const i = toolInput;
            const candidates = [i.file_path, i.path].filter(
              (v): v is string => typeof v === 'string',
            );
            for (const target of candidates) {
              if (!isPathInsideCwd(target)) {
                return {
                  behavior: 'deny',
                  message: `Access outside the working directory is not allowed (${target})`,
                };
              }
            }
          }
          return { behavior: 'allow', updatedInput: toolInput };
        },
      },
    });

    try {
      for await (const msg of q) {
        if (msg.type === 'system' && msg.subtype === 'init') {
          this.log.debug(
            `[${label}] init: apiKeySource=${msg.apiKeySource} model=${model} cwd=${cwd}`,
          );
        } else if (
          msg.type === 'system' &&
          msg.subtype === 'permission_denied'
        ) {
          this.log.warn(`[${label}] tool denied: tool=${msg.tool_name}`);
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            finalText = msg.result;
          } else {
            apiError = {
              subtype: msg.subtype,
              detail: msg.errors?.join('; '),
            };
          }
        }
      }
    } catch (err) {
      this.log.error(`[${label}] threw: ${(err as Error).message}`);
      throw err;
    } finally {
      controller.abort();
    }

    if (apiError) {
      this.log.error(
        `[${label}] failed: subtype=${apiError.subtype} detail=${apiError.detail ?? 'n/a'}`,
      );
      throw new AgentRunError(apiError.subtype, apiError.detail);
    }

    return { finalText };
  }
}
