import { ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type Variant = "navy" | "gold" | "outline" | "danger" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  navy: "bg-navy text-white hover:opacity-90",
  gold: "bg-gold text-navy-dark hover:opacity-90",
  outline: "bg-white text-navy border-2 border-navy/20 hover:border-navy/40",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "bg-transparent text-navy hover:bg-navy/5",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
};

/**
 * 全画面共通のボタン。第20章・第34章に基づき常に56px以上・角丸12pxを維持する。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "navy", fullWidth, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`btn-base px-6 ${VARIANT_CLASS[variant]} ${
          fullWidth ? "w-full" : ""
        } disabled:opacity-40 disabled:pointer-events-none ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

type LinkButtonProps = {
  href: string;
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** 画面遷移用（ナビゲーションボタンなど）。見た目はButtonと統一する。 */
export function LinkButton({
  href,
  variant = "navy",
  fullWidth,
  className = "",
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`btn-base px-6 ${VARIANT_CLASS[variant]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
    >
      {children}
    </Link>
  );
}
