import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong shadow-md active:translate-y-px',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-bad text-bg hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-4 text-[0.95rem]',
  lg: 'min-h-14 px-6 text-lg',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', block = false): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all',
    'disabled:cursor-not-allowed disabled:opacity-50 select-none',
    VARIANTS[variant],
    SIZES[size],
    block ? 'w-full' : '',
  ].join(' ');
}

export function Button({ variant = 'primary', size = 'md', block, icon, className, children, type, ...rest }: ButtonProps) {
  return (
    <button type={type ?? 'button'} className={`${buttonClass(variant, size, block)} ${className ?? ''}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}
