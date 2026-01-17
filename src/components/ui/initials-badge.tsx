interface InitialsBadgeProps {
  initials?: string;
  className?: string;
}

export function InitialsBadge({ initials = 'DE', className = '' }: InitialsBadgeProps) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] font-serif text-xl font-bold text-[var(--color-text)] ${className}`}
    >
      {initials}
    </div>
  );
}
