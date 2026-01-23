interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
}

export function StatsCard({ title, value, subtitle, icon }: StatsCardProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-muted)]">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-text)]">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-[var(--color-accent)]/10 p-3">
            <svg className="h-6 w-6 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
