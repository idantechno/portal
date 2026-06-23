import { Business } from '../businesses/business.entity';
import { BrandConfig, RecipientFields } from './documents.types';

const DEFAULT_PRIMARY_COLOR = '#1a1a1a';

export interface RenderContextInput {
  business: Business;
  brand: BrandConfig;
  boilerplate: Record<string, string>;
  variables: Record<string, unknown>;
  signer?: RecipientFields | null;
  signatureSvg?: string | null;
  signedAt?: Date | null;
}

/**
 * Builds the flat object Handlebars renders against. Variables from the
 * instance are spread at the top level (so the template can use `{{client_name}}`
 * directly) and grouped extras (business / brand / signer / signature) live
 * under namespaced keys to avoid collisions.
 */
export function buildRenderContext(
  input: RenderContextInput,
): Record<string, unknown> {
  const v = input.variables;
  const currency = (typeof v.currency === 'string' && v.currency) || 'ILS';
  const formatMoney = makeMoneyFormatter(currency);

  const totalAmount = Number(v.total_amount ?? 0);
  const requiresDeposit = Boolean(v.requires_deposit);
  const depositAmount = Number(v.deposit_amount ?? 0);
  const balanceAmount = requiresDeposit
    ? Math.max(0, totalAmount - depositAmount)
    : totalAmount;

  return {
    ...v,
    business: { name: input.business.name },
    brand: {
      primaryColor: input.brand.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      logoUrl: input.brand.logoUrl ?? null,
      font: input.brand.font ?? null,
    },
    boilerplate: input.boilerplate ?? {},
    start_date_formatted: formatDateHe(v.start_date),
    delivery_date_formatted: formatDateHe(v.delivery_date),
    total_formatted: formatMoney(totalAmount),
    deposit_formatted: formatMoney(depositAmount),
    balance_formatted: formatMoney(balanceAmount),
    signer: {
      fullName: input.signer?.signerFullName ?? '',
      id: input.signer?.signerId ?? '',
    },
    signature: { svg: input.signatureSvg ?? null },
    signed_at_formatted: input.signedAt
      ? formatDateTimeHe(input.signedAt)
      : null,
    generated_at_formatted: formatDateTimeHe(new Date()),
  };
}

function makeMoneyFormatter(currency: string): (n: number) => string {
  const fmt = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return (n: number) => fmt.format(n);
}

function formatDateHe(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('he-IL');
}

function formatDateTimeHe(d: Date): string {
  return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
