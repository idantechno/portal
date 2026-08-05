import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import { Icon } from "./icons";
import type { IconName } from "./icons";

function cn(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "coral"
  | "teal";
type ButtonSize = "sm" | "md" | "lg";

/* Shadows are keyed to the surface's own colour so a lifted control reads as
   *that* colour catching light, not as a grey drop shadow under it. */
const buttonVariantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300 shadow-[0_1px_2px_rgba(1,20,39,0.12),0_8px_18px_-10px_rgba(66,105,132,0.7)] hover:shadow-[0_1px_2px_rgba(1,20,39,0.12),0_12px_22px_-10px_rgba(66,105,132,0.75)]",
  secondary:
    "bg-white text-navy-800 border border-navy-100 hover:bg-cream-50 hover:border-navy-200 shadow-[0_1px_2px_rgba(1,20,39,0.05)]",
  ghost: "bg-transparent text-navy-700 hover:bg-navy-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-[0_1px_2px_rgba(1,20,39,0.12),0_8px_18px_-10px_rgba(220,38,38,0.6)]",
  coral:
    "bg-coral-400 text-white hover:bg-coral-500 shadow-[0_1px_2px_rgba(1,20,39,0.12),0_8px_18px_-10px_rgba(220,93,70,0.7)]",
  teal:
    "bg-teal-400 text-white hover:bg-teal-500 shadow-[0_1px_2px_rgba(1,20,39,0.12),0_8px_18px_-10px_rgba(53,125,120,0.6)]",
};
const buttonSizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg",
  md: "h-11 px-5 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
};
const buttonIconSize: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 18 };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading glyph. Always from the icon set — never a character or emoji. */
  icon?: IconName;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", icon, className, children, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
        "transition-[background-color,box-shadow,transform,border-color] duration-150 ease-[var(--ease-out-brand)]",
        "active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50",
        "disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none",
        buttonVariantClass[variant],
        buttonSizeClass[size],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={buttonIconSize[size]} />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export const fieldClass = cn(
  "block w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900",
  "placeholder:text-navy-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 focus:outline-none",
  "transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out-brand)]",
  "disabled:bg-cream-50 disabled:text-navy-300",
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(fieldClass, className)} {...rest} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cn(fieldClass, "min-h-24", className)} {...rest} />
));
Textarea.displayName = "Textarea";

/**
 * Native `<select>` dressed to match `Input`: same height, radius and brand
 * focus ring, with a trailing chevron from the icon set. `className` styles the
 * wrapper (layout — flex-1 / width / max-width); every other prop
 * (value/onChange/children/…) flows to the underlying select.
 */
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }
>(({ className, wrapperClassName, children, ...rest }, ref) => (
  <div className={cn("relative", wrapperClassName)}>
    <select
      ref={ref}
      className={cn(fieldClass, "h-11 cursor-pointer appearance-none pe-10", className)}
      {...rest}
    >
      {children}
    </select>
    <Icon
      name="chevron-down"
      size={18}
      className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-navy-400"
    />
  </div>
));
Select.displayName = "Select";

export function Label({
  className,
  children,
  htmlFor,
}: {
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-sm font-medium text-navy-800 mb-1.5", className)}
    >
      {children}
    </label>
  );
}

export function Card({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-navy-100/70 bg-white shadow-[var(--shadow-e1)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * The single frame every icon sits in outside of buttons and nav rows: a
 * rounded tile tinted with the surrounding accent. Using one component for
 * this is what stops icons from drifting to different sizes and paddings
 * across screens.
 */
export function IconTile({
  icon,
  size = "md",
  tone = "brand",
  style,
  className,
}: {
  icon: IconName;
  size?: "sm" | "md" | "lg";
  /** `brand` follows the per-business theme vars; the rest are fixed roles. */
  tone?: "brand" | "accent" | "secondary" | "coral" | "teal" | "neutral";
  style?: React.CSSProperties;
  className?: string;
}) {
  const box = { sm: "h-9 w-9 rounded-xl", md: "h-11 w-11 rounded-2xl", lg: "h-14 w-14 rounded-2xl" }[size];
  const glyph = { sm: 17, md: 20, lg: 25 }[size];
  const themed: Record<string, string> = {
    brand: "--brand-primary",
    accent: "--brand-accent",
    secondary: "--brand-secondary",
  };
  const fixed: Record<string, string> = {
    coral: "bg-coral-50 text-coral-500",
    teal: "bg-teal-50 text-teal-500",
    neutral: "bg-navy-50 text-navy-500",
  };
  const themeVar = themed[tone];
  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0",
        box,
        !themeVar && fixed[tone],
        className,
      )}
      style={
        themeVar
          ? {
              backgroundColor: `color-mix(in srgb, var(${themeVar}) 13%, white)`,
              color: `color-mix(in srgb, var(${themeVar}) 88%, black)`,
              ...style,
            }
          : style
      }
    >
      <Icon name={icon} size={glyph} />
    </div>
  );
}

