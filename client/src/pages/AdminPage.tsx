import { useCallback, useEffect, useState } from "react";

type Question = {
  id: string;
  dimension: string;
  question_text: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  score_a: number;
  score_b: number;
  score_c: number;
  score_d: number;
  sort_order: number;
  is_active: number;
};

type ScoreDraft = { score_a: number; score_b: number; score_c: number; score_d: number };

const emptyForm = {
  dimension: "",
  question_text: "",
  choice_a: "",
  choice_b: "",
  choice_c: "",
  choice_d: "",
  score_a: 0,
  score_b: 3,
  score_c: 6,
  score_d: 9,
};

function scoresFromRow(r: Question): ScoreDraft {
  return {
    score_a: r.score_a,
    score_b: r.score_b,
    score_c: r.score_c,
    score_d: r.score_d,
  };
}

export default function AdminPage() {
  const [rows, setRows] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ScoreDraft | null>(null);
  const [savingScores, setSavingScores] = useState(false);
  const [recalcStatus, setRecalcStatus] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/questions");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { questions: Question[] };
      setRows(data.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const startEditScores = useCallback((r: Question) => {
    setEditingId(r.id);
    setEditDraft(scoresFromRow(r));
    setError(null);
  }, []);

  const cancelEditScores = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  async function saveEditScores() {
    if (!editingId || !editDraft) return;
    setSavingScores(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/questions/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score_a: editDraft.score_a,
          score_b: editDraft.score_b,
          score_c: editDraft.score_c,
          score_d: editDraft.score_d,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        try {
          const j = JSON.parse(t) as { error?: string };
          throw new Error(j.error || t);
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(t);
          throw e;
        }
      }
      cancelEditScores();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingScores(false);
    }
  }

  async function recalculateStoredScores() {
    if (
      !confirm(
        "Recompute all stored answer scores from the current question rubric? Use this after changing A–D scores on existing questions so that results match the new scale. Historical CSV export rows are not changed.",
      )
    ) {
      return;
    }
    setRecalculating(true);
    setRecalcStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/recalculate-response-scores", { method: "POST" });
      if (!res.ok) {
        const t = await res.text();
        try {
          const j = JSON.parse(t) as { error?: string };
          throw new Error(j.error || t);
        } catch (e) {
          if (e instanceof SyntaxError) throw new Error(t);
          throw e;
        }
      }
      const j = (await res.json()) as { answer_rows_updated?: number };
      setRecalcStatus(
        j.answer_rows_updated != null
          ? `Updated ${j.answer_rows_updated} stored answer row(s).`
          : "Done.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recalculate failed");
    } finally {
      setRecalculating(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this question? It will be hidden from new surveys.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>Admin — questions</h1>
      <p className="muted">
        Scores default to 0 / 3 / 6 / 9 for choices A–D. <strong>Changing scores</strong> updates the
        rubric for <em>new</em> survey submissions. Submissions that are already in the database keep
        their <strong>stored</strong> numeric score until you run recalc below. Export CSV at submit
        time still reflects the value stored then.
      </p>
      <p className="actions" style={{ marginTop: "0.75rem" }}>
        <button
          type="button"
          className="secondary"
          disabled={recalculating}
          onClick={() => void recalculateStoredScores()}
        >
          {recalculating ? "Recalculating…" : "Recalculate stored answer scores from current rubric"}
        </button>
        {recalcStatus ? <span className="muted" style={{ marginLeft: "0.75rem" }}>{recalcStatus}</span> : null}
      </p>

      <div className="card">
        <h2>Add question</h2>
        <form onSubmit={addQuestion}>
          <label className="field">
            <span>Dimension</span>
            <input
              value={form.dimension}
              onChange={(e) => setForm((f) => ({ ...f, dimension: e.target.value }))}
              required
            />
          </label>
          <label className="field">
            <span>Question</span>
            <textarea
              rows={3}
              value={form.question_text}
              onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
              required
            />
          </label>
          {(["a", "b", "c", "d"] as const).map((k) => (
            <label key={k} className="field">
              <span>Choice {k.toUpperCase()}</span>
              <textarea
                rows={2}
                value={form[`choice_${k}`]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [`choice_${k}`]: e.target.value } as typeof f))
                }
                required
              />
            </label>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
            {(["a", "b", "c", "d"] as const).map((k) => (
              <label key={k} className="field">
                <span>Score {k.toUpperCase()}</span>
                <input
                  type="number"
                  value={form[`score_${k}`]}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      [`score_${k}`]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="actions">
            <button type="submit">Add question</button>
          </div>
        </form>
      </div>

      {error ? <p className="err">{error}</p> : null}

      <h2>All questions</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Active</th>
            <th>Dimension</th>
            <th>Question</th>
            <th>Scores A–D</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: "nowrap" }}>{r.id}</td>
              <td>{r.is_active ? "yes" : "no"}</td>
              <td>{r.dimension}</td>
              <td>{r.question_text}</td>
              <td>
                {editingId === r.id && editDraft ? (
                  <div
                    className="admin-score-grid"
                    style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(3rem, 1fr))", gap: "0.35rem", maxWidth: "20rem" }}
                  >
                    {(["a", "b", "c", "d"] as const).map((k) => (
                      <label key={k} className="field" style={{ margin: 0 }}>
                        <span style={{ fontSize: "0.75rem" }}>{k.toUpperCase()}</span>
                        <input
                          type="number"
                          value={editDraft[`score_${k}`]}
                          onChange={(e) =>
                            setEditDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    [`score_${k}`]: Number(e.target.value),
                                  }
                                : d,
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  `${r.score_a},${r.score_b},${r.score_c},${r.score_d}`
                )}
              </td>
              <td>
                {editingId === r.id ? (
                  <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <button type="button" disabled={savingScores} onClick={() => void saveEditScores()}>
                      {savingScores ? "Saving…" : "Save scores"}
                    </button>
                    <button type="button" className="secondary" disabled={savingScores} onClick={cancelEditScores}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="actions" style={{ flexDirection: "column" }}>
                    <button type="button" className="secondary" onClick={() => startEditScores(r)}>
                      Edit scores
                    </button>
                    {r.is_active ? (
                      <button type="button" className="secondary" onClick={() => void deactivate(r.id)}>
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
