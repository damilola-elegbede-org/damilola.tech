/**
 * ATS-friendly resume PDF generator using @react-pdf/renderer.
 *
 * Creates native text-based PDFs (not image-based) that ATS systems can parse.
 * Design matches the original Damilola Elegbede resume format:
 * - Helvetica font (similar to Helvetica Neue)
 * - Black text on white background
 * - Clean, single-column layout
 * - Professional, minimal styling
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
  location: string;
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
    leadership: string[];
    cloud: string[];
    systemArchitecture: string[];
    devex: string[];
    programming: string[];
    domain: string[];
  };
}

// Styles matching the original resume design
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  // Header section
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 8,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
    textAlign: 'center',
  },
  title: {
    fontSize: 11,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 6,
  },
  contact: {
    fontSize: 9,
    color: '#333333',
    textAlign: 'center',
  },
  contactLink: {
    color: '#0066cc',
    textDecoration: 'none',
  },
  // Section headers
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    paddingBottom: 2,
    textTransform: 'uppercase',
  },
  // Summary
  summary: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 8,
    textAlign: 'justify',
  },
  // Experience section
  job: {
    marginBottom: 10,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  jobTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    flex: 1,
  },
  jobDates: {
    fontSize: 9,
    color: '#333333',
  },
  jobCompany: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#333333',
    marginBottom: 4,
  },
  bulletContainer: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  bullet: {
    width: 8,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.4,
  },
  // Education section
  educationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  degree: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  institution: {
    fontSize: 10,
    color: '#333333',
  },
  year: {
    fontSize: 9,
    color: '#333333',
  },
  focus: {
    fontSize: 9,
    color: '#666666',
    fontStyle: 'italic',
  },
  // Skills section
  skillCategory: {
    marginBottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillLabel: {
    fontFamily: 'Helvetica-Bold',
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
 * React PDF Document component for the resume
 */
function ResumePDF({ data, analysis, acceptedIndices, showFooter = false }: ResumePDFProps) {
  const resume = applyChanges(data, analysis.proposedChanges, acceptedIndices);
  const acceptedChanges = analysis.proposedChanges.filter((_, i) => acceptedIndices.has(i));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{resume.name}</Text>
          <Text style={styles.title}>{resume.title}</Text>
          <Text style={styles.contact}>
            {resume.location} | {resume.phone} | {resume.email} |{' '}
            <Link src={resume.linkedin} style={styles.contactLink}>
              LinkedIn
            </Link>
          </Text>
        </View>

        {/* Professional Summary */}
        <Text style={styles.sectionHeader}>Professional Summary</Text>
        <Text style={styles.summary}>{resume.summary}</Text>

        {/* Professional Experience */}
        <Text style={styles.sectionHeader}>Professional Experience</Text>
        {resume.experience.map((job, jobIndex) => (
          <View key={jobIndex} style={styles.job} wrap={false}>
            <View style={styles.jobHeader}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobDates}>{job.dates}</Text>
            </View>
            <Text style={styles.jobCompany}>
              {job.company}, {job.location}
            </Text>
            {job.responsibilities.map((responsibility, bulletIndex) => (
              <View key={bulletIndex} style={styles.bulletContainer}>
                <Text style={styles.bullet}>&#8226;</Text>
                <Text style={styles.bulletText}>{responsibility}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Education */}
        <Text style={styles.sectionHeader}>Education</Text>
        {resume.education.map((edu, eduIndex) => (
          <View key={eduIndex} style={styles.educationItem}>
            <View style={{ flex: 1 }}>
              <Text>
                <Text style={styles.degree}>{edu.degree}</Text>
                <Text style={styles.institution}> - {edu.institution}</Text>
                {edu.focus && <Text style={styles.focus}> ({edu.focus})</Text>}
              </Text>
            </View>
            <Text style={styles.year}>{edu.year}</Text>
          </View>
        ))}

        {/* Core Competencies */}
        <Text style={styles.sectionHeader}>Core Competencies</Text>
        <View style={styles.skillCategory}>
          <Text style={styles.skillLabel}>Leadership: </Text>
          <Text style={styles.skillList}>{resume.skills.leadership.join(' | ')}</Text>
        </View>
        <View style={styles.skillCategory}>
          <Text style={styles.skillLabel}>Cloud & Infrastructure: </Text>
          <Text style={styles.skillList}>{resume.skills.cloud.join(' | ')}</Text>
        </View>
        <View style={styles.skillCategory}>
          <Text style={styles.skillLabel}>Technical: </Text>
          <Text style={styles.skillList}>
            {[
              ...resume.skills.systemArchitecture.slice(0, 4),
              ...resume.skills.devex.slice(0, 3),
            ].join(' | ')}
          </Text>
        </View>
        <View style={styles.skillCategory}>
          <Text style={styles.skillLabel}>Programming: </Text>
          <Text style={styles.skillList}>{resume.skills.programming.join(' | ')}</Text>
        </View>

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
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
  return `${sanitize(companyName)}-${sanitize(roleTitle)}.pdf`;
}
