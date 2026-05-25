import {
  ButtonHTMLAttributes,
  forwardRef,
  HTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

function cn(...parts: Array<string | undefined | false | null>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300 shadow-sm",
  secondary:
    "bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50",
  ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};
const buttonSizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed",
        buttonVariantClass[variant],
        buttonSizeClass[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        "block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm",
        "placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none",
        "disabled:bg-neutral-50 disabled:text-neutral-500",
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm",
      "placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none",
      "min-h-24",
      className,
    )}
    {...rest}
  />
));
Textarea.displayName = "Textarea";

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
      className={cn("block text-sm font-medium text-neutral-700 mb-1.5", className)}
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
        "rounded-xl border border-neutral-200 bg-white shadow-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
      {message}
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
