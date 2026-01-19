export interface AiContext {
  strategicContext: string;
  leadershipChallenge: string;
  keyInsight: string;
}

export interface Experience {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  highlights: string[];
  expanded?: boolean;
  aiContext?: AiContext;
}

export interface Skill {
  category: string;
  items: string[];
}

export interface SkillsAssessment {
  expert: string[];
  proficient: string[];
  familiar: string[];
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  location?: string;
}

export interface ResumeData {
  name: string;
  title: string;
  tagline: string;
  brandingStatement: string;
  email: string;
  linkedin: string;
  github: string;
  location: string;
  openToRoles: string[];
  experienceTags: string[];
  experiences: Experience[];
  skills: Skill[];
  skillsAssessment: SkillsAssessment;
  education: Education[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface SuggestedQuestion {
  label: string;
  question: string;
}

export interface ProjectLink {
  label: string;
  url: string;
  icon: 'external' | 'github';
}

export interface ProjectCategory {
  title: string;
  items: string[];
}

export interface Project {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  techStack: string[];
  links: ProjectLink[];
  highlights?: string[];
  categories?: ProjectCategory[];
  stats?: {
    label: string;
    items: string[];
  };
}
