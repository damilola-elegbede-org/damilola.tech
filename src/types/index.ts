export interface Experience {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  highlights: string[];
  expanded?: boolean;
}

export interface Skill {
  category: string;
  items: string[];
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
  location: string;
  experiences: Experience[];
  skills: Skill[];
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
