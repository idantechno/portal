// Jest manual mock: puppeteer ships ESM-only entry points that Jest's CJS
// transform can't parse, and unit tests never launch a real browser — they
// only need `website-extractor.service.ts` to import without crashing.
export function launch(): never {
  throw new Error(
    'puppeteer.launch() is not available in the test environment',
  );
}
