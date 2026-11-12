import type { HTMLAttributes } from 'react';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  // Lo sfondo predefinito si applica solo se chi usa la scheda non ne indica uno.
  const background = /(^|\s)bg-/.test(className ?? '') ? '' : 'bg-surface';
  return (
    <div
      className={`cm-card rounded-3xl border border-line ${background} p-4 sm:p-6 ${className ?? ''}`}
      {...rest}
    />
  );
}

export function SectionTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`font-display text-xl font-semibold ${className ?? ''}`} {...rest} />;
}

export function PageTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={`cm-title font-display text-3xl font-semibold leading-tight sm:text-4xl ${className ?? ''}`} {...rest} />;
}
