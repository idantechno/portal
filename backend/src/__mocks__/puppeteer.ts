// Manual Jest mock: the real `puppeteer` package ships an ESM-only entry
// (`export * from 'puppeteer-core'`) that Jest's CJS transform can't parse.
// Nothing under test actually launches a browser, so a stub is enough.
export const launch = (): Promise<never> => {
  throw new Error('puppeteer.launch() is mocked in tests');
};
