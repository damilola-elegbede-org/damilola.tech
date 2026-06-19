'use client';

import { trackEvent } from '@/lib/audit-client';

interface ConsultingCtaButtonProps {
  className?: string;
  children: React.ReactNode;
}

export function ConsultingCtaButton({ className, children }: ConsultingCtaButtonProps) {
  return (
    <a
      href="#contact"
      className={className}
      onClick={() => trackEvent('consulting_cta_click', { section: 'hero' })}
    >
      {children}
    </a>
  );
}
