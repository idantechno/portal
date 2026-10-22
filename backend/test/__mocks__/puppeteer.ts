// Jest unit-test stub: puppeteer ships ESM-only and Jest's CJS transform
// can't parse it (see website-extractor.service.ts). Unit specs don't
// launch a real browser, so swap in a stub that fails loudly if one tries.
export function launch(): never {
  throw new Error('puppeteer is stubbed out in unit tests');
}
