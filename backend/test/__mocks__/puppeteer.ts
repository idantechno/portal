// Jest mock: the real `puppeteer` package ships as ESM-only, which the
// CommonJS ts-jest transform can't parse. No spec exercises real browser
// launches (that's covered by `scripts/brief-smoke.ts`), so tests get this
// stub instead of the actual module.
export type Browser = unknown;
export type Page = unknown;
export const launch = jest.fn();
