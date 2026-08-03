// Jest manual mock. The real `puppeteer` package ships an ESM-only entry point
// that ts-jest can't parse, and no spec actually exercises a real browser.
export const launch = jest.fn();
