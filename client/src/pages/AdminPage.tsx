import { useEffect, useState } from "react";

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

export default function AdminPage() {
  const [rows, setRows] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

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
        Scores default to 0 / 3 / 6 / 9 for choices A–D. Edit via API or future edit form as needed.
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
                {r.score_a},{r.score_b},{r.score_c},{r.score_d}
              </td>
              <td>
                {r.is_active ? (
                  <button type="button" className="secondary" onClick={() => void deactivate(r.id)}>
                    Deactivate
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
