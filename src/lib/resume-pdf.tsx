'use client';

/**
 * ATS-friendly resume PDF generator using @react-pdf/renderer.
 *
 * Creates native text-based PDFs (not image-based) that ATS systems can parse.
 * Design matches the original Damilola Elegbede resume format:
 * - Helvetica font (PDF built-in)
 * - Black text on white background
 * - Clean, single-column layout
 * - Professional, minimal styling
 *
 * IMPORTANT: This module must be dynamically imported in Next.js to avoid
 * SSR issues with @react-pdf/renderer. See GitHub issues #3156 and #1737.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Link,
} from '@react-pdf/renderer';

import type { ResumeAnalysisResult, ProposedChange, SkillsReorder } from '@/lib/types/resume-generation';

// Resume data structure (matches resume-full.json)
export interface ResumeData {
  name: string;
  title: string;
  phone: string;
  email: string;
  linkedin: string;
  website: string;
  location: string;
  tagline: string;
  summary: string;
  experience: {
    company: string;
    title: string;
    location: string;
    dates: string;
    description: string;
    responsibilities: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: number;
    focus: string;
  }[];
  skills: {
    category: string;
    items: string[];
  }[];
}

// Styles matching the original resume design exactly
const styles = StyleSheet.create({
  page: {
    padding: 45,
    paddingTop: 35,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.2,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  // Header section - contact info only (no border, line goes after)
  header: {
    marginBottom: 0,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    fontStyle: 'normal',  // Explicitly prevent italic
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,  // More space before contact info
  },
  contactRowFirst: {
    fontSize: 9,
    textAlign: 'center',
    color: '#000000',
    // No marginBottom - tighter spacing to links row
  },
  contactRowSecond: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 0,
    color: '#000000',
  },
  contactLink: {
    color: '#0066cc',
    textDecoration: 'underline',
  },
  // Divider line between contact info and title
  dividerLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginTop: 0,
    marginBottom: 8,
  },
  roleTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  // Section headers - centered, no border
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  // Summary - flows directly after tagline, no section header
  summary: {
    fontSize: 10,
    lineHeight: 1.2,
    marginBottom: 4,
    textAlign: 'justify',
  },
  // Experience section - Company | Location first, then Title (Dates)
  job: {
    marginBottom: 8,
  },
  jobCompanyLine: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  companyBold: {
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    fontSize: 10,
  },
  companyLocation: {
    fontSize: 10,
    marginLeft: 4,
  },
  jobTitleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  jobTitleBold: {
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    fontSize: 10,
  },
  jobDates: {
    fontSize: 10,
  },
  jobDescription: {
    fontSize: 10,
    marginBottom: 3,
    lineHeight: 1.2,
  },
  // Bullets with • character (U+2022)
  bulletContainer: {
    flexDirection: 'row',
    marginLeft: 12,
    marginBottom: 2,
  },
  bullet: {
    width: 12,
    fontSize: 10,
    color: '#000000',
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.2,
  },
  // Education section - multi-line format
  educationEntry: {
    marginBottom: 4,
  },
  degreeLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  degreeBold: {
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    fontSize: 10,
  },
  institution: {
    fontSize: 10,
  },
  focusLine: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  year: {
    fontSize: 10,
  },
  // Skills section
  skillCategory: {
    marginBottom: 4,
  },
  skillLabel: {
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    fontSize: 10,
  },
  skillList: {
    fontSize: 10,
  },
  // Footer note (hidden in production, useful for debugging)
  footer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    borderStyle: 'dashed',
    fontSize: 8,
    color: '#999999',
  },
});

interface ResumePDFProps {
  data: ResumeData;
  analysis: ResumeAnalysisResult;
  acceptedIndices: Set<number>;
  effectiveChanges?: ProposedChange[];
  showFooter?: boolean;
}

/**
 * Normalize company/category name for matching (remove special chars, lowercase)
 */
