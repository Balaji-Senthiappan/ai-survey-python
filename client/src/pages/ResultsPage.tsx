import { useEffect, useState } from "react";

type Summary = {
  submission_count: number;
  submissions: { id: string; submitted_at: string }[];
  dimension_summary: { dimension: string; average_score: number; answer_count: number }[];
  question_summary: {
    question_id: string;
    dimension: string;
    question_text: string;
    average_score: number;
    n: number;
  }[];
};

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

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="muted">Loading results…</p>;

  return (
    <div>
      <h1>Survey results</h1>
      <p className="muted">
        Submissions recorded: <strong>{data.submission_count}</strong>. Averages are simple means of
        per-answer scores.
      </p>

      <h2>By dimension</h2>
      <table>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Average score</th>
            <th>Answers (rows)</th>
          </tr>
        </thead>
        <tbody>
          {data.dimension_summary.map((d) => (
            <tr key={d.dimension}>
              <td>{d.dimension}</td>
              <td>{d.average_score.toFixed(2)}</td>
              <td>{d.answer_count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>By question</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Dimension</th>
            <th>Question</th>
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
              <td>{q.average_score.toFixed(2)}</td>
              <td>{q.n}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Recent submissions</h2>
      <table>
        <thead>
          <tr>
            <th>Response ID</th>
            <th>Submitted at (stored ISO)</th>
          </tr>
        </thead>
        <tbody>
          {data.submissions.map((s) => (
            <tr key={s.id}>
              <td style={{ fontFamily: "ui-monospace, monospace" }}>{s.id}</td>
              <td>{s.submitted_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
