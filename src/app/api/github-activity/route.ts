import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 3600;

const GITHUB_USERNAME = 'damilola-elegbede';

interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  stargazers_count: number;
  pushed_at: string;
}

interface ContributionDay {
  contributionCount: number;
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}

interface GraphQLResponse {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          weeks?: ContributionWeek[];
        };
      };
    };
  };
}

function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString();
}

async function fetchContributionCount(token: string): Promise<number> {
  const from = ninetyDaysAgo();
  const query = `{
    user(login: "${GITHUB_USERNAME}") {
      contributionsCollection(from: "${from}") {
        contributionCalendar {
          weeks {
            contributionDays {
              contributionCount
            }
          }
        }
      }
    }
  }`;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) return 0;
  const json: GraphQLResponse = await res.json();
  const weeks =
    json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];

  return weeks
    .flatMap((w) => w.contributionDays)
    .reduce((sum, d) => sum + d.contributionCount, 0);
}

async function fetchTopRepos(token: string): Promise<Repo[]> {
  const res = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=pushed&per_page=10&type=owner`,
    {
      headers: {
        Authorization: `bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (!res.ok) return [];
  const repos: Repo[] = await res.json();
  return repos
    .filter((r) => !r.name.startsWith('.') && r.name !== GITHUB_USERNAME)
    .slice(0, 5);
}

export async function GET() {
  const token = process.env.GITHUB_PERSONAL_TOKEN;

  if (!token) {
    return NextResponse.json(
      { contributionCount: 0, repos: [], error: 'GitHub token not configured' },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      },
    );
  }

  try {
    const [contributionCount, repos] = await Promise.all([
      fetchContributionCount(token),
      fetchTopRepos(token),
    ]);

    return NextResponse.json(
      { contributionCount, repos },
      {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      },
    );
  } catch {
    return NextResponse.json(
      { contributionCount: 0, repos: [], error: 'Failed to fetch GitHub data' },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      },
    );
  }
}
