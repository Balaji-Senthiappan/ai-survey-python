import { lazy, Suspense, useMemo } from "react";
import type { Data, Layout } from "plotly.js";

const Plot = lazy(() => import("react-plotly.js").then((m) => ({ default: m.default })));

type Dim = { dimension: string; average_score: number };

type Props = { dimensions: Dim[] };

export default function ResultsDimensionPlot({ dimensions }: Props) {
  const bar: Data = useMemo(
    () => ({
      type: "bar",
      x: dimensions.map((d) => d.dimension),
      y: dimensions.map((d) => d.average_score),
      customdata: dimensions.map((d) => d.average_score.toFixed(2)),
      hovertemplate:
        "<b>%{x}</b><br>Program average: %{y:.2f}<extra></extra>",
      name: "Program average by dimension",
      marker: { color: "#1e3a5f" },
    }),
    [dimensions],
  );

  const layout: Partial<Layout> = useMemo(
    () => ({
      title: { text: "Program view — average score by dimension" },
      xaxis: { title: { text: "Dimension" }, automargin: true, tickangle: -25 },
      yaxis: { title: { text: "Average score" }, automargin: true, rangemode: "tozero" },
      margin: { l: 48, r: 16, t: 48, b: 120 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      showlegend: false,
    }),
    [],
  );

  if (dimensions.length === 0) {
    return null;
  }

  return (
    <div className="results-plotly__chart">
      <Suspense fallback={<p className="muted">Loading chart…</p>}>
        <Plot
          data={[bar]}
          layout={layout}
          config={{ responsive: true, displayModeBar: true }}
          style={{ width: "100%", minHeight: 360 }}
          useResizeHandler
        />
      </Suspense>
    </div>
  );
}
