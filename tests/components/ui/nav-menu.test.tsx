import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NavMenu } from '@/components/ui/nav-menu';

describe('NavMenu', () => {
  it('renders hamburger button', () => {
    render(<NavMenu />);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('opens menu on button click', () => {
    render(<NavMenu />);
    const button = screen.getByRole('button', { name: /open menu/i });

    fireEvent.click(button);

    // There should now be two navigations (desktop + mobile dropdown)
    const navs = screen.getAllByRole('navigation');
    expect(navs.length).toBe(2);

    // Get the mobile dropdown nav (the second one)
    const mobileNav = navs[1];
    expect(within(mobileNav).getByRole('link', { name: /experience/i })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: /skills/i })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: /education/i })).toBeInTheDocument();
    expect(within(mobileNav).getByRole('link', { name: /projects/i })).toBeInTheDocument();
  });

  it('closes menu on button click when open', () => {
    render(<NavMenu />);
    const button = screen.getByRole('button', { name: /open menu/i });

    // Open menu
    fireEvent.click(button);
    expect(screen.getAllByRole('navigation').length).toBe(2);

    // Close menu by clicking the hamburger button again (now shows "Close menu")
    // Use the same button reference since it toggles
    fireEvent.click(button);
    // Should only have desktop nav remaining
    expect(screen.getAllByRole('navigation').length).toBe(1);
  });

  it('nav links have correct hrefs', () => {
    render(<NavMenu />);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    // Get the mobile dropdown nav (the second one)
    const navs = screen.getAllByRole('navigation');
    const mobileNav = navs[1];

    expect(within(mobileNav).getByRole('link', { name: /experience/i })).toHaveAttribute('href', '#experience');
    expect(within(mobileNav).getByRole('link', { name: /skills/i })).toHaveAttribute('href', '#skills-assessment');
    expect(within(mobileNav).getByRole('link', { name: /education/i })).toHaveAttribute('href', '#education');
    expect(within(mobileNav).getByRole('link', { name: /projects/i })).toHaveAttribute('href', '#projects');
  });

  it('renders desktop navigation links', () => {
    render(<NavMenu />);
    const desktopNav = screen.getAllByRole('navigation')[0];

    expect(within(desktopNav).getByRole('link', { name: /experience/i })).toBeInTheDocument();
    expect(within(desktopNav).getByRole('link', { name: /skills/i })).toBeInTheDocument();
    expect(within(desktopNav).getByRole('link', { name: /education/i })).toBeInTheDocument();
    expect(within(desktopNav).getByRole('link', { name: /projects/i })).toBeInTheDocument();
  });
});
