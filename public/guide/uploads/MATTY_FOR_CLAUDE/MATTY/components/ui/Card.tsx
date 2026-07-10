import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

/** 白背景・角丸12px・薄い影のカード。ダッシュボードや一覧のベースになる。 */
export function Card({ padded = true, className = "", ...props }: CardProps) {
  return (
    <div
      className={`card-base ${padded ? "p-5" : ""} ${className}`}
      {...props}
    />
  );
}

export function CardTitle({
  className = "",
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-lg font-bold text-navy mb-3 ${className}`}
      {...props}
    />
  );
}
