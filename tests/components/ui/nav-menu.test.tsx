import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NavMenu } from '@/components/ui/nav-menu';

describe('NavMenu', () => {
  const expectedSectionLinks = [
    ['Experience', '#experience'],
    ['Projects', '#projects'],
    ['Skills', '#skills-assessment'],
    ['Education', '#education'],
  ];

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
    expect(within(mobileNav).getAllByRole('link').slice(0, 4).map((link) => link.textContent)).toEqual(
      expectedSectionLinks.map(([label]) => label)
    );
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

    expect(within(mobileNav).getAllByRole('link').slice(0, 4).map((link) => link.getAttribute('href'))).toEqual(
      expectedSectionLinks.map(([, href]) => href)
    );
  });

  it('renders desktop navigation links', () => {
    render(<NavMenu />);
    const desktopNav = screen.getAllByRole('navigation')[0];

    expect(within(desktopNav).getAllByRole('link').slice(0, 4).map((link) => link.textContent)).toEqual(
      expectedSectionLinks.map(([label]) => label)
    );
  });

  it('renders a download resume link in desktop nav', () => {
    render(<NavMenu />);
    const desktopNav = screen.getAllByRole('navigation')[0];
    const downloadLink = within(desktopNav).getByRole('link', { name: /download resume/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute('href', '/api/v1/resume.pdf');
    expect(downloadLink).toHaveAttribute('download');
  });

  it('renders a download resume link in mobile menu', () => {
    render(<NavMenu />);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    const navs = screen.getAllByRole('navigation');
    const mobileNav = navs[1];
    const downloadLink = within(mobileNav).getByRole('link', { name: /download resume/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute('href', '/api/v1/resume.pdf');
    expect(downloadLink).toHaveAttribute('download');
  });
});
