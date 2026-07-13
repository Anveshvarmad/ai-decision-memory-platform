import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  GitBranch,
  Lightbulb,
  LoaderCircle,
  Network,
  ShieldAlert,
  Sparkles,
  Target,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  generateDecisionReasoning,
} from "../lib/api";

import {
  getActiveWorkspaceId,
} from "../lib/workspace";

import type {
  ClaimCitationGroup,
  DecisionReasoningResponse,
  ReasoningCitation,
  ReasoningClaim,
} from "../types/api";

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Unknown date";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
    },
  ).format(parsed);
}

function formatConfidence(
  value: number,
): string {
  return `${Math.round(value * 100)}%`;
}

function ClaimItem({
  claim,
  citationGroup,
  icon,
}: {
  claim: ReasoningClaim;
  citationGroup?: ClaimCitationGroup;
  icon: React.ReactNode;
}) {
  const [expanded, setExpanded] =
    useState(false);

  const citations =
    citationGroup?.citations ?? [];

  return (
    <article
      className={
        claim.supported
          ? "claim-item supported"
          : "claim-item unsupported"
      }
    >
      <div className="claim-item-main">
        <span className="claim-item-icon">
          {icon}
        </span>

        <p>{claim.text}</p>

        <button
          type="button"
          disabled={citations.length === 0}
          onClick={() =>
            setExpanded((current) => !current)
          }
        >
          {claim.supported
            ? `${citations.length} source${
                citations.length === 1
                  ? ""
                  : "s"
              }`
            : "Unsupported"}

          {citations.length > 0 &&
            (expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            ))}
        </button>
      </div>

      {expanded && citations.length > 0 && (
        <div className="claim-citation-list">
          {citations.map((citation) => (
            <CitationCard
              key={citation.source_id}
              citation={citation}
            />
          ))}
        </div>
      )}
    </article>
  );
}


function CitationCard({
  citation,
}: {
  citation: ReasoningCitation;
}) {
  const [expanded, setExpanded] =
    useState(false);

  return (
    <article className="reasoning-citation-card">
      <button
        type="button"
        className="reasoning-citation-header"
        onClick={() =>
          setExpanded((current) => !current)
        }
      >
        <span className="reasoning-citation-number">
          {citation.citation_number}
        </span>

        <span className="reasoning-citation-main">
          <strong>{citation.title}</strong>

          <small>
            {citation.document_name ??
              citation.source_type}

            {citation.page_number
              ? ` · Page ${citation.page_number}`
              : ""}

            {citation.section_title
              ? ` · ${citation.section_title}`
              : ""}
          </small>
        </span>

        <span className="reasoning-citation-score">
          {formatConfidence(citation.score)}
        </span>

        {expanded ? (
          <ChevronDown size={17} />
        ) : (
          <ChevronRight size={17} />
        )}
      </button>

      {expanded && (
        <div className="reasoning-citation-body">
          <p>{citation.excerpt}</p>
        </div>
      )}
    </article>
  );
}

