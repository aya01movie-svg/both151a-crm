import { InputHTMLAttributes, forwardRef } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

/**
 * ラベル付きテキスト入力。タブレットでの操作性を優先し、
 * 高さ・文字サイズを大きめに固定する。
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, id, className = "", ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <label htmlFor={inputId} className="block">
        <span className="block text-sm font-bold text-navy/70 mb-1.5">
          {label}
        </span>
        <input
          ref={ref}
          id={inputId}
          className={`w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy placeholder:text-navy/30 focus:outline-none focus:border-gold transition-colors ${className}`}
          {...props}
        />
      </label>
    );
  }
);
TextField.displayName = "TextField";
