/**
 * Top improvement areas from dimension scores + actionable steps (industry-typical themes:
 * ownership, baselines, pilots, measurement, skills, tooling, governance).
 */

export type DimensionForRecommendations = {
  dimension: string;
  average_score: number;
};

export type ProgramRecommendation = {
  rank: 1 | 2 | 3;
  dimension: string;
  averageScore: number;
  rationale: string;
  actionSteps: string[];
};

const MAX = 3;

function bucketKey(label: string): "people" | "infra" | "sdlc" | "governance" | "default" {
  const s = label.toLowerCase();
  if (
    /fluency|people|skill|human|talent|train|workforce|culture|adoption|organization/i.test(
      s,
    )
  ) {
    return "people";
  }
  if (
    /infrastructure|tooling|stack|platform|enabler|mlops|pipeline|automation|integration/i.test(
      s,
    )
  ) {
    return "infra";
  }
  if (/sdlc|use case|development|software|delivery|engineer|coding|coverage|mode of usage/i.test(s)) {
    return "sdlc";
  }
  if (/(govern|polic|complianc|risk|security|privacy|audit|ethic)/i.test(s)) {
    return "governance";
  }
  return "default";
}

function actionStepsForBucket(
  key: "people" | "infra" | "sdlc" | "governance" | "default",
  label: string,
): string[] {
  const d = `“${label}”`;
  switch (key) {
    case "people":
      return [
        `Name an accountable owner for AI skills and ways of working related to ${d} within the next 2–4 weeks.`,
        `Define 2–3 target proficiency outcomes (role-based) and a lightweight assessment or peer review, to complete a baseline this quarter.`,
        `Run a recurring internal forum (e.g. biweekly) for shared practices, blockers, and lessons learned; capture decisions in a single repository.`,
        `Tie development plans for teams to 1–2 concrete behaviors (e.g. prompt hygiene, review practice) and review progress in 60–90 days.`,
      ];
    case "infra":
      return [
        `Agree a minimal approved toolchain for ${d} and document who can request access, with SLAs, within 30 days.`,
        `Standardize one reference pattern (e.g. dev → test guardrails) and validate it with a security / data review checkpoint.`,
        `Publish basic usage, cost, and error visibility to engineering leadership monthly so trade-offs are explicit.`,
        `Pilot changes with one product line first; expand only after clear runbooks and on-call coverage exist.`,
      ];
    case "sdlc":
      return [
        `Select 1–2 end-to-end workflows (e.g. spec → test) for a time-boxed pilot using AI where value is clear and risk is managed.`,
        `For each workflow, add explicit acceptance criteria and a human review gate appropriate to criticality, written down—not ad hoc.`,
        `Add AI-related checks to your existing code review and release checklists, then measure defect escape and rework over two sprints.`,
        `In the next program review, compare cycle time and quality metrics before/after; adjust scope based on data, not anecdotes.`,
      ];
    case "governance":
      return [
        `Publish a short acceptable-use and escalation policy: prohibited uses, data classes, and how incidents are reported.`,
        `Map high-risk decisions to “human in the loop” or “human on the loop” and embed that in your SDLC and procurement gates.`,
        `Set a calendar for control reviews (e.g. quarterly) with legal, security, and product; track exceptions in one register.`,
        `Run tabletop exercises for failure modes (e.g. confidentiality, model drift) and turn findings into 30-day remediation items.`,
      ];
    default:
      return [
        `Within 2–4 weeks, assign a single program owner to coordinate work related to ${d} and report status monthly.`,
        `Write down the current baseline (practices, tools, and pain points) for this area so progress can be measured in 30–60 days.`,
        `Define two leading metrics (e.g. adoption, cycle time, satisfaction) and one lagging outcome; put them on a team dashboard.`,
        `Run a 4–6 week “probe” pilot in one team, with an explicit stop/kill date and a decision meeting to scale or adjust.`,
      ];
  }
}

/**
 * Ranks the weakest dimensions by `average_score` and returns up to `max` recommendations with
 * data-backed rationale and 4 actionable steps each.
 */
export function buildTopRecommendations(
  dimensionSummary: DimensionForRecommendations[],
  options: { max?: number } = {},
): ProgramRecommendation[] {
  const cap = options.max ?? MAX;
  if (!dimensionSummary.length) {
    return [];
  }

  const sorted = [...dimensionSummary]
    .filter((d) => d.dimension.trim().length > 0)
    .sort((a, b) => {
      if (a.average_score !== b.average_score) {
        return a.average_score - b.average_score;
      }
      return a.dimension.localeCompare(b.dimension);
    });

  const nDim = sorted.length;
  const picked = sorted.slice(0, Math.min(cap, nDim));
  if (picked.length === 0) {
    return [];
  }

  const allScores = sorted.map((d) => d.average_score);
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);

  return picked.map((d, i) => {
    const rank = (i + 1) as 1 | 2 | 3;
    const label = d.dimension;
    const pos = sorted.findIndex((x) => x.dimension === d.dimension) + 1;
    const rationale =
      nDim <= 1
        ? `Program average in this area is ${d.average_score.toFixed(2)} (only dimension in this survey). Use the steps below to set direction and a baseline.`
        : d.average_score === minScore && i === 0
          ? `Lowest program average across dimensions (score ${d.average_score.toFixed(2)}; range in this survey ${minScore.toFixed(2)}–${maxScore.toFixed(2)}). Addressing this area first typically yields the largest relative lift.`
          : `Among the ${nDim} dimension(s) in this survey, this is #${pos} of ${nDim} by program average (score ${d.average_score.toFixed(2)}; overall range ${minScore.toFixed(2)}–${maxScore.toFixed(2)}). Strengthening here will balance your adoption profile.`;

    const key = bucketKey(label);
    const actionSteps = actionStepsForBucket(key, label);

    return {
      rank,
      dimension: label,
      averageScore: d.average_score,
      rationale,
      actionSteps,
    };
  });
}
