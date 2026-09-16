// Jest stub for `puppeteer`. The package ships ESM-only and Jest's CommonJS
// transform doesn't touch node_modules by default, so any spec that merely
// imports a module which imports `puppeteer` at the top level (even without
// ever launching a browser) fails to parse. Unit tests never exercise the
// real crawler, so this stub stands in via the `moduleNameMapper` entry in
// package.json's `jest` config.
export function launch(): never {
  throw new Error('puppeteer is stubbed out in unit tests');
}
