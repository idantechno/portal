import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

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

const buttonVariantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300 shadow-[0_8px_18px_-10px_rgba(66,105,132,0.7)]",
  secondary:
    "bg-white text-navy-900 border border-navy-100 hover:bg-cream-50 hover:border-navy-200",
  ghost: "bg-transparent text-navy-700 hover:bg-navy-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-[0_8px_18px_-10px_rgba(220,38,38,0.6)]",
  coral:
    "bg-coral-400 text-white hover:bg-coral-500 shadow-[0_8px_18px_-10px_rgba(220,93,70,0.7)]",
  teal:
    "bg-teal-400 text-white hover:bg-teal-500 shadow-[0_8px_18px_-10px_rgba(53,125,120,0.6)]",
};
const buttonSizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 disabled:cursor-not-allowed disabled:active:scale-100",
        buttonVariantClass[variant],
        buttonSizeClass[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";

const fieldClass = cn(
  "block w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900",
  "placeholder:text-navy-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 focus:outline-none",
  "transition-colors disabled:bg-cream-50 disabled:text-navy-300",
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
        "rounded-2xl border border-navy-100 bg-white shadow-[0_12px_32px_-20px_rgba(1,20,39,0.28)]",
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
    <div className="rounded-xl bg-coral-50 border border-coral-200 px-3.5 py-2.5 text-sm text-coral-700">
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
