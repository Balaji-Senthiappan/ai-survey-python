import { lazy, Suspense, useMemo, useState } from "react";
import type { Data, Layout } from "plotly.js";

const Plot = lazy(() => import("react-plotly.js").then((m) => ({ default: m.default })));

const LETTERS = ["A", "B", "C", "D"] as const;

type QuestionRow = {
  question_id: string;
  dimension: string;
  question_text: string;
  choice_counts: { A: number; B: number; C: number; D: number };
  average_score: number;
  n: number;
};

type Props = { questions: QuestionRow[] };

export default function ResultsPlotSection({ questions }: Props) {
  const [dimension, setDimension] = useState<string>("__all__");

  const dimensionOptions = useMemo(() => {
    const s = new Set(questions.map((q) => q.dimension));
    return Array.from(s).sort();
  }, [questions]);

  const filtered = useMemo(() => {
    if (dimension === "__all__") return questions;
    return questions.filter((q) => q.dimension === dimension);
  }, [questions, dimension]);

  const avgBar: Data = useMemo(() => {
    return {
      type: "bar",
      x: filtered.map((q) => q.question_id),
      y: filtered.map((q) => q.average_score),
      customdata: filtered.map((q) => [q.question_text, q.n] as [string, number]),
      hovertemplate:
        "<b>%{x}</b><br>Average: %{y:.2f}<br>n=%{customdata[1]}<br>%{customdata[0]}<extra></extra>",
      name: "Average score",
    };
  }, [filtered]);

  const layoutAvg: Partial<Layout> = useMemo(
    () => ({
      title:
        dimension === "__all__"
          ? { text: "Average score by question (all dimensions)" }
          : { text: `Average score by question — ${dimension}` },
      xaxis: { title: { text: "Question" }, automargin: true, tickangle: -35 },
      yaxis: { title: { text: "Average score" }, automargin: true, rangemode: "tozero" },
      margin: { l: 48, r: 16, t: 48, b: 100 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      showlegend: false,
    }),
    [dimension],
  );

  const stackTraces: Data[] = useMemo(() => {
    return LETTERS.map((L) => ({
      type: "bar",
      name: L,
      x: filtered.map((q) => q.question_id),
      y: filtered.map((q) => q.choice_counts[L]),
      hovertemplate: `Choice ${L}: %{y}<extra></extra>`,
    }));
  }, [filtered]);

  const layoutStack: Partial<Layout> = useMemo(
    () => ({
      barmode: "stack",
      title:
        dimension === "__all__"
          ? { text: "Choice mix (stacked counts) by question" }
          : { text: `Choice mix (stacked counts) — ${dimension}` },
      xaxis: { title: { text: "Question" }, automargin: true, tickangle: -35 },
      yaxis: { title: { text: "Count" }, automargin: true, rangemode: "tozero" },
      margin: { l: 48, r: 16, t: 48, b: 100 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      legend: { orientation: "h", y: 1.12 },
    }),
    [dimension],
  );

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="results-plotly">
      <h3 className="results-plotly__h">Interactive charts (by question)</h3>
      <p className="results-plotly__controls">
        <label className="field" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          <span>Dimension</span>
          <select value={dimension} onChange={(e) => setDimension(e.target.value)}>
            <option value="__all__">All dimensions</option>
            {dimensionOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {filtered.length === 0 ? (
          <span className="muted" style={{ marginLeft: "0.75rem" }}>
            No questions in this dimension.
          </span>
        ) : null}
      </p>
      {filtered.length > 0 ? (
        <Suspense
          fallback={<p className="muted">Loading chart…</p>}
        >
          <div className="results-plotly__chart">
            <Plot
              data={[avgBar]}
              layout={layoutAvg}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: "100%", minHeight: 380 }}
              useResizeHandler
            />
          </div>
          <div className="results-plotly__chart" style={{ marginTop: "1.5rem" }}>
            <Plot
              data={stackTraces}
              layout={layoutStack}
              config={{ responsive: true, displayModeBar: true }}
              style={{ width: "100%", minHeight: 420 }}
              useResizeHandler
            />
          </div>
        </Suspense>
      ) : null}
    </div>
  );
}
