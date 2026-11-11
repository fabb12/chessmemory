import type { HTMLAttributes } from 'react';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  // Lo sfondo predefinito si applica solo se chi usa la scheda non ne indica uno.
  const background = /(^|\s)bg-/.test(className ?? '') ? '' : 'bg-surface';
  return (
    <div
      className={`rounded-3xl border border-line ${background} p-4 shadow-[0_4px_18px_rgb(0_0_0/0.06)] sm:p-6 ${className ?? ''}`}
      {...rest}
    />
  );
}

export function SectionTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`font-display text-lg font-semibold ${className ?? ''}`} {...rest} />;
}

export function PageTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={`font-display text-2xl font-semibold sm:text-3xl ${className ?? ''}`} {...rest} />;
}
