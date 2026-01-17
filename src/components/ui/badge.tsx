import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'accent';
}

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        {
          'bg-[var(--color-bg-alt)] text-[var(--color-text)]':
            variant === 'default',
          'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-muted)]':
            variant === 'outline',
          'bg-[var(--color-accent)] text-white': variant === 'accent',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
