// Test-only stub. Puppeteer's package entry re-exports `puppeteer-core` as
// native ESM, which Jest's default node_modules exclusion can't parse under
// ts-jest — any spec that transitively imports website-extractor.service.ts
// (real production code, unmocked) fails with "Unexpected token 'export'".
// No current spec exercises a real browser, so this stub just needs to be
// requireable; the mapping lives in package.json's jest.moduleNameMapper.
export function launch(): never {
  throw new Error(
    'puppeteer is stubbed out in tests — see src/__mocks__/puppeteer.ts',
  );
}
