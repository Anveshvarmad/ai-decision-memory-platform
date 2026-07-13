import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  GitCompare,
  LoaderCircle,
  Scale,
  Sparkles,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  compareDecisions,
  getDecisions,
} from "../lib/api";

import {
  getActiveWorkspaceId,
} from "../lib/workspace";

import type {
  ComparisonClaim,
  Decision,
  DecisionComparisonResponse,
  ReasoningCitation,
} from "../types/api";

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function Citation({
  citation,
}: {
  citation: ReasoningCitation;
}) {
  const [open, setOpen] =
    useState(false);

  return (
    <article className="comparison-citation">
      <button
        type="button"
        onClick={() =>
          setOpen((current) => !current)
        }
      >
        <span>
          {citation.citation_number}
        </span>

        <div>
          <strong>
            {citation.title}
          </strong>

          <small>
            {citation.document_name ??
              citation.source_type}
          </small>
        </div>

        {open ? (
          <ChevronDown size={16} />
        ) : (
          <ChevronRight size={16} />
        )}
      </button>

      {open && (
        <p>{citation.excerpt}</p>
      )}
    </article>
  );
}

function ClaimSection({
  title,
  claims,
  citations,
}: {
  title: string;
  claims: ComparisonClaim[];
  citations: ReasoningCitation[];
}) {
  if (claims.length === 0) {
    return null;
  }

  return (
    <section className="comparison-claim-section">
      <h3>{title}</h3>

      <div>
        {claims.map((claim, index) => {
          const sourceCitations =
            citations.filter((citation) =>
              claim.source_ids.includes(
                citation.source_id,
              ),
            );

          return (
            <article
              key={`${claim.text}-${index}`}
              className={
                claim.supported
                  ? "comparison-claim supported"
                  : "comparison-claim unsupported"
              }
            >
              <span>
                {claim.supported ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <AlertCircle size={15} />
                )}
              </span>

              <div>
                <p>{claim.text}</p>

                {sourceCitations.length >
                  0 && (
                  <small>
                    {
                      sourceCitations.length
                    }{" "}
                    supporting source
                    {sourceCitations.length ===
                    1
                      ? ""
                      : "s"}
                  </small>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ComparisonPage() {
  const [workspaceId, setWorkspaceId] =
    useState<string | null>(
      getActiveWorkspaceId(),
    );

  const [decisions, setDecisions] =
    useState<Decision[]>([]);

  const [decisionA, setDecisionA] =
    useState("");

  const [decisionB, setDecisionB] =
    useState("");

  const [question, setQuestion] =
    useState(
      "Compare these decisions and explain what changed.",
    );

  const [response, setResponse] =
    useState<DecisionComparisonResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!workspaceId) {
        return;
      }

      try {
        const items = await getDecisions(
          workspaceId,
          "all",
          0,
        );

        setDecisions(items);

        if (items.length >= 2) {
          setDecisionA(items[0].id);
          setDecisionB(items[1].id);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load decisions",
        );
      }
    }

    void load();
  }, [workspaceId]);

  useEffect(() => {
    function handleWorkspaceChange(
      event: Event,
    ) {
      const customEvent =
        event as CustomEvent<string>;

      setWorkspaceId(
        customEvent.detail ??
          getActiveWorkspaceId(),
      );

      setResponse(null);
      setDecisionA("");
      setDecisionB("");
    }

    window.addEventListener(
      "decision-memory-workspace-change",
      handleWorkspaceChange,
    );

    return () =>
      window.removeEventListener(
        "decision-memory-workspace-change",
        handleWorkspaceChange,
      );
  }, []);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !workspaceId ||
      !decisionA ||
      !decisionB ||
      decisionA === decisionB
    ) {
      setError(
        "Select two different decisions.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setResponse(
        await compareDecisions(
          workspaceId,
          {
            decision_a_id: decisionA,
            decision_b_id: decisionB,
            question,
            evidence_limit: 8,
            timeline_limit: 20,
          },
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to compare decisions",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!workspaceId) {
    return (
      <div className="page">
        <div className="empty-state large">
          <GitCompare size={40} />
          <h1>No active workspace</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page comparison-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Decision evolution
          </p>

          <h1>Decision Comparison</h1>

          <p className="page-description">
            Compare organizational choices,
            evidence, stakeholders, risks, and
            timeline changes.
          </p>
        </div>
      </header>

      {error && (
        <div className="page-error">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <form
        className="comparison-form"
        onSubmit={submit}
      >
        <label>
          <span>Decision A</span>

          <select
            value={decisionA}
            onChange={(event) =>
              setDecisionA(
                event.target.value,
              )
            }
          >
            <option value="">
              Select decision
            </option>

            {decisions.map((decision) => (
              <option
                key={decision.id}
                value={decision.id}
              >
                {decision.title}
              </option>
            ))}
          </select>
        </label>

        <ArrowRightLeft size={24} />

        <label>
          <span>Decision B</span>

          <select
            value={decisionB}
            onChange={(event) =>
              setDecisionB(
                event.target.value,
              )
            }
          >
            <option value="">
              Select decision
            </option>

            {decisions.map((decision) => (
              <option
                key={decision.id}
                value={decision.id}
              >
                {decision.title}
              </option>
            ))}
          </select>
        </label>

        <label className="comparison-question">
          <span>Comparison question</span>

          <textarea
            rows={3}
            value={question}
            onChange={(event) =>
              setQuestion(
                event.target.value,
              )
            }
          />
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle
              className="spin"
              size={17}
            />
          ) : (
            <Sparkles size={17} />
          )}

          {loading
            ? "Comparing..."
            : "Compare decisions"}
        </button>
      </form>

      {loading && (
        <div className="comparison-loading">
          <LoaderCircle
            className="spin"
            size={30}
          />

          <h2>Analyzing decision changes</h2>
        </div>
      )}

      {!loading && response && (
        <>
          <section className="comparison-header-card">
            <div>
              <p className="eyebrow">
                Executive summary
              </p>

              <h2>
                {
                  response.result
                    .executive_summary
                }
              </h2>

              <p>
                {
                  response.result
                    .comparison_answer
                }
              </p>
            </div>

            <div>
              <span>Confidence</span>
              <strong>
                {percentage(
                  response.result.confidence,
                )}
              </strong>

              <small>
                {percentage(
                  response.citation_coverage,
                )}{" "}
                citation coverage
              </small>
            </div>
          </section>

          <section className="comparison-snapshot-grid">
            {[
              response.decision_a,
              response.decision_b,
            ].map((decision, index) => (
              <article
                key={decision.decision_id}
              >
                <span>
                  Decision{" "}
                  {index === 0 ? "A" : "B"}
                </span>

                <h3>{decision.title}</h3>

                <p>
                  {decision.summary ??
                    decision.decision_statement}
                </p>

                <div>
                  <small>
                    Status: {decision.status}
                  </small>

                  <small>
                    Confidence:{" "}
                    {percentage(
                      decision.confidence_score,
                    )}
                  </small>

                  <small>
                    {decision.evidence_count}{" "}
                    evidence sources
                  </small>
                </div>
              </article>
            ))}
          </section>

          {response.result
            .preferred_decision_id && (
            <section className="comparison-preference">
              <Scale size={22} />

              <div>
                <strong>
                  Evidence-supported preference
                </strong>

                <p>
                  {
                    response.result
                      .preference_reason
                  }
                </p>
              </div>
            </section>
          )}

          <section className="comparison-claims-grid">
            <ClaimSection
              title="Similarities"
              claims={
                response.result.similarities
              }
              citations={response.citations}
            />

            <ClaimSection
              title="Differences"
              claims={
                response.result.differences
              }
              citations={response.citations}
            />

            <ClaimSection
              title="Changed reasons"
              claims={
                response.result
                  .changed_reasons
              }
              citations={response.citations}
            />

            <ClaimSection
              title="Changed alternatives"
              claims={
                response.result
                  .changed_alternatives
              }
              citations={response.citations}
            />

            <ClaimSection
              title="Changed stakeholders"
              claims={
                response.result
                  .changed_stakeholders
              }
              citations={response.citations}
            />

            <ClaimSection
              title="Changed risks"
              claims={
                response.result.changed_risks
              }
              citations={response.citations}
            />

            <ClaimSection
              title="Changed impacts"
              claims={
                response.result
                  .changed_impacts
              }
              citations={response.citations}
            />

            <ClaimSection
              title="Conflicting evidence"
              claims={
                response.result.conflicts
              }
              citations={response.citations}
            />

            <ClaimSection
              title="Uncertainties"
              claims={
                response.result.uncertainties
              }
              citations={response.citations}
            />
          </section>

          <section className="comparison-evidence">
            <div>
              <FileText size={20} />

              <div>
                <p className="eyebrow">
                  Comparison evidence
                </p>

                <h2>
                  {
                    response.citations.length
                  }{" "}
                  cited sources
                </h2>
              </div>
            </div>

            <div>
              {response.citations.map(
                (citation) => (
                  <Citation
                    key={citation.source_id}
                    citation={citation}
                  />
                ),
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