export function IntelligencePage() {
  const [workspaceId, setWorkspaceId] =
    useState<string | null>(
      getActiveWorkspaceId(),
    );

  const [query, setQuery] = useState(
    "Why did the team migrate the order-management service from MongoDB to PostgreSQL?",
  );

  const [response, setResponse] =
    useState<DecisionReasoningResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

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
      setError(null);
    }

    window.addEventListener(
      "decision-memory-workspace-change",
      handleWorkspaceChange,
    );

    return () => {
      window.removeEventListener(
        "decision-memory-workspace-change",
        handleWorkspaceChange,
      );
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !workspaceId ||
      !query.trim() ||
      loading
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result =
        await generateDecisionReasoning(
          workspaceId,
          {
            query: query.trim(),
            decision_limit: 3,
            document_limit: 10,
            timeline_limit: 20,
            graph_neighbor_limit: 25,
            minimum_similarity: 0,
            token_budget: 5000,
            maximum_items: 25,
            deduplication_threshold: 0.88,
            include_raw_context: false,
          },
        );

      setResponse(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate decision intelligence",
      );
    } finally {
      setLoading(false);
    }
  }

  const result = response?.result;

  function findClaimCitation(
    claimType: string,
    claimIndex: number,
  ) {
    return response?.claim_citations.find(
      (group) =>
        group.claim_type === claimType &&
        group.claim_index === claimIndex,
    );
  }

  const sourceCount = useMemo(
    () => response?.citations.length ?? 0,
    [response],
  );

  const suggestedQuestions = [
    "Who approved the migration and who implemented it?",
    "Which alternatives were considered before PostgreSQL?",
    "What risks were identified for the migration?",
    "What was the timeline from incident to rollout?",
  ];

  if (!workspaceId) {
    return (
      <div className="page intelligence-page">
        <div className="empty-state large">
          <BrainCircuit size={40} />
          <h1>No active workspace</h1>
          <p>
            Select a workspace before generating
            decision intelligence.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page intelligence-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Grounded decision analysis
          </p>

          <h1>Decision Intelligence</h1>

          <p className="page-description">
            Generate structured reports from
            decisions, evidence, timelines, graph
            relationships, and retrieved documents.
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

      <section className="intelligence-query-panel">
        <div className="intelligence-query-icon">
          <BrainCircuit size={26} />
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            <span>
              Ask a decision intelligence question
            </span>

            <textarea
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              rows={3}
              placeholder="Why was this decision made?"
            />
          </label>

          <div className="intelligence-query-footer">
            <div className="intelligence-suggestions">
              {suggestedQuestions.map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      setQuery(suggestion)
                    }
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={
                loading || !query.trim()
              }
            >
              {loading ? (
                <LoaderCircle
                  size={17}
                  className="spin"
                />
              ) : (
                <Sparkles size={17} />
              )}

              {loading
                ? "Analyzing..."
                : "Generate report"}
            </button>
          </div>
        </form>
      </section>

      {loading && (
        <section className="intelligence-loading-panel">
          <div className="intelligence-loading-orbit">
            <LoaderCircle
              size={32}
              className="spin"
            />
          </div>

          <div>
            <h2>
              Reconstructing decision context
            </h2>

            <p>
              Ranking decisions, evidence,
              timeline events, graph relationships,
              and document chunks.
            </p>
          </div>
        </section>
      )}

      {!loading && !response && (
        <section className="intelligence-welcome">
          <div className="intelligence-welcome-icon">
            <Target size={33} />
          </div>

          <p className="eyebrow">
            Decision reports
          </p>

          <h2>
            Turn fragmented evidence into a clear
            organizational explanation.
          </h2>

          <p>
            The reasoning engine selects and ranks
            evidence before generating a structured
            result with explicit uncertainty and
            citations.
          </p>
        </section>
      )}

      {!loading && response && result && (
        <>
          <section className="intelligence-report-header">
            <div>
              <div className="intelligence-report-meta">
                <span className="metadata-badge purple">
                  <Sparkles size={13} />
                  {response.query_type}
                </span>

                {result.decision_status && (
                  <span
                    className={`decision-status-badge ${result.decision_status}`}
                  >
                    {result.decision_status}
                  </span>
                )}

                <span className="metadata-badge green">
                  <CheckCircle2 size={13} />
                  {sourceCount} citations
                </span>

                <span
                  className={
                    response.citation_coverage
                      .coverage_ratio >= 0.8
                      ? "metadata-badge green"
                      : "metadata-badge red"
                  }
                >
                  <ShieldAlert size={13} />
                  {Math.round(
                    response.citation_coverage
                      .coverage_ratio * 100,
                  )}
                  % claim coverage
                </span>
              </div>

              <h2>
                {result.decision_title ??
                  "Decision intelligence report"}
              </h2>

              <p>{result.summary}</p>
            </div>

            <div className="intelligence-confidence">
              <span>Confidence</span>

              <strong>
                {formatConfidence(
                  result.confidence,
                )}
              </strong>

              <div className="confidence-meter">
                <div
                  style={{
                    width: `${Math.round(
                      result.confidence * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </section>

          <section className="intelligence-answer-card">
            <div className="intelligence-answer-icon">
              <Lightbulb size={22} />
            </div>

            <div>
              <span className="metadata-label">
                Direct answer
              </span>

              <p>{result.answer}</p>
            </div>
          </section>

          <section className="intelligence-overview-grid">
            <article className="intelligence-stat-card">
              <CalendarDays size={19} />
              <span>Decision date</span>
              <strong>
                {formatDate(
                  result.decision_date,
                )}
              </strong>
            </article>

            <article className="intelligence-stat-card">
              <FileText size={19} />
              <span>Context items</span>
              <strong>
                {
                  response.selected_context_items
                }
              </strong>
            </article>

            <article className="intelligence-stat-card">
              <Network size={19} />
              <span>Context tokens</span>
              <strong>
                {
                  response.estimated_context_tokens
                }
              </strong>
            </article>

            <article className="intelligence-stat-card">
              <BrainCircuit size={19} />
              <span>Model</span>
              <strong>{response.model}</strong>
            </article>
          </section>

          <section className="intelligence-section-grid">
            <article className="intelligence-section-card">
              <div className="intelligence-section-heading">
                <Target size={20} />

                <div>
                  <span className="metadata-label">
                    Reasons
                  </span>
                  <h3>
                    Why this decision happened
                  </h3>
                </div>
              </div>

              {result.reason_claims.length === 0 ? (
                <div className="intelligence-empty-list">
                  No explicit reasons were found.
                </div>
              ) : (
                <div className="claim-list">
                  {result.reason_claims.map(
                    (claim, index) => (
                      <ClaimItem
                        key={`${claim.text}-${index}`}
                        claim={claim}
                        citationGroup={findClaimCitation(
                          "reason",
                          index,
                        )}
                        icon={
                          <ArrowRight size={14} />
                        }
                      />
                    ),
                  )}
                </div>
              )}
            </article>

            <article className="intelligence-section-card">
              <div className="intelligence-section-heading">
                <GitBranch size={20} />

                <div>
                  <span className="metadata-label">
                    Alternatives
                  </span>
                  <h3>
                    Options that were considered
                  </h3>
                </div>
              </div>

              {result.alternative_claims.length === 0 ? (
                <div className="intelligence-empty-list">
                  No alternatives were documented.
                </div>
              ) : (
                <div className="claim-list">
                  {result.alternative_claims.map(
                    (claim, index) => (
                      <ClaimItem
                        key={`${claim.text}-${index}`}
                        claim={claim}
                        citationGroup={findClaimCitation(
                          "alternative",
                          index,
                        )}
                        icon={
                          <GitBranch size={14} />
                        }
                      />
                    ),
                  )}
                </div>
              )}
            </article>

            <article className="intelligence-section-card">
              <div className="intelligence-section-heading">
                <UserRound size={20} />

                <div>
                  <span className="metadata-label">
                    Stakeholders
                  </span>
                  <h3>
                    People and teams involved
                  </h3>
                </div>
              </div>

              {result.stakeholder_claims.length === 0 ? (
                <div className="intelligence-empty-list">
                  No stakeholders were explicitly documented.
                </div>
              ) : (
                <div className="claim-list">
                  {result.stakeholder_claims.map(
                    (claim, index) => (
                      <ClaimItem
                        key={`${claim.text}-${index}`}
                        claim={claim}
                        citationGroup={findClaimCitation(
                          "stakeholder",
                          index,
                        )}
                        icon={
                          <UserRound size={14} />
                        }
                      />
                    ),
                  )}
                </div>
              )}
            </article>

            <article className="intelligence-section-card">
              <div className="intelligence-section-heading">
                <ShieldAlert size={20} />

                <div>
                  <span className="metadata-label">
                    Risks
                  </span>
                  <h3>
                    Documented concerns
                  </h3>
                </div>
              </div>

              {result.risk_claims.length === 0 ? (
                <div className="intelligence-empty-list">
                  No explicit risks were found.
                </div>
              ) : (
                <div className="claim-list">
                  {result.risk_claims.map(
                    (claim, index) => (
                      <ClaimItem
                        key={`${claim.text}-${index}`}
                        claim={claim}
                        citationGroup={findClaimCitation(
                          "risk",
                          index,
                        )}
                        icon={
                          <ShieldAlert size={14} />
                        }
                      />
                    ),
                  )}
                </div>
              )}
            </article>
          </section>

          <section className="intelligence-section-card intelligence-full-width">
            <div className="intelligence-section-heading">
              <Zap size={20} />

              <div>
                <span className="metadata-label">
                  Impact
                </span>
                <h3>
                  Systems and outcomes affected
                </h3>
              </div>
            </div>

            {result.impact_claims.length === 0 ? (
              <div className="intelligence-empty-list">
                No impacts were explicitly documented.
              </div>
            ) : (
              <div className="claim-list">
                {result.impact_claims.map(
                  (claim, index) => (
                    <ClaimItem
                      key={`${claim.text}-${index}`}
                      claim={claim}
                      citationGroup={findClaimCitation(
                        "impact",
                        index,
                      )}
                      icon={<Zap size={14} />}
                    />
                  ),
                )}
              </div>
            )}
          </section>

          <section className="intelligence-section-card intelligence-full-width">
            <div className="intelligence-section-heading">
              <Clock3 size={20} />

              <div>
                <span className="metadata-label">
                  Timeline
                </span>
                <h3>
                  Decision chronology
                </h3>
              </div>
            </div>

            {result.timeline.length === 0 ? (
              <div className="intelligence-empty-list">
                No timeline events were found.
              </div>
            ) : (
              <div className="intelligence-timeline">
                {result.timeline.map(
                  (item, index) => (
                    <article
                      key={`${item.title}-${index}`}
                      className="intelligence-timeline-item"
                    >
                      <div className="intelligence-timeline-marker">
                        <span />
                      </div>

                      <div>
                        <div className="intelligence-timeline-heading">
                          <strong>
                            {item.title}
                          </strong>

                          <span>
                            {formatDate(item.date)}
                          </span>
                        </div>

                        {item.description && (
                          <p>
                            {item.description}
                          </p>
                        )}

                        {item.source_ids.length >
                          0 && (
                          <small>
                            {
                              item.source_ids.length
                            }{" "}
                            supporting source
                            {item.source_ids
                              .length === 1
                              ? ""
                              : "s"}
                          </small>
                        )}
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>

          {result.related_decisions.length >
            0 && (
            <section className="intelligence-section-card intelligence-full-width">
              <div className="intelligence-section-heading">
                <Network size={20} />

                <div>
                  <span className="metadata-label">
                    Related decisions
                  </span>

                  <h3>
                    Connected organizational
                    choices
                  </h3>
                </div>
              </div>

              <div className="related-decision-grid">
                {result.related_decisions.map(
                  (decision, index) => (
                    <article
                      key={`${decision.title}-${index}`}
                      className="related-decision-card"
                    >
                      <GitBranch size={18} />

                      <div>
                        <strong>
                          {decision.title}
                        </strong>

                        <p>
                          {decision.relationship ??
                            "Related decision"}
                        </p>

                        {decision.status && (
                          <span
                            className={`decision-status-badge ${decision.status}`}
                          >
                            {decision.status}
                          </span>
                        )}
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>
          )}

          {result.uncertainties.length > 0 && (
            <section className="intelligence-uncertainty-card">
              <AlertCircle size={21} />

              <div>
                <span className="metadata-label">
                  Uncertainty and limitations
                </span>

                <ul>
                  {result.uncertainties.map(
                    (item, index) => (
                      <li
                        key={`${item}-${index}`}
                      >
                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </section>
          )}

          <section className="intelligence-section-card intelligence-full-width">
            <div className="intelligence-section-heading">
              <FileText size={20} />

              <div>
                <span className="metadata-label">
                  Evidence
                </span>

                <h3>
                  {response.citations.length} cited
                  sources
                </h3>
              </div>
            </div>

            {response.citations.length === 0 ? (
              <div className="intelligence-empty-list">
                The model did not reference a
                validated source ID.
              </div>
            ) : (
              <div className="reasoning-citation-list">
                {response.citations.map(
                  (citation) => (
                    <CitationCard
                      key={citation.source_id}
                      citation={citation}
                    />
                  ),
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
