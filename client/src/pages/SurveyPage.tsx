import { useEffect, useMemo, useRef, useState } from "react";

type Choice = { letter: "A" | "B" | "C" | "D"; text: string };

type Q = {
  id: string;
  dimension: string;
  question_text: string;
  choices: Choice[];
};

type DimGroup = {
  dimension: string;
  /** Indices into `questions` */
  indices: number[];
};

const DEFAULT_SUBTITLE =
  "A comprehensive evaluation of artificial intelligence integration in software development practices.";

const STORAGE_RESPONDENT = "assessment.respondentName";
const STORAGE_ACCOUNT = "assessment.accountName";

function splitChoiceHeadline(text: string): { lead: string; rest?: string } {
  const idx = text.indexOf(": ");
  if (idx < 8 || idx > 72) return { lead: text };
  return { lead: text.slice(0, idx), rest: text.slice(idx + 2) };
}

function groupDimensions(questions: Q[]): DimGroup[] {
  const order: string[] = [];
  const byDim = new Map<string, number[]>();
  for (let i = 0; i < questions.length; i++) {
    const d = questions[i].dimension;
    if (!byDim.has(d)) {
      byDim.set(d, []);
      order.push(d);
    }
    byDim.get(d)!.push(i);
  }
  return order.map((dimension) => ({ dimension, indices: byDim.get(dimension)! }));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dimensionAnsweredCount(indices: number[], questions: Q[], answers: Record<string, string>) {
  return indices.filter((i) => answers[questions[i].id]).length;
}

export default function SurveyPage() {
  const helpDialogRef = useRef<HTMLDialogElement>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "A" | "B" | "C" | "D">>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    id: string;
    at: string;
    respondentName: string;
    accountName: string;
  } | null>(null);
  const [respondentNameInput, setRespondentNameInput] = useState("");
  const [accountNameInput, setAccountNameInput] = useState("");

  const assessmentTitle = import.meta.env.VITE_ASSESSMENT_TITLE?.trim() || "AI Adoption Assessment";
  const assessmentSubtitle = import.meta.env.VITE_ASSESSMENT_SUBTITLE?.trim() || DEFAULT_SUBTITLE;
  const assessmentYear =
    import.meta.env.VITE_ASSESSMENT_YEAR?.trim() || String(new Date().getFullYear());

  const dimGroups = useMemo(() => groupDimensions(questions), [questions]);

  const allAnswered = useMemo(() => {
    if (!questions.length) return false;
    return questions.every((q) => answers[q.id]);
  }, [questions, answers]);

  const respondentTrimmed = respondentNameInput.trim();
  const accountTrimmed = accountNameInput.trim();
  const respondentMetaOk = Boolean(respondentTrimmed && accountTrimmed);
  const canSubmit = allAnswered && respondentMetaOk;

  useEffect(() => {
    try {
      const storedN = sessionStorage.getItem(STORAGE_RESPONDENT);
      const storedA = sessionStorage.getItem(STORAGE_ACCOUNT);
      const defaultN = import.meta.env.VITE_DEFAULT_RESPONDENT_NAME?.trim() ?? "";
      const defaultA = import.meta.env.VITE_DEFAULT_ACCOUNT_NAME?.trim() ?? "";
      if (storedN != null) setRespondentNameInput(storedN);
      else if (defaultN) setRespondentNameInput(defaultN);
      if (storedA != null) setAccountNameInput(storedA);
      else if (defaultA) setAccountNameInput(defaultA);
    } catch {
      /* private mode / unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_RESPONDENT, respondentNameInput);
    } catch {
      /* ignore */
    }
  }, [respondentNameInput]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_ACCOUNT, accountNameInput);
    } catch {
      /* ignore */
    }
  }, [accountNameInput]);

  const answeredCount = useMemo(
    () => questions.filter((q) => Boolean(answers[q.id])).length,
    [questions, answers],
  );

  const progressPct = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const currentQ = questions[questionIndex];
  const activeDimIndex = useMemo(() => {
    if (!currentQ) return 0;
    return Math.max(
      0,
      dimGroups.findIndex((g) => g.dimension === currentQ.dimension),
    );
  }, [currentQ, dimGroups]);

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

  useEffect(() => {
    if (questions.length && questionIndex >= questions.length) {
      setQuestionIndex(Math.max(0, questions.length - 1));
    }
  }, [questions.length, questionIndex]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/survey/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          respondent_name: respondentTrimmed,
          account_name: accountTrimmed,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { response_id: string; submitted_at: string };
      setDone({
        id: data.response_id,
        at: data.submitted_at,
        respondentName: respondentTrimmed,
        accountName: accountTrimmed,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  function goToDimension(group: DimGroup) {
    setQuestionIndex(group.indices[0]);
  }

  const isLast = questions.length > 0 && questionIndex >= questions.length - 1;

  const showEmpty = !loading && !error && questions.length === 0;

  const inner =
    loading || (error && !questions.length) || showEmpty ? (
      <div className="assessment-app assessment-app--centered">
        <div className="assessment-state-card">
          {loading ? (
            <p className="assessment-muted">Loading assessment…</p>
          ) : showEmpty ? (
            <p className="assessment-muted">No questions are available right now.</p>
          ) : (
            <p className="err">{error}</p>
          )}
        </div>
      </div>
    ) : done ? (
      <div className="assessment-app assessment-app--centered">
        <div className="assessment-state-card assessment-state-card--wide">
          <h1 className="assessment-serif assessment-state-card__title">Thank you</h1>
          <p className="assessment-muted">Your response was recorded.</p>
          <div className="assessment-done-details">
            <p>
              <strong>Respondent:</strong> {done.respondentName}
            </p>
            <p>
              <strong>Account:</strong> {done.accountName}
            </p>
            <p>
              <strong>Response ID:</strong> {done.id}
            </p>
            <p>
              <strong>Submitted at:</strong> {new Date(done.at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    ) : (
      <div className="assessment-app">
        <header className="assessment-page-header">
          <div className="assessment-page-header__row">
            <h1 className="assessment-page-header__title assessment-serif">{assessmentTitle}</h1>
            <span className="assessment-page-header__year" aria-hidden>
              {assessmentYear}
            </span>
          </div>
          <p className="assessment-page-header__subtitle">{assessmentSubtitle}</p>
          <div className="assessment-page-header__rule" />
        </header>

        <div className="assessment-body">
          <aside className="assessment-sidebar" aria-label="Progress and sections">
            <div className="assessment-sidebar__block">
              <div className="assessment-kicker">Respondent</div>
              <label className="assessment-field">
                <span className="assessment-field__label">Name of respondent</span>
                <input
                  type="text"
                  className="assessment-field__input"
                  value={respondentNameInput}
                  onChange={(e) => setRespondentNameInput(e.target.value)}
                  autoComplete="name"
                  maxLength={200}
                  placeholder="Full name"
                />
              </label>
              <label className="assessment-field">
                <span className="assessment-field__label">Account name</span>
                <input
                  type="text"
                  className="assessment-field__input"
                  value={accountNameInput}
                  onChange={(e) => setAccountNameInput(e.target.value)}
                  autoComplete="organization"
                  maxLength={200}
                  placeholder="Team or account"
                />
              </label>
            </div>

            <div className="assessment-sidebar__block">
              <div className="assessment-progress-head">
                <span className="assessment-kicker">Survey progress</span>
                <span className="assessment-progress-count">
                  {answeredCount} of {questions.length}
                </span>
              </div>
              <div className="assessment-progress-track" aria-hidden>
                <div className="assessment-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="assessment-kicker assessment-kicker--dims">Dimensions</div>
            <ul className="assessment-dim-list">
              {dimGroups.map((g, di) => {
                const answeredInDim = dimensionAnsweredCount(g.indices, questions, answers);
                const totalInDim = g.indices.length;
                const active = di === activeDimIndex;
                return (
                  <li key={g.dimension}>
                    <button
                      type="button"
                      className={`assessment-dim-item${active ? " assessment-dim-item--active" : ""}`}
                      onClick={() => goToDimension(g)}
                      aria-current={active ? "true" : undefined}
                    >
                      <span className={`assessment-dim-num${active ? " assessment-dim-num--active" : ""}`}>
                        {di + 1}
                      </span>
                      <span className="assessment-dim-copy">
                        <span className="assessment-dim-title">{g.dimension}</span>
                        <span className="assessment-dim-meta">
                          {answeredInDim}/{totalInDim}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="assessment-main">
            {currentQ ? (
              <>
                <div className="assessment-main__top">
                  <span className="assessment-step">
                    {pad2(questionIndex + 1)} / {pad2(questions.length)}
                  </span>
                  <span className="assessment-pill">{currentQ.dimension.toUpperCase()}</span>
                </div>

                <h2 className="assessment-question assessment-serif" id={`q-head-${currentQ.id}`}>
                  Q{questionIndex + 1}. {currentQ.question_text}
                </h2>

                <div
                  className="assessment-choice-grid"
                  role="radiogroup"
                  aria-labelledby={`q-head-${currentQ.id}`}
                >
                  {currentQ.choices.map((c) => {
                    const selected = answers[currentQ.id] === c.letter;
                    const { lead, rest } = splitChoiceHeadline(c.text);
                    return (
                      <label
                        key={c.letter}
                        className={`assessment-choice${selected ? " assessment-choice--selected" : ""}`}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name={currentQ.id}
                          checked={selected}
                          onChange={() =>
                            setAnswers((prev) => ({ ...prev, [currentQ.id]: c.letter }))
                          }
                        />
                        <span className={`assessment-choice__badge${selected ? " assessment-choice__badge--on" : ""}`}>
                          {c.letter}
                        </span>
                        <span className="assessment-choice__copy">
                          {rest ? (
                            <>
                              <span className="assessment-choice__lead">{lead}</span>
                              <span className="assessment-choice__rest">{rest}</span>
                            </>
                          ) : (
                            <span className="assessment-choice__plain">{lead}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {error ? <p className="err assessment-inline-err">{error}</p> : null}

                <footer className="assessment-step-footer">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={questionIndex <= 0}
                    onClick={() => setQuestionIndex((i) => Math.max(0, i - 1))}
                  >
                    Previous
                  </button>
                  <div className="assessment-step-footer__right">
                    {!isLast ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setQuestionIndex((i) => Math.min(questions.length - 1, i + 1))}
                      >
                        Next
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canSubmit || submitting}
                      onClick={() => void submit()}
                    >
                      {submitting ? "Submitting…" : "Submit assessment"}
                    </button>
                  </div>
                </footer>
              </>
            ) : null}
          </section>
        </div>

        <button
          type="button"
          className="assessment-help-fab"
          aria-label="Help"
          onClick={() => helpDialogRef.current?.showModal()}
        >
          ?
        </button>

        <dialog ref={helpDialogRef} className="assessment-help-dialog">
          <form method="dialog">
            <h3 className="assessment-help-dialog__title">How to respond</h3>
            <p className="assessment-muted">
              Enter your name and account in the sidebar, answer every question, then submit. You can jump
              between dimensions using the list on the left.
            </p>
            <button type="submit" className="btn btn-primary assessment-help-dialog__close">
              Close
            </button>
          </form>
        </dialog>
      </div>
    );

  return inner;
}