/** Section header: optional eyebrow, a display-face title, and an action slot. */
export function SectionTitle({
  title,
  eyebrow,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-3", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow text-brand-500 mb-1">{eyebrow}</div>}
        <h2 className="font-display text-lg text-navy-900 truncate">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/**
 * The standard page masthead: an optional eyebrow, a display-face `h1`, an
 * optional subtitle, and a right-aligned action slot. Every business page top
 * goes through this so titles, spacing and RTL alignment stay identical.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow text-brand-500 mb-1">{eyebrow}</div>}
        <h1 className="font-display text-2xl md:text-3xl text-navy-900">
          {title}
        </h1>
        {subtitle && <p className="text-navy-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="ms-auto shrink-0">{action}</div>}
    </header>
  );
}

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "teal";

const badgeToneClass: Record<BadgeTone, string> = {
  neutral: "bg-navy-50 text-navy-600 ring-navy-100",
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  success: "bg-basil-100 text-basil-700 ring-basil-400/30",
  warning: "bg-peach-100 text-wood-700 ring-peach-300/50",
  danger: "bg-coral-50 text-coral-700 ring-coral-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeToneClass[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-coral-50 border border-coral-200 px-3.5 py-2.5 text-sm text-coral-700">
      <Icon name="error" size={17} className="mt-px shrink-0" />
      <span className="min-w-0">{message}</span>
    </div>
  );
}

type BannerTone = "success" | "info" | "warning" | "danger";

const bannerToneClass: Record<BannerTone, { wrap: string; icon: IconName }> = {
  success: {
    wrap: "bg-teal-50 border-teal-200 text-teal-800",
    icon: "check-circle",
  },
  info: { wrap: "bg-brand-50 border-brand-100 text-brand-700", icon: "info" },
  warning: {
    wrap: "bg-peach-100 border-peach-300/60 text-wood-700",
    icon: "warning",
  },
  danger: { wrap: "bg-coral-50 border-coral-200 text-coral-700", icon: "error" },
};

/**
 * Inline status strip (a.k.a. callout). One treatment for every "the payment
 * went through" / "the connection failed" message, tinted with brand tokens.
 */
export function Banner({
  tone,
  children,
  onDismiss,
  className,
}: {
  tone: BannerTone;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const t = bannerToneClass[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        t.wrap,
        className,
      )}
    >
      <Icon name={t.icon} size={18} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="סגור"
          className="-me-1 shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

type StatTone = "brand" | "accent" | "secondary" | "coral" | "teal" | "neutral";

/**
 * A single headline metric: label, big value, optional sub-line and an
 * `IconTile`. Optionally a link to the screen it summarises. Every dashboard
 * "number card" in the product resolves to this one component.
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  to,
  error = false,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon?: IconName;
  tone?: StatTone;
  to?: string;
  error?: boolean;
}) {
  const inner = (
    <Card
      className={cn(
        "h-full p-5",
        to &&
          "transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-out-brand)] group-hover:-translate-y-0.5 group-hover:border-navy-100 group-hover:shadow-[var(--shadow-e3)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-navy-400 mb-1">{label}</div>
          <div className="tabular truncate text-2xl font-bold text-navy-900">
            {error ? "—" : value}
          </div>
          {sub && <div className="text-[11px] text-navy-400 mt-1">{sub}</div>}
        </div>
        {icon && <IconTile icon={icon} tone={tone} />}
      </div>
    </Card>
  );
  if (to)
    return (
      <Link to={to} className="block group">
        {inner}
      </Link>
    );
  return inner;
}

/**
 * Empty state. Every "nothing here yet" panel in the product goes through this
 * so they share one icon treatment, one rhythm, and one voice.
 */
export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-10 text-center", className)}>
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-400">
        <Icon name={icon} size={24} />
      </div>
      <div className="font-display text-base text-navy-800">{title}</div>
      {text && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-navy-400">{text}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <span
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      role="status"
      aria-label="loading"
    />
  );
}