function normalizeForMatching(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Perform targeted string replacement.
 * Replaces `original` with `modified` within `content`.
 * Falls back to `modified` if `original` not found (backward compatibility).
 */
function targetedReplace(content: string, original: string, modified: string): string {
  if (!original || !content) {
    return modified; // Fallback for edge cases
  }

  // Try exact replacement first
  if (content.includes(original)) {
    return content.replace(original, modified);
  }

  // Try case-insensitive replacement
  const regex = new RegExp(escapeRegExp(original), 'i');
  if (regex.test(content)) {
    return content.replace(regex, modified);
  }

  // Fallback: if original not found, return modified as-is
  // This maintains backward compatibility with changes that expect full replacement
  return modified;
}

/**
 * Apply accepted changes to resume content.
 * Handles summary, experience bullets, skills, and education sections.
 * Also applies skills reordering if provided.
 */
function applyChanges(
  resume: ResumeData,
  changes: ProposedChange[],
  acceptedIndices: Set<number>,
  skillsReorder?: SkillsReorder
): ResumeData {
  const result = JSON.parse(JSON.stringify(resume)) as ResumeData;

  changes.forEach((change, index) => {
    if (!acceptedIndices.has(index)) return;

    if (change.section === 'summary') {
      // Targeted replacement within summary
      result.summary = targetedReplace(result.summary, change.original, change.modified);

    } else if (change.section.startsWith('experience.')) {
      // Parse section like "experience.verily.bullet1"
      const parts = change.section.split('.');
      if (parts.length >= 3) {
        const companyKey = parts[1];
        const bulletMatch = parts[2].match(/bullet(\d+)/);
        const normalizedKey = normalizeForMatching(companyKey);

        // Find experience with normalized matching for robustness
        const expIndex = result.experience.findIndex((exp) => {
          const normalizedExp = normalizeForMatching(exp.company);
          return normalizedExp.includes(normalizedKey) || normalizedKey.includes(normalizedExp);
        });

        if (expIndex >= 0 && bulletMatch) {
          const bulletIndex = parseInt(bulletMatch[1], 10) - 1;
          if (bulletIndex >= 0 && bulletIndex < result.experience[expIndex].responsibilities.length) {
            // Targeted replacement within bullet
            result.experience[expIndex].responsibilities[bulletIndex] = targetedReplace(
              result.experience[expIndex].responsibilities[bulletIndex],
              change.original,
              change.modified
            );
          }
        }
      }

    } else if (change.section.startsWith('skills.')) {
      // Parse section like "skills.technical" or "skills.leadership"
      const parts = change.section.split('.');
      if (parts.length >= 2) {
        const categoryKey = normalizeForMatching(parts[1]);
        const skillIndex = result.skills.findIndex(
          (s) => normalizeForMatching(s.category).includes(categoryKey)
        );
        if (skillIndex >= 0) {
          const currentItems = result.skills[skillIndex].items;

          // Check if original is a partial phrase within an item (targeted replacement)
          // vs a full item or list (full replacement)
          const itemIndex = currentItems.findIndex(
            (item) => item.includes(change.original) ||
                      item.toLowerCase().includes(change.original.toLowerCase())
          );

          // Parse modified to see if it's a list
          const newItems = change.modified.split(/[|,]/).map((s) => s.trim()).filter(Boolean);

          if (itemIndex >= 0 && newItems.length === 1) {
            // Found original in an item AND modified is single item - do targeted replacement
            currentItems[itemIndex] = targetedReplace(
              currentItems[itemIndex],
              change.original,
              change.modified
            );
          } else if (newItems.length > 0) {
            // Either original not found OR modified is a full list - replace entire items array
            // This handles: full list changes, new skills, reordering
            result.skills[skillIndex].items = newItems;
          }
        }
      }

    } else if (change.section.startsWith('education.')) {
      // Parse section like "education.mba.focus" or "education.0.focus"
      const parts = change.section.split('.');
      if (parts.length >= 3) {
        const eduKey = parts[1];
        const field = parts[2];

        // Try matching by degree keyword or by index
        let eduIndex = parseInt(eduKey, 10);
        if (isNaN(eduIndex)) {
          eduIndex = result.education.findIndex(
            (e) => normalizeForMatching(e.degree).includes(normalizeForMatching(eduKey))
          );
        }

        if (eduIndex >= 0 && eduIndex < result.education.length) {
          if (field === 'focus') {
            // Targeted replacement within focus
            result.education[eduIndex].focus = targetedReplace(
              result.education[eduIndex].focus || '',
              change.original,
              change.modified
            );
          } else if (field === 'degree') {
            // Targeted replacement within degree
            result.education[eduIndex].degree = targetedReplace(
              result.education[eduIndex].degree,
              change.original,
              change.modified
            );
          }
        }
      }
    }
  });

  // Apply skills reordering if provided
  if (skillsReorder && skillsReorder.after.length > 0) {
    const reorderedSkills: typeof result.skills = [];
    const remainingSkills = [...result.skills];

    // Add skills in the new order
    for (const categoryName of skillsReorder.after) {
      const normalizedTarget = normalizeForMatching(categoryName);
      const idx = remainingSkills.findIndex(
        (s) => normalizeForMatching(s.category).includes(normalizedTarget) ||
               normalizedTarget.includes(normalizeForMatching(s.category))
      );
      if (idx >= 0) {
        reorderedSkills.push(remainingSkills.splice(idx, 1)[0]);
      }
    }

    // Append any skills not in the reorder list
    reorderedSkills.push(...remainingSkills);
    result.skills = reorderedSkills;
  }

  return result;
}

/**
 * Expand degree abbreviations to full names
 */
function expandDegree(degree: string): string {
  const expansions: Record<string, string> = {
    'MBA': 'Master of Business Administration (MBA)',
    'MS, Computer Science': 'Master of Science (MS), Computer Science',
    'BS, Electrical & Computer Engineering': 'Bachelor of Science (BS), Electrical & Computer Engineering',
  };
  return expansions[degree] || degree;
}

/**
 * React PDF Document component for the resume
 * Format matches original resume exactly:
 * - Name: ALL CAPS, centered, bold
 * - Title: Separate line, centered, bold
 * - Tagline: Italicized
 * - Contact: Two lines - phone|email|location and full URLs
 * - Section headers: Centered, no border
 * - Experience: Company|Location first, then Title (Dates)
 * - Bullets: ● character
 * - Education: Multi-line format
 * - Skills: "KEY SKILLS" title
 */
function ResumePDF({ data, analysis, acceptedIndices, effectiveChanges, showFooter = false }: ResumePDFProps) {
  // Use effectiveChanges if provided (contains user edits), otherwise fall back to proposedChanges
  const changesToApply = effectiveChanges ?? analysis.proposedChanges;
  const resume = applyChanges(data, changesToApply, acceptedIndices, analysis.skillsReorder);
  const acceptedChanges = changesToApply.filter((_, i) => acceptedIndices.has(i));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header - Contact Info */}
        <View style={styles.header}>
          <Text style={styles.name}>{resume.name.toUpperCase()}</Text>
          <View style={styles.contactRowFirst}>
            <Text>
              {resume.phone} |{' '}
              <Link src={`mailto:${resume.email}`} style={styles.contactLink}>
                {resume.email}
              </Link>
              {' '}| {resume.location}
            </Text>
          </View>
          <Text style={styles.contactRowSecond}>
            <Link src={resume.linkedin} style={styles.contactLink}>
              {resume.linkedin}
            </Link>
            {resume.website && (
              <>
                {' | '}
                <Link src={resume.website} style={styles.contactLink}>
                  {resume.website}
                </Link>
              </>
            )}
          </Text>
        </View>

        {/* Divider Line */}
        <View style={styles.dividerLine} />

        {/* Title and Tagline */}
        <Text style={styles.roleTitle}>{resume.title.toUpperCase()}</Text>
        {resume.tagline && <Text style={styles.tagline}>{resume.tagline}</Text>}

        {/* Summary - flows directly after tagline, no section header */}
        <Text style={styles.summary}>{resume.summary}</Text>

        {/* Professional Experience */}
        <Text style={styles.sectionHeader}>Professional Experience</Text>
        {resume.experience.map((job, jobIndex) => (
          <View key={jobIndex} style={styles.job}>
            {/* Company | Location */}
            <View style={styles.jobCompanyLine}>
              <Text style={styles.companyBold}>{job.company}</Text>
              <Text style={styles.companyLocation}>| {job.location}</Text>
            </View>
            {/* Title (Dates) */}
            <View style={styles.jobTitleLine}>
              <Text style={styles.jobTitleBold}>{job.title}</Text>
              <Text style={styles.jobDates}>({job.dates})</Text>
            </View>
            {/* Description paragraph */}
            {job.description && (
              <Text style={styles.jobDescription}>{job.description}</Text>
            )}
            {/* Bullets - wrap={true} allows long text to flow to next line */}
            {job.responsibilities.map((responsibility, bulletIndex) => (
              <View key={bulletIndex} style={styles.bulletContainer} wrap={true}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{responsibility}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Key Skills - BEFORE Education */}
        <Text style={styles.sectionHeader}>Key Skills</Text>
        {resume.skills.map((skill, index) => (
          <Text key={index} style={styles.skillCategory}>
            <Text style={styles.skillLabel}>{skill.category}: </Text>
            <Text style={styles.skillList}>{skill.items.join(' | ')}</Text>
          </Text>
        ))}

        {/* Education - AFTER Skills */}
        <Text style={styles.sectionHeader}>Education</Text>
        {resume.education.map((edu, eduIndex) => (
          <View key={eduIndex} style={styles.educationEntry}>
            <View style={styles.degreeLine}>
              <Text style={styles.degreeBold}>{expandDegree(edu.degree)}</Text>
              <Text style={styles.year}>{edu.year}</Text>
            </View>
            <Text style={styles.institution}>{edu.institution}</Text>
            {edu.focus && <Text style={styles.focusLine}>Focus: {edu.focus}</Text>}
          </View>
        ))}

        {/* Footer (optional) */}
        {showFooter && (
          <View style={styles.footer}>
            <Text>
              ATS Optimized for: {analysis.analysis.roleTitle} at {analysis.analysis.companyName} |
              Compatibility Score: {analysis.optimizedScore.total}/100 |
              Changes Applied: {acceptedChanges.length} |
              Generated: {new Date().toLocaleDateString()}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/**
 * Generate a PDF blob from resume data and analysis results
 * @param effectiveChanges Optional array of changes with user edits applied. If not provided, uses proposedChanges from analysis.
 * @throws Error if PDF generation fails or produces empty output
 */
export async function generateResumePdf(
  data: ResumeData,
  analysis: ResumeAnalysisResult,
  acceptedIndices: Set<number>,
  effectiveChanges?: ProposedChange[]
): Promise<Blob> {
  try {
    const pdfDocument = <ResumePDF data={data} analysis={analysis} acceptedIndices={acceptedIndices} effectiveChanges={effectiveChanges} />;
    // Use toString() to disable PDF compression (calls render(false) internally)
    // Note: toString() is deprecated but functional - gives uncompressed output
    // TODO: Monitor @react-pdf/renderer releases for non-deprecated alternative
    // See: https://github.com/diegomura/react-pdf/issues - no official replacement yet
    const pdfString = await pdf(pdfDocument).toString();
    const blob = new Blob([pdfString], { type: 'application/pdf' });

    if (blob.size === 0) {
      throw new Error('Generated PDF is empty');
    }

    return blob;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`PDF generation failed: ${message}`);
  }
}

/**
 * Apply changes to resume data and return the modified result.
 * Exported for use in logging the optimized resume JSON.
 */
export function applyChangesToResume(
  resume: ResumeData,
  changes: ProposedChange[],
  acceptedIndices: Set<number>,
  skillsReorder?: SkillsReorder
): ResumeData {
  return applyChanges(resume, changes, acceptedIndices, skillsReorder);
}

/**
 * Get the filename for the generated resume
 */
export function getResumeFilename(companyName: string, roleTitle: string): string {
  const sanitize = (str: string) =>
    str
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
  const safeCompany = sanitize(companyName) || 'resume';
  const safeRole = sanitize(roleTitle) || 'optimized';
  return `${safeCompany}-${safeRole}.pdf`;
}
