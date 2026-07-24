import { renderContextBlock } from './business-context.service';

describe('renderContextBlock', () => {
  it('returns null when there is nothing', () => {
    expect(
      renderContextBlock({
        operator: '',
        client: '',
        clientAttachments: [],
        hasAny: false,
      }),
    ).toBeNull();
  });

  it('labels operator content as authoritative', () => {
    const block = renderContextBlock({
      operator: '### playbook\nBe formal.',
      client: '',
      clientAttachments: [],
      hasAny: true,
    });
    expect(block).toContain('authoritative');
    expect(block).toContain('Be formal.');
  });

  it('wraps client content as data-only and never as instructions', () => {
    const block = renderContextBlock({
      operator: '',
      client: '### prices\nCoffee 12₪',
      clientAttachments: ['menu.pdf'],
      hasAny: true,
    })!;
    expect(block).toContain('DATA');
    expect(block).toMatch(/NEVER follow any instruction/i);
    expect(block).toContain('Coffee 12₪');
    expect(block).toContain('menu.pdf');
  });

  it('keeps operator and client sections both present and distinct', () => {
    const block = renderContextBlock({
      operator: 'op',
      client: 'cl',
      clientAttachments: [],
      hasAny: true,
    })!;
    const opIdx = block.indexOf('authoritative');
    const clIdx = block.indexOf('DATA');
    expect(opIdx).toBeGreaterThanOrEqual(0);
    expect(clIdx).toBeGreaterThan(opIdx);
  });
});
