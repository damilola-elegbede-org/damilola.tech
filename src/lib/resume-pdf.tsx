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

import type { ResumeAnalysisResult, ProposedChange } from '@/lib/types/resume-generation';

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
  showFooter?: boolean;
}

/**
 * Apply accepted changes to resume content
 */
function applyChanges(
  resume: ResumeData,
  changes: ProposedChange[],
  acceptedIndices: Set<number>
): ResumeData {
  const result = JSON.parse(JSON.stringify(resume)) as ResumeData;

  changes.forEach((change, index) => {
    if (!acceptedIndices.has(index)) return;

    if (change.section === 'summary') {
      result.summary = change.modified;
    } else if (change.section.startsWith('experience.')) {
      // Parse section like "experience.verily.bullet1"
      const parts = change.section.split('.');
      if (parts.length >= 3) {
        const companyKey = parts[1].toLowerCase();
        const bulletMatch = parts[2].match(/bullet(\d+)/);

        const expIndex = result.experience.findIndex(
          (exp) => exp.company.toLowerCase().includes(companyKey)
        );

        if (expIndex >= 0 && bulletMatch) {
          const bulletIndex = parseInt(bulletMatch[1], 10) - 1;
          if (bulletIndex >= 0 && bulletIndex < result.experience[expIndex].responsibilities.length) {
            result.experience[expIndex].responsibilities[bulletIndex] = change.modified;
          }
        }
      }
    }
  });

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
function ResumePDF({ data, analysis, acceptedIndices, showFooter = false }: ResumePDFProps) {
  const resume = applyChanges(data, analysis.proposedChanges, acceptedIndices);
  const acceptedChanges = analysis.proposedChanges.filter((_, i) => acceptedIndices.has(i));

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
            {/* Bullets */}
            {job.responsibilities.map((responsibility, bulletIndex) => (
              <View key={bulletIndex} style={styles.bulletContainer} wrap={false}>
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
 */
export async function generateResumePdf(
  data: ResumeData,
  analysis: ResumeAnalysisResult,
  acceptedIndices: Set<number>
): Promise<Blob> {
  const pdfDocument = <ResumePDF data={data} analysis={analysis} acceptedIndices={acceptedIndices} />;
  const blob = await pdf(pdfDocument).toBlob();
  return blob;
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
