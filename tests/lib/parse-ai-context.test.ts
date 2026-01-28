import { describe, it, expect } from 'vitest';
import { parseAiContext, mergeAiContextWithExperiences } from '@/lib/parse-ai-context';
import type { AiContext } from '@/types';

describe('parse-ai-context', () => {
  describe('parseAiContext', () => {
    describe('valid input', () => {
      it('parses single experience with all sections', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context
This is the strategic context for experience one.

### Leadership Challenge
This is the leadership challenge.

### Key Insight
This is the key insight.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')).toEqual({
          strategicContext: 'This is the strategic context for experience one.',
          leadershipChallenge: 'This is the leadership challenge.',
          keyInsight: 'This is the key insight.',
        });
      });

      it('parses multiple experiences', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context
Context for experience one.

### Leadership Challenge
Challenge for experience one.

### Key Insight
Insight for experience one.

## Experience Two

### Strategic Context
Context for experience two.

### Leadership Challenge
Challenge for experience two.

### Key Insight
Insight for experience two.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(2);
        expect(result.get('experience-one')).toEqual({
          strategicContext: 'Context for experience one.',
          leadershipChallenge: 'Challenge for experience one.',
          keyInsight: 'Insight for experience one.',
        });
        expect(result.get('experience-two')).toEqual({
          strategicContext: 'Context for experience two.',
          leadershipChallenge: 'Challenge for experience two.',
          keyInsight: 'Insight for experience two.',
        });
      });

      it('normalizes experience IDs to lowercase with dashes', () => {
        const markdown = `# AI Context

## Software Engineer Google

### Strategic Context
Google context.

### Leadership Challenge
Google challenge.

### Key Insight
Google insight.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.has('software-engineer-google')).toBe(true);
      });

      it('trims whitespace from section content', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context


  This has leading and trailing whitespace.


### Leadership Challenge
Normal content.

### Key Insight
Another insight.
`;

        const result = parseAiContext(markdown);

        expect(result.get('experience-one')?.strategicContext).toBe(
          'This has leading and trailing whitespace.'
        );
      });

      it('handles multiline content within sections', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context
This is a multiline
strategic context with
several lines of text.

### Leadership Challenge
Challenge text.

### Key Insight
Insight text.
`;

        const result = parseAiContext(markdown);

        expect(result.get('experience-one')?.strategicContext).toBe(
          'This is a multiline\nstrategic context with\nseveral lines of text.'
        );
      });
    });

    describe('partial sections', () => {
      it('handles experience with only strategic context', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context
Only strategic context provided.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')).toEqual({
          strategicContext: 'Only strategic context provided.',
          leadershipChallenge: '',
          keyInsight: '',
        });
      });

      it('handles experience with only leadership challenge', () => {
        const markdown = `# AI Context

## Experience One

### Leadership Challenge
Only leadership challenge provided.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')).toEqual({
          strategicContext: '',
          leadershipChallenge: 'Only leadership challenge provided.',
          keyInsight: '',
        });
      });

      it('handles experience with only key insight', () => {
        const markdown = `# AI Context

## Experience One

### Key Insight
Only key insight provided.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')).toEqual({
          strategicContext: '',
          leadershipChallenge: '',
          keyInsight: 'Only key insight provided.',
        });
      });

      it('handles experience with subset of sections', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context
Strategic context here.

### Key Insight
Key insight here.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')).toEqual({
          strategicContext: 'Strategic context here.',
          leadershipChallenge: '',
          keyInsight: 'Key insight here.',
        });
      });
    });

    describe('edge cases', () => {
      it('returns empty map for empty string', () => {
        const result = parseAiContext('');

        expect(result.size).toBe(0);
      });

      it('returns empty map for whitespace-only string', () => {
        const result = parseAiContext('   \n\n  \n  ');

        expect(result.size).toBe(0);
      });

      it('ignores content before first h2 header', () => {
        const markdown = `# AI Context

Some preamble text that should be ignored.

## Experience One

### Strategic Context
Context here.

### Leadership Challenge
Challenge here.

### Key Insight
Insight here.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')).toBeDefined();
      });

      it('skips experience with no h3 sections', () => {
        const markdown = `# AI Context

## Experience One

Just some random text without any h3 headers.

## Experience Two

### Strategic Context
Valid context.

### Leadership Challenge
Valid challenge.

### Key Insight
Valid insight.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.has('experience-one')).toBe(false);
        expect(result.has('experience-two')).toBe(true);
      });

      it('skips experience with empty h2 header', () => {
        const markdown = `# AI Context

##

### Strategic Context
Context here.

## Valid Experience

### Strategic Context
Valid context.

### Leadership Challenge
Valid challenge.

### Key Insight
Valid insight.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.has('valid-experience')).toBe(true);
      });

      it('handles case-insensitive section headers', () => {
        const markdown = `# AI Context

## Experience One

### strategic context
Lowercase header.

### LEADERSHIP CHALLENGE
Uppercase header.

### Key Insight
Mixed case header.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')).toEqual({
          strategicContext: 'Lowercase header.',
          leadershipChallenge: 'Uppercase header.',
          keyInsight: 'Mixed case header.',
        });
      });

      it('handles sections with empty content', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context

### Leadership Challenge
Has content.

### Key Insight

`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')).toEqual({
          strategicContext: '',
          leadershipChallenge: 'Has content.',
          keyInsight: '',
        });
      });
    });

    describe('malformed input', () => {
      it('handles markdown without h2 headers', () => {
        const markdown = `# AI Context

### Strategic Context
Context without h2.

### Leadership Challenge
Challenge without h2.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(0);
      });

      it('handles markdown with only h1 header', () => {
        const markdown = `# AI Context`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(0);
      });

      it('handles markdown without any headers', () => {
        const markdown = 'Just plain text without any markdown headers.';

        const result = parseAiContext(markdown);

        expect(result.size).toBe(0);
      });

      it('handles markdown with h4+ headers (ignored)', () => {
        const markdown = `# AI Context

## Experience One

#### This is an h4 header
Should not be parsed.

### Strategic Context
Valid context.

### Leadership Challenge
Valid challenge.

### Key Insight
Valid insight.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.get('experience-one')?.strategicContext).toBe('Valid context.');
      });
    });

    describe('special characters', () => {
      it('handles experience IDs with special characters', () => {
        const markdown = `# AI Context

## Experience @ Company #1

### Strategic Context
Context here.

### Leadership Challenge
Challenge here.

### Key Insight
Insight here.
`;

        const result = parseAiContext(markdown);

        expect(result.size).toBe(1);
        expect(result.has('experience-@-company-#1')).toBe(true);
      });

      it('handles content with markdown formatting', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context
This content has **bold** and *italic* text.

### Leadership Challenge
- Bullet point 1
- Bullet point 2

### Key Insight
[Link text](https://example.com)
`;

        const result = parseAiContext(markdown);
        const context = result.get('experience-one');

        expect(context?.strategicContext).toBe('This content has **bold** and *italic* text.');
        expect(context?.leadershipChallenge).toBe('- Bullet point 1\n- Bullet point 2');
        expect(context?.keyInsight).toBe('[Link text](https://example.com)');
      });

      it('handles content with code blocks', () => {
        const markdown = `# AI Context

## Experience One

### Strategic Context
Strategic context with \`inline code\`.

### Leadership Challenge
Leadership challenge.

### Key Insight
Key insight.
`;

        const result = parseAiContext(markdown);

        expect(result.get('experience-one')?.strategicContext).toBe(
          'Strategic context with `inline code`.'
        );
      });
    });
  });

  describe('mergeAiContextWithExperiences', () => {
    it('merges context into matching experiences', () => {
      const experiences: Array<{ id: string; company: string; title: string; aiContext?: AiContext; [key: string]: unknown }> = [
        { id: 'exp-one', company: 'Company A', title: 'Role A' },
        { id: 'exp-two', company: 'Company B', title: 'Role B' },
      ];

      const contextMap = new Map<string, AiContext>([
        [
          'exp-one',
          {
            strategicContext: 'Context for exp one',
            leadershipChallenge: 'Challenge for exp one',
            keyInsight: 'Insight for exp one',
          },
        ],
        [
          'exp-two',
          {
            strategicContext: 'Context for exp two',
            leadershipChallenge: 'Challenge for exp two',
            keyInsight: 'Insight for exp two',
          },
        ],
      ]);

      const result = mergeAiContextWithExperiences(experiences, contextMap);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'exp-one',
        company: 'Company A',
        title: 'Role A',
        aiContext: {
          strategicContext: 'Context for exp one',
          leadershipChallenge: 'Challenge for exp one',
          keyInsight: 'Insight for exp one',
        },
      });
      expect(result[1]).toEqual({
        id: 'exp-two',
        company: 'Company B',
        title: 'Role B',
        aiContext: {
          strategicContext: 'Context for exp two',
          leadershipChallenge: 'Challenge for exp two',
          keyInsight: 'Insight for exp two',
        },
      });
    });

    it('leaves experiences without matching context unchanged', () => {
      const experiences: Array<{ id: string; company: string; title: string; aiContext?: AiContext; [key: string]: unknown }> = [
        { id: 'exp-one', company: 'Company A', title: 'Role A' },
        { id: 'exp-two', company: 'Company B', title: 'Role B' },
      ];

      const contextMap = new Map<string, AiContext>([
        [
          'exp-one',
          {
            strategicContext: 'Context for exp one',
            leadershipChallenge: 'Challenge for exp one',
            keyInsight: 'Insight for exp one',
          },
        ],
      ]);

      const result = mergeAiContextWithExperiences(experiences, contextMap);

      expect(result).toHaveLength(2);
      expect(result[0].aiContext).toBeDefined();
      expect(result[1].aiContext).toBeUndefined();
    });

    it('handles empty context map', () => {
      const experiences: Array<{ id: string; company: string; title: string; aiContext?: AiContext; [key: string]: unknown }> = [
        { id: 'exp-one', company: 'Company A', title: 'Role A' },
        { id: 'exp-two', company: 'Company B', title: 'Role B' },
      ];

      const contextMap = new Map<string, AiContext>();

      const result = mergeAiContextWithExperiences(experiences, contextMap);

      expect(result).toHaveLength(2);
      expect(result[0].aiContext).toBeUndefined();
      expect(result[1].aiContext).toBeUndefined();
    });

    it('handles empty experiences array', () => {
      const experiences: Array<{ id: string; company: string; title: string }> = [];

      const contextMap = new Map<string, AiContext>([
        [
          'exp-one',
          {
            strategicContext: 'Context',
            leadershipChallenge: 'Challenge',
            keyInsight: 'Insight',
          },
        ],
      ]);

      const result = mergeAiContextWithExperiences(experiences, contextMap);

      expect(result).toHaveLength(0);
    });

    it('does not mutate original experiences array', () => {
      const experiences: Array<{ id: string; company: string; title: string; aiContext?: AiContext; [key: string]: unknown }> = [{ id: 'exp-one', company: 'Company A', title: 'Role A' }];

      const contextMap = new Map<string, AiContext>([
        [
          'exp-one',
          {
            strategicContext: 'Context',
            leadershipChallenge: 'Challenge',
            keyInsight: 'Insight',
          },
        ],
      ]);

      const result = mergeAiContextWithExperiences(experiences, contextMap);

      expect(result).not.toBe(experiences);
      expect(result[0]).not.toBe(experiences[0]);
      expect(experiences[0].aiContext).toBeUndefined();
    });

    it('preserves existing aiContext if present', () => {
      const experiences: Array<{ id: string; company: string; title: string; aiContext?: AiContext; [key: string]: unknown }> = [
        {
          id: 'exp-one',
          company: 'Company A',
          title: 'Role A',
          aiContext: {
            strategicContext: 'Old context',
            leadershipChallenge: 'Old challenge',
            keyInsight: 'Old insight',
          },
        },
      ];

      const contextMap = new Map<string, AiContext>([
        [
          'exp-one',
          {
            strategicContext: 'New context',
            leadershipChallenge: 'New challenge',
            keyInsight: 'New insight',
          },
        ],
      ]);

      const result = mergeAiContextWithExperiences(experiences, contextMap);

      expect(result[0].aiContext).toEqual({
        strategicContext: 'New context',
        leadershipChallenge: 'New challenge',
        keyInsight: 'New insight',
      });
    });

    it('handles experiences with additional properties', () => {
      const experiences: Array<{ id: string; company: string; title: string; aiContext?: AiContext; [key: string]: unknown }> = [
        {
          id: 'exp-one',
          company: 'Company A',
          title: 'Role A',
          location: 'Location A',
          startDate: '2020-01',
          endDate: '2021-01',
          highlights: ['Highlight 1', 'Highlight 2'],
        },
      ];

      const contextMap = new Map<string, AiContext>([
        [
          'exp-one',
          {
            strategicContext: 'Context',
            leadershipChallenge: 'Challenge',
            keyInsight: 'Insight',
          },
        ],
      ]);

      const result = mergeAiContextWithExperiences(experiences, contextMap);

      expect(result[0]).toEqual({
        id: 'exp-one',
        company: 'Company A',
        title: 'Role A',
        location: 'Location A',
        startDate: '2020-01',
        endDate: '2021-01',
        highlights: ['Highlight 1', 'Highlight 2'],
        aiContext: {
          strategicContext: 'Context',
          leadershipChallenge: 'Challenge',
          keyInsight: 'Insight',
        },
      });
    });
  });

  describe('integration', () => {
    it('parses markdown and merges with experiences', () => {
      const markdown = `# AI Context

## software-engineer-google

### Strategic Context
Led critical infrastructure migration.

### Leadership Challenge
Coordinated cross-functional teams.

### Key Insight
Scalability requires early planning.

## product-manager-meta

### Strategic Context
Drove product strategy for new feature.

### Leadership Challenge
Balanced stakeholder priorities.

### Key Insight
Data-driven decisions yield best outcomes.
`;

      const experiences: Array<{ id: string; company: string; title: string; aiContext?: AiContext; [key: string]: unknown }> = [
        { id: 'software-engineer-google', company: 'Google', title: 'Software Engineer' },
        { id: 'product-manager-meta', company: 'Meta', title: 'Product Manager' },
        { id: 'designer-apple', company: 'Apple', title: 'Designer' },
      ];

      const contextMap = parseAiContext(markdown);
      const result = mergeAiContextWithExperiences(experiences, contextMap);

      expect(result).toHaveLength(3);
      expect(result[0].aiContext).toBeDefined();
      expect(result[0].aiContext?.strategicContext).toBe('Led critical infrastructure migration.');
      expect(result[1].aiContext).toBeDefined();
      expect(result[1].aiContext?.strategicContext).toBe('Drove product strategy for new feature.');
      expect(result[2].aiContext).toBeUndefined();
    });
  });
});
