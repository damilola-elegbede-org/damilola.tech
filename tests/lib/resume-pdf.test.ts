import { describe, it, expect } from 'vitest';
import { getResumeFilename } from '@/lib/resume-pdf';

describe('getResumeFilename', () => {
  it('should generate a valid filename', () => {
    const filename = getResumeFilename('Test Company', 'Engineering Manager');
    expect(filename).toBe('Test-Company-Engineering-Manager.pdf');
  });

  it('should sanitize special characters', () => {
    const filename = getResumeFilename('Company (Inc.)', 'Role/Title');
    expect(filename).toBe('Company-Inc-RoleTitle.pdf');
  });

  it('should handle multiple spaces', () => {
    const filename = getResumeFilename('My  Company', 'Senior  Manager');
    expect(filename).toBe('My-Company-Senior-Manager.pdf');
  });

  it('should handle empty strings', () => {
    const filename = getResumeFilename('', '');
    expect(filename).toBe('-.pdf');
  });
});

// Note: Full PDF generation tests would require mocking @react-pdf/renderer
// which is complex. The PDF rendering is primarily tested through E2E tests
// that verify the generated PDF contains expected text.
