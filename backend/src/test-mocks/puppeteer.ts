// Jest mock for the `puppeteer` package: its published build is ESM-only
// (`export * from 'puppeteer-core'`), which ts-jest can't parse when the
// real package is required transitively (e.g. via website-extractor.service.ts).
// No test here actually launches a browser, so a throwing stub is enough.
export const launch = () => {
  throw new Error('puppeteer is mocked in tests');
};
