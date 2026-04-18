import { useEffect, useMemo, useState } from "react";

type Choice = { letter: "A" | "B" | "C" | "D"; text: string };

type Q = {
  id: string;
  dimension: string;
  question_text: string;
  choices: Choice[];
};

export default function SurveyPage() {
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; at: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/survey/questions");
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { questions: Q[] };
        if (!cancelled) {
          setQuestions(data.questions);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load survey");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allAnswered = useMemo(() => {
    if (!questions.length) return false;
    return questions.every((q) => answers[q.id]);
  }, [questions, answers]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/survey/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { response_id: string; submitted_at: string };
      setDone({ id: data.response_id, at: data.submitted_at });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="muted">Loading survey…</p>;
  if (error && !questions.length) return <p className="err">{error}</p>;

  if (done) {
    return (
      <div className="card">
        <h2>Thank you</h2>
        <p className="muted">Your response was recorded.</p>
        <p>
          <strong>Response ID:</strong> {done.id}
        </p>
        <p>
          <strong>Submitted at:</strong> {new Date(done.at).toLocaleString()}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>SDLC AI maturity survey</h1>
      <p className="muted">Answer every question, then submit.</p>
      {questions.map((q) => (
        <div key={q.id} className="card">
          <div className="dim">{q.dimension}</div>
          <div className="qtext">{q.question_text}</div>
          {q.choices.map((c) => (
            <label key={c.letter} className="choice">
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === c.letter}
                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: c.letter }))}
              />{" "}
              <strong>{c.letter}.</strong> {c.text}
            </label>
          ))}
        </div>
      ))}
      {error ? <p className="err">{error}</p> : null}
      <div className="actions">
        <button type="button" disabled={!allAnswered || submitting} onClick={() => void submit()}>
          {submitting ? "Submitting…" : "Submit responses"}
        </button>
      </div>
    </div>
  );
}
