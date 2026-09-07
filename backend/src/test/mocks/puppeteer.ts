// Jest manual mock: puppeteer ships ESM-only builds that ts-jest can't
// transform, breaking any spec that transitively imports a module using
// puppeteer (see website-extractor.service.ts / pdf-renderer.service.ts).
// Nothing under test actually launches a browser, so a stub is enough.
export function launch(): Promise<never> {
  return Promise.reject(new Error('puppeteer is mocked in unit tests'));
}
