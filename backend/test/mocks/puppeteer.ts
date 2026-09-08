// Stub for `puppeteer` in Jest unit tests.
//
// `puppeteer` (and its `puppeteer-core`/`@puppeteer/browsers` deps) ship a
// pure-ESM entry point that ts-jest/Jest's CommonJS transform can't parse.
// `website-extractor.service.ts` imports it transitively, which breaks any
// spec that touches the briefs module even though no unit test actually
// launches a browser. If that ever changes, this stub throws loudly instead
// of silently no-op'ing.
export function launch(): never {
  throw new Error(
    'puppeteer is stubbed in Jest unit tests (test/mocks/puppeteer.ts) — use an e2e test or a real environment to launch a browser.',
  );
}
