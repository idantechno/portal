import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from '../../businesses/businesses.service';
import { FilesystemService } from '../../context-files/filesystem.service';
import { AgentRunner } from '../agent-runner.service';
import { AgentsService } from '../agents.service';
import { getAgentDefinition, isAgentKey } from '../agent-catalog';
import { buildAgentSystemPrompt } from './agent-prompts';

export interface RunAgentResult {
  agentKey: string;
  agentName: string;
  text: string;
}

/**
 * The Portal Orchestrator. The hub the architecture diagram puts at its centre:
 * it validates the business is entitled to an agent, assembles the business
 * context, and runs the agent through the shared AgentRunner. Owner-facing,
 * on-demand generation (no filesystem tools needed — these produce artifacts).
 */
@Injectable()
export class OrchestratorService {
  private readonly log = new Logger(OrchestratorService.name);

  constructor(
    private readonly runner: AgentRunner,
    private readonly agents: AgentsService,
    private readonly businesses: BusinessesService,
    private readonly fs: FilesystemService,
  ) {}

  async runAgent(
    businessId: string,
    agentKey: string,
    instruction: string,
  ): Promise<RunAgentResult> {
    if (!isAgentKey(agentKey)) {
      throw new NotFoundException(`Unknown agent: ${agentKey}`);
    }
    const def = getAgentDefinition(agentKey)!;
    const entitled = await this.agents.hasAccess(businessId, agentKey);
    if (!entitled) {
      throw new ForbiddenException(`Business lacks access to ${agentKey}`);
    }

    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundException('Business not found');

    const systemPrompt = buildAgentSystemPrompt(agentKey, {
      businessName: business.name,
      businessBrief: business.systemPromptOverride,
    });

    // Pure generation: no built-in file tools, so the cwd is only a formal
    // requirement of the SDK. Ensure it exists to avoid an ENOENT on spawn.
    await this.fs.ensureBusinessRoot(businessId);
    const cwd = this.fs.businessRoot(businessId);

    this.log.debug(`[orchestrator] running ${agentKey} for ${businessId}`);
    const { finalText } = await this.runner.run({
      systemPrompt,
      prompt: instruction,
      cwd,
      allowedBuiltinTools: [],
      maxTurns: 3,
      runLabel: `agent:${agentKey}`,
    });

    return { agentKey, agentName: def.name, text: finalText };
  }
}
