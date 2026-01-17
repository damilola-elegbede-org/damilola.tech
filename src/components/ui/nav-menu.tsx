'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Experience', href: '#experience' },
  { label: 'Skills', href: '#skills-assessment' },
  { label: 'Education', href: '#education' },
];

interface NavMenuProps {
  className?: string;
}

export function NavMenu({ className }: NavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Desktop Navigation - Spelled out links */}
      <nav className="hidden md:flex md:items-center md:gap-1" role="navigation">
        {navItems.map((item, index) => (
          <span key={item.href} className="flex items-center">
            <a
              href={item.href}
              className="px-3 py-2 text-base text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              {item.label}
            </a>
            {index < navItems.length - 1 && (
              <span className="text-[var(--color-text-muted)]">·</span>
            )}
          </span>
        ))}
      </nav>

      {/* Mobile Navigation - Hamburger */}
      <div className="md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:bg-[var(--color-bg-alt)]"
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
        >
          <svg
            className="h-5 w-5 text-[var(--color-text)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            {/* Menu */}
            <nav
              className="absolute right-0 top-12 z-50 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 shadow-lg"
              role="navigation"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={handleNavClick}
                  className="block px-4 py-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
