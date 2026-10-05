// Jest manual mock: puppeteer ships ESM-only and can't be transformed by
// ts-jest. Nothing under test actually launches a browser, so a stub import
// is enough to let the module graph load.
export const launch = () => {
  throw new Error(
    'puppeteer.launch() is not available in the test environment',
  );
};
