import { RawAnswers, buildFacts } from './brief-facts';
import { detectContradictions } from './contradictions';

function factsFrom(items: Array<[string, string, string]>) {
  const sections = [
    {
      title: 'בדיקה',
      items: items.map(([id, label, value]) => ({ id, label, value })),
    },
  ];
  const answers: RawAnswers = {
    businessName: 'עסק לדוגמה',
    businessType: 'service',
    audience: 'b2c',
    contactName: 'ישראל',
    sections,
  };
  return buildFacts(answers);
}

const codes = (facts: ReturnType<typeof buildFacts>) =>
  detectContradictions(facts).map((c) => c.code);

describe('detectContradictions', () => {
  it('flags "no customers yet" ticked together with real lead sources', () => {
    const facts = factsFrom([
      [
        'q12_sources',
        'מאיפה מגיעים רוב הלקוחות שלך כיום?',
        'המלצות, עדיין אין לקוחות (בהקמה)',
      ],
    ]);
    expect(codes(facts)).toContain('sources_none_and_some');
  });

  it('flags a years-old business whose blocker is "not started yet"', () => {
    const facts = factsFrom([
      ['q4_age', 'כמה זמן העסק קיים?', 'מעל 5 שנים'],
      [
        'q28_blocker',
        'מה לדעתך היום הדבר שהכי מעכב את צמיחת העסק?',
        'עדיין לא התחלתי / בהקמה',
      ],
    ]);
    expect(codes(facts)).toContain('age_vs_not_started');
  });

  it('flags a declared budget with no size', () => {
    const facts = factsFrom([
      ['q23_has_budget', 'האם כיום יש לעסק תקציב קבוע לשיווק?', 'כן'],
    ]);
    expect(codes(facts)).toContain('budget_yes_no_size');
  });

  it('flags a luxury + affordable positioning', () => {
    const facts = factsFrom([
      [
        'q31_describe',
        'איך היית רוצה שלקוחות יתארו את העסק שלך?',
        'יוקרתי, משתלם',
      ],
    ]);
    expect(codes(facts)).toContain('luxury_vs_affordable');
  });

  it('stays quiet on a coherent submission', () => {
    const facts = factsFrom([
      ['q4_age', 'כמה זמן העסק קיים?', '1–3 שנים'],
      ['q12_sources', 'מאיפה מגיעים רוב הלקוחות שלך כיום?', 'המלצות'],
      ['q30_assets', 'אילו נכסים דיגיטליים כבר קיימים לעסק?', 'אתר'],
      ['q23_has_budget', 'האם כיום יש לעסק תקציב קבוע לשיווק?', 'לא'],
      ['q26_paid', 'האם אתה פתוח לשיווק ממומן?', 'כן'],
    ]);
    expect(detectContradictions(facts)).toEqual([]);
  });
});
