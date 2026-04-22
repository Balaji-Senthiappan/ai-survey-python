import { useEffect, useMemo, useState } from "react";
import { buildTopRecommendations } from "../resultsRecommendations";
import ResultsPlotSection from "./ResultsPlotSection";
import ResultsDimensionPlot from "./ResultsDimensionPlot";

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

type ChoiceCounts = Record<Letter, number>;

export type Summary = {
  submission_count: number;
  submissions: { id: string; submitted_at: string; respondent_name: string; account_name: string }[];
  dimension_summary: {
    dimension: string;
    average_score: number;
    answer_count: number;
    respondent_mean_min: number;
    respondent_mean_max: number;
    respondent_mean_median: number;
    respondent_n: number;
    respondent_means: number[];
  }[];
  question_summary: {
    question_id: string;
    dimension: string;
    question_text: string;
    choice_a: string;
    choice_b: string;
    choice_c: string;
    choice_d: string;
    choice_counts: ChoiceCounts;
    score_distribution: { score: number; count: number }[];
    average_score: number;
    n: number;
  }[];
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function labelForLetter(
  letter: Letter,
  q: { choice_a: string; choice_b: string; choice_c: string; choice_d: string },
): string {
  const k = `choice_${letter.toLowerCase()}` as keyof typeof q;
  return q[k];
}

function ChoiceDistribution({ q }: { q: Summary["question_summary"][number] }) {
  const total = LETTERS.reduce((s, L) => s + q.choice_counts[L], 0);
  if (total === 0) {
    return <span className="muted">—</span>;
  }
  const summary = LETTERS.map((L) => {
    const c = q.choice_counts[L];
    const label = labelForLetter(L, q);
    const title = `${L} (${c}): ${label}`;
    return { L, c, title, w: (c / total) * 100 };
  });
  return (
    <div>
      <div
        className="results-spectrum-bar"
        role="img"
        aria-label={`Answer mix: ${summary
          .filter((x) => x.c > 0)
          .map((x) => `${x.L} ${x.c} of ${total}`)
          .join(", ")}`}
      >
        {summary.map(
          (x) =>
            x.c > 0 && (
              <div
                key={x.L}
                className={`results-spectrum-bar__seg results-spectrum-bar__seg--${x.L.toLowerCase() as "a" | "b" | "c" | "d"}`}
                style={{ width: `${x.w}%` }}
                title={x.title}
              />
            ),
        )}
      </div>
      <ul className="results-spectrum-legend" aria-hidden>
        {summary.map((x) => (
          <li key={x.L} title={x.title}>
            <kbd>{x.L}</kbd> {x.c} · {truncate(labelForLetter(x.L, q), 48)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RespondentsSparkline({ means }: { means: number[] }) {
  if (means.length < 2) {
    return null;
  }
  const lo = Math.min(...means);
  const hi = Math.max(...means);
  const span = hi - lo;
  return (
    <div
      className="results-sparkline"
      title={`Per-respondent means in this dimension: ${means.map((m) => m.toFixed(2)).join(", ")}`}
    >
      {means.map((m, i) => {
        const h = span < 1e-9 ? 50 : ((m - lo) / span) * 100;
        return (
          <div
            key={i}
            className="results-sparkline__tick"
            style={{ height: `${20 + h * 0.8}%` }}
          />
        );
      })}
    </div>
  );
}

function QuestionTable({ questions }: { questions: Summary["question_summary"] }) {
  if (questions.length === 0) {
    return <p className="muted">No questions in this dimension.</p>;
  }
  return (
    <div className="results-nested-table-wrap">
      <table className="results-nested-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Question</th>
            <th>Choice mix</th>
            <th>Avg</th>
            <th>n</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.question_id}>
              <td style={{ whiteSpace: "nowrap" }}>{q.question_id}</td>
              <td>{q.question_text}</td>
              <td>
                <ChoiceDistribution q={q} />
              </td>
              <td>{q.average_score.toFixed(2)}</td>
              <td>{q.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResultsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/results/summary");
        if (!res.ok) throw new Error(await res.text());
        const j = (await res.json()) as Summary;
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recommendations = useMemo(
    () => (data ? buildTopRecommendations(data.dimension_summary) : []),
    [data],
  );

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="muted">Loading results…</p>;

  return (
    <div className="results-page">
      <h1>Survey results</h1>
      <p className="muted">
        <strong>Program view</strong> — dimensions first. Open <strong>question details</strong> per
        row when you need drill-down. Averages are simple means of per-answer scores; values reflect
        scores stored at submit (or after admin recalculate).
      </p>

      <details className="results-methodology">
        <summary>How to read methodology and data</summary>
        <p className="muted">
          The <strong>choice mix</strong> bar shows how often each option (A–D) was selected. For each
          dimension, <strong>per-respondent</strong> spread is the mean of that person’s answers in the
          dimension, so you can see alignment or variation. If a question’s rubric changes in Admin,
          use recalculate so stored answers match the new scale for analytics and exports.
        </p>
      </details>

      <h2>Top recommendations — what to improve next</h2>
      <p className="muted results-rec-intro">
        Priorities are based on the <strong>lowest</strong> program average scores by dimension. Each
        item includes actions typical of well-run technology adoption programs; tailor owners and dates
        to your organization.
      </p>
      {recommendations.length === 0 ? (
        <p className="muted">Not enough dimension data to rank improvements yet.</p>
      ) : (
        <ol className="results-recommendations">
          {recommendations.map((r) => (
            <li key={r.dimension} className="results-recommendation-card">
              <h3 className="results-recommendation-card__title">
                {r.rank}. {r.dimension}{" "}
                <span className="results-recommendation-card__score">(program avg {r.averageScore.toFixed(2)})</span>
              </h3>
              <p className="results-recommendation-card__why">{r.rationale}</p>
              <p className="results-recommendation-card__label">Actionable next steps</p>
              <ol className="results-recommendation-card__steps">
                {r.actionSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}

      <h2>Visual summary — scores by dimension</h2>
      {data.dimension_summary.length > 0 ? (
        <ResultsDimensionPlot dimensions={data.dimension_summary} />
      ) : (
        <p className="muted">No dimensions to plot.</p>
      )}

      <h2>By dimension</h2>
      <p className="muted">Use <strong>question details</strong> to see each question in that dimension.</p>
      <div className="results-table-outer">
        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Average score</th>
              <th>Per-respondent spread</th>
              <th>Answers (rows)</th>
              <th>Question details</th>
            </tr>
          </thead>
          <tbody>
            {data.dimension_summary.map((d) => {
              const qs = data.question_summary.filter((q) => q.dimension === d.dimension);
              return (
                <tr key={d.dimension}>
                  <td>{d.dimension}</td>
                  <td>{d.average_score.toFixed(2)}</td>
                  <td>
                    {d.respondent_n === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <div>
                        <span>
                          min {d.respondent_mean_min.toFixed(2)} · med{" "}
                          {d.respondent_mean_median.toFixed(2)} · max {d.respondent_mean_max.toFixed(2)}
                        </span>
                        <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>
                          {d.respondent_n} respondent{d.respondent_n === 1 ? "" : "s"} with at least
                          one answer
                        </span>
                        <RespondentsSparkline means={d.respondent_means} />
                      </div>
                    )}
                  </td>
                  <td>{d.answer_count}</td>
                  <td>
                    <details className="results-dimension-details">
                      <summary>
                        {qs.length === 0
                          ? "No questions"
                          : `View ${qs.length} question${qs.length === 1 ? "" : "s"}`}
                      </summary>
                      <QuestionTable questions={qs} />
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.question_summary.length > 0 ? (
        <details className="results-charts-details">
          <summary>Detailed charts (by question)</summary>
          <p className="muted">
            Interactive question-level charts. Use the dimension filter inside to narrow the view.
          </p>
          <ResultsPlotSection questions={data.question_summary} />
        </details>
      ) : null}

      {data.question_summary.length > 0 ? (
        <details className="results-charts-details">
          <summary>All questions (full list)</summary>
          <div className="results-table-outer">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Dimension</th>
                  <th>Question</th>
                  <th>Choice mix</th>
                  <th>Avg</th>
                  <th>n</th>
                </tr>
              </thead>
              <tbody>
                {data.question_summary.map((q) => (
                  <tr key={q.question_id}>
                    <td style={{ whiteSpace: "nowrap" }}>{q.question_id}</td>
                    <td>{q.dimension}</td>
                    <td>{q.question_text}</td>
                    <td>
                      <ChoiceDistribution q={q} />
                    </td>
                    <td>{q.average_score.toFixed(2)}</td>
                    <td>{q.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <h2>Recent submissions</h2>
      <div className="results-table-outer">
        <table>
          <thead>
            <tr>
              <th>Respondent</th>
              <th>Account</th>
              <th>Response ID</th>
              <th>Submitted at (stored ISO)</th>
            </tr>
          </thead>
          <tbody>
            {data.submissions.map((s) => (
              <tr key={s.id}>
                <td>{s.respondent_name || "—"}</td>
                <td>{s.account_name || "—"}</td>
                <td style={{ fontFamily: "ui-monospace, monospace" }}>{s.id}</td>
                <td>{s.submitted_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
