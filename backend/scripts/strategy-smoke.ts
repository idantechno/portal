/**
 * Temporary end-to-end smoke run for the strategy pipeline (no DB, no Nest).
 * Usage: npx ts-node -T scripts/strategy-smoke.ts [briefPath] [outPath]
 *
 * Feeds an approved brief's markdown straight into the drafter + renderer — the
 * same two steps the generator runs after the approval gate.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ClaudeJsonService } from '../src/briefs/claude-json.service';
import { StrategyDrafterService } from '../src/strategies/strategy-drafter.service';
import { renderStrategy } from '../src/strategies/strategy-renderer';

// .env from the repo root, parsed just enough to get the API key out.
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const config = {
  get: (key: string, def?: string) => process.env[key] ?? def,
} as never;

async function main() {
  const briefPath =
    process.argv[2] ?? 'C:\\Users\\idant\\briefs\\portal\\brief.md';
  const outPath =
    process.argv[3] ??
    path.resolve(__dirname, '../../../AppData/Local/Temp/strategy-smoke-out.md');

  if (!fs.existsSync(briefPath)) {
    console.error(`brief not found: ${briefPath}`);
    process.exit(1);
  }
  const briefMarkdown = fs.readFileSync(briefPath, 'utf8');

  const claude = new ClaudeJsonService(config);
  console.log(`configured=${claude.configured} model=${claude.model}`);
  console.log(`brief input: ${briefMarkdown.length} chars from ${briefPath}\n`);

  const drafter = new StrategyDrafterService(claude);

  const t0 = Date.now();
  const draft = await drafter.draft({ briefMarkdown });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const markdown = renderStrategy({
    draft,
    businessName: 'Portal Studio',
    generatedAt: new Date(),
    model: claude.model,
  });

  fs.writeFileSync(outPath, markdown, 'utf8');

  // Quick structural readout — did the model fill the load-bearing fields?
  console.log(`drafted in ${secs}s\n`);
  console.log('--- structural check ---');
  console.log(`proofIsBlocker      : ${draft.proofIsBlocker}`);
  console.log(`audiences           : ${draft.audiences.length}`);
  console.log(`freeGround          : ${draft.freeGround.length}`);
  console.log(`funnelStages        : ${draft.funnelStages.length}`);
  console.log(`messagePillars      : ${draft.messagePillars.length}`);
  console.log(`roadmap rows        : ${draft.roadmap.length}`);
  console.log(`metrics rows        : ${draft.metrics.length}`);
  console.log(`redLines            : ${draft.redLines.length}`);
  console.log(`removeNow           : ${draft.removeNow.length}`);
  console.log(`90-day (m1/m2/m3)   : ${draft.month1.length}/${draft.month2.length}/${draft.month3.length}`);
  console.log(`blockingDecisions   : ${draft.blockingDecisions.length}`);
  console.log(`horizon             : ${draft.horizon}`);
  console.log(`\nsituationOneLiner:\n  ${draft.situationOneLiner}`);
  console.log(`\ncentralBet:\n  ${draft.centralBet}`);
  console.log(`\nhonestEstimate:\n  ${draft.honestEstimate}`);
  console.log(`\n--- rendered ${markdown.length} chars → ${outPath} ---`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
