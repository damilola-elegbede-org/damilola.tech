/**
 * The two job descriptions Clara probed production with on 2026-08-21, verbatim.
 *
 * Recovered from the probe script itself (`probe_breakdown.py`) — the empirical
 * report cites them but carries only one-line summaries, so the report alone
 * could not have produced these fixtures.
 *
 * They are a matched pair and only work as one:
 *
 *   IDEAL_JD   written to be D's perfect role. Scored roleFit 78 on the
 *              seven-signal table with ALL SIX GATES PASSING — two points under
 *              the bar. That is the old table's ceiling problem as a single
 *              number, and it is this ticket's acceptance test.
 *
 *   PASTRY_JD  the negative control. It already behaves correctly (gate-fails
 *              G1), so it guards against the one cheap way to pass the first
 *              fixture: raising the ceiling by loosening the gates.
 */

export const IDEAL_JD = `Director of Engineering, Developer Experience and CI/CD Platform.
We are hiring a Director of Engineering to lead our Developer Experience and Platform
Engineering organization. You will own CI/CD, build and release infrastructure, developer
tooling, and internal platform services. Responsibilities: lead multiple engineering
managers and their teams; set the technical roadmap for continuous integration, continuous
delivery, and build systems; drive developer productivity metrics; partner with SRE and
infrastructure teams on reliability, observability, and cloud cost. Requirements: experience
managing engineering managers; deep background in CI/CD pipelines, Jenkins, GitHub Actions,
Kubernetes, Docker, Terraform, AWS and GCP; track record improving build times, deployment
frequency, and developer velocity; experience running platform engineering and developer
experience functions at scale. Remote friendly. $250,000 - $320,000 base.`;

export const IDEAL_TITLE = 'Director of Engineering, Developer Experience';

export const PASTRY_JD = `Pastry Chef, Artisan Bakery.
We are seeking an experienced Pastry Chef to join our artisan bakery. Responsibilities:
prepare laminated doughs, croissants, danishes, and viennoiserie daily; develop seasonal
dessert menus; manage inventory of flour, butter, chocolate and seasonal fruit; maintain
food safety and sanitation standards; train junior bakers on lamination and tempering.
Requirements: culinary degree or equivalent apprenticeship; 5+ years in a high-volume
pastry kitchen; expertise in chocolate tempering, sugar work, and bread fermentation;
early morning availability; ability to stand for long shifts and lift 50 lbs.`;

export const PASTRY_TITLE = 'Pastry Chef';
