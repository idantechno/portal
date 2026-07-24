import { RawAnswers, UNKNOWN, answer, buildFacts } from './brief-facts';

const base: RawAnswers = {
  businessName: 'סטודיו נועה',
  businessType: 'service',
  audience: 'b2c',
  contactName: 'נועה כהן',
  phone: '050-1234567',
  email: 'noa@example.com',
  preferredChannel: 'whatsapp',
  sections: [],
};

describe('buildFacts', () => {
  it('maps answers by field id', () => {
    const facts = buildFacts({
      ...base,
      sections: [
        {
          title: 'סוג העסק',
          items: [
            {
              id: 'q1_focus',
              label: 'במה העסק שלך עוסק?',
              value: 'עיצוב פנים',
            },
            { id: 'q4_age', label: 'כמה זמן העסק קיים?', value: 'מעל 5 שנים' },
          ],
        },
      ],
    });

    expect(answer(facts, 'q1_focus')).toBe('עיצוב פנים');
    expect(facts.values.q4_age).toEqual(['over_5']);
  });

  it('falls back to the label for submissions without ids', () => {
    const facts = buildFacts({
      ...base,
      sections: [
        {
          title: 'קהל היעד',
          items: [{ label: 'מי הלקוח האידיאלי שלך?', value: 'זוגות צעירים' }],
        },
      ],
    });

    expect(answer(facts, 'q5_ideal')).toBe('זוגות צעירים');
  });

  it('splits checkbox answers back into option values, keeping אחר as free text', () => {
    const facts = buildFacts({
      ...base,
      sections: [
        {
          title: 'השיווק שלך כיום',
          items: [
            {
              id: 'q12_sources',
              label: 'מאיפה מגיעים רוב הלקוחות שלך כיום?',
              value: 'המלצות, אינסטגרם, אחר: קבוצות פייסבוק',
            },
          ],
        },
      ],
    });

    expect(facts.values.q12_sources).toEqual([
      'referrals',
      'instagram',
      '__other__:קבוצות פייסבוק',
    ]);
  });

  it('returns the explicit unknown marker for anything unanswered', () => {
    const facts = buildFacts(base);

    expect(answer(facts, 'q16_success')).toBe(UNKNOWN);
    expect(facts.missing).toContain('q16_success');
    // Promoted fields still resolve.
    expect(facts.businessName).toBe('סטודיו נועה');
    expect(answer(facts, 'businessType')).toBe('עסק שנותן שירות');
  });

  it('survives a null submission without throwing', () => {
    const facts = buildFacts(null);
    expect(facts.businessName).toBe(UNKNOWN);
    expect(answer(facts, 'q1_focus')).toBe(UNKNOWN);
  });
});
