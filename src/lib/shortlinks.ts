/**
 * Shortlink configuration for vanity URLs with UTM tracking.
 * These memorable URLs redirect to the homepage with UTM parameters,
 * enabling tracking of verbal/informal referral sources.
 */

export interface ShortlinkConfig {
  slug: string;
  utm_source: string;
  utm_medium: string;
  description: string;
}

export const SHORTLINKS: ShortlinkConfig[] = [
  // LinkedIn
  { slug: 'linkedin', utm_source: 'linkedin', utm_medium: 'bio', description: 'LinkedIn profile bio/website field' },
  { slug: 'li-post', utm_source: 'linkedin', utm_medium: 'post', description: 'Shared in LinkedIn posts' },
  { slug: 'li-dm', utm_source: 'linkedin', utm_medium: 'message', description: 'Sent in LinkedIn DMs' },

  // Email
  { slug: 'sig', utm_source: 'email', utm_medium: 'signature', description: 'Email signature link' },
  { slug: 'email', utm_source: 'email', utm_medium: 'outreach', description: 'Cold outreach emails' },
  { slug: 'followup', utm_source: 'email', utm_medium: 'followup', description: 'Post-interview follow-up emails' },

  // Documents
  { slug: 'resume', utm_source: 'resume', utm_medium: 'document', description: 'Link on resume/CV' },
  { slug: 'cover', utm_source: 'cover_letter', utm_medium: 'document', description: 'Link in cover letters' },
  { slug: 'apply', utm_source: 'application', utm_medium: 'job_board', description: 'Generic job application link' },

  // People
  { slug: 'recruiter', utm_source: 'recruiter', utm_medium: 'verbal', description: 'Shared with external recruiters' },
  { slug: 'hiringmgr', utm_source: 'hiring_manager', utm_medium: 'verbal', description: 'Shared with hiring managers' },
  { slug: 'ref', utm_source: 'referral', utm_medium: 'employee', description: 'Employee referral submissions' },
  { slug: 'friend', utm_source: 'friend', utm_medium: 'referral', description: 'Friends checking it out' },

  // Events
  { slug: 'conf', utm_source: 'conference', utm_medium: 'event', description: 'Conference/summit conversations' },
  { slug: 'meetup', utm_source: 'meetup', utm_medium: 'event', description: 'Tech meetup networking' },
  { slug: 'coffee', utm_source: 'coffee_chat', utm_medium: 'networking', description: 'Informational coffee chats' },
  { slug: 'interview', utm_source: 'interview', utm_medium: 'followup', description: 'Shared during/after interviews' },

  // Print/Physical
  { slug: 'card', utm_source: 'business_card', utm_medium: 'print', description: 'Business card QR code' },
  { slug: 'qr', utm_source: 'qr_code', utm_medium: 'print', description: 'Generic QR code (slides, etc.)' },

  // Online Presence
  { slug: 'github', utm_source: 'github', utm_medium: 'bio', description: 'GitHub profile README' },
  { slug: 'text', utm_source: 'sms', utm_medium: 'message', description: 'Text message shares' },
  { slug: 'blog', utm_source: 'blog', utm_medium: 'content', description: 'Mentioned in blog/articles' },
  { slug: 'speaker', utm_source: 'speaker', utm_medium: 'event', description: 'Speaker bio at talks/webinars' },
];

/**
 * Look up a shortlink configuration by slug.
 * Case-insensitive lookup.
 * @param slug - The shortlink slug to look up
 * @returns The shortlink config if found, undefined otherwise
 */
export function getShortlink(slug: string): ShortlinkConfig | undefined {
  const normalizedSlug = slug.toLowerCase();
  return SHORTLINKS.find((link) => link.slug === normalizedSlug);
}
