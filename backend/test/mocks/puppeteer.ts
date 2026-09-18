// Jest manual mock for `puppeteer`, which ships ESM-only from v22+ and can't
// be `require()`-d by Jest's CJS runtime. Nothing under unit test actually
// drives a real browser, so a stub `launch` (never called) is enough to let
// modules that import puppeteer at the top level load during tests.
export function launch(): never {
  throw new Error(
    'puppeteer.launch() is not available under Jest — mock it in the test.',
  );
}
