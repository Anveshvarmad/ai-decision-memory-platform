import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  deleteDecision,
  generateDecisionTimeline,
  getDecision,
  getDecisions,
  getDecisionStats,
  getDecisionTimeline,
  reviewDecision,
  updateDecision,
} from "../lib/api";

import {
  getActiveWorkspaceId,
} from "../lib/workspace";

import type {
  Decision,
  DecisionDetail,
  DecisionEvent,
  DecisionStats,
  DecisionStatus,
  DecisionTimeline,
} from "../types/api";

type DecisionFilter =
  | "all"
  | "candidate"
  | "approved"
  | "rejected";

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
    },
  ).format(new Date(value));
}

function formatConfidence(
  value: number,
): string {
  return `${Math.round(value * 100)}%`;
}

function statusIcon(status: DecisionStatus) {
  if (status === "approved") {
    return <CheckCircle2 size={14} />;
  }

  if (status === "rejected") {
    return <XCircle size={14} />;
  }

  return <Clock3 size={14} />;
}

function timelineEventIcon(
  eventType: string,
) {
  if (
    eventType === "approval" ||
    eventType === "validation"
  ) {
    return <Check size={15} />;
  }

  if (
    eventType === "incident" ||
    eventType === "problem"
  ) {
    return <AlertCircle size={15} />;
  }

  return <CalendarDays size={15} />;
}

interface EditState {
  title: string;
  summary: string;
  decisionStatement: string;
  reason: string;
  alternatives: string;
  participants: string;
  relatedEntities: string;
  decisionDate: string;
}

function createEditState(
  decision: DecisionDetail,
): EditState {
  return {
    title: decision.title,
    summary: decision.summary ?? "",
    decisionStatement:
      decision.decision_statement,
    reason: decision.reason ?? "",
    alternatives:
      decision.alternatives.join("\n"),
    participants:
      decision.participants.join("\n"),
    relatedEntities:
      decision.related_entities.join("\n"),
    decisionDate:
      decision.decision_date?.slice(0, 10) ??
      "",
  };
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function DecisionsPage() {
  const [workspaceId, setWorkspaceId] =
    useState<string | null>(
      getActiveWorkspaceId(),
    );

  const [decisions, setDecisions] =
    useState<Decision[]>([]);

  const [stats, setStats] =
    useState<DecisionStats | null>(null);

  const [
    selectedDecision,
    setSelectedDecision,
  ] = useState<DecisionDetail | null>(null);

  const [timeline, setTimeline] =
    useState<DecisionTimeline | null>(null);

  const [filter, setFilter] =
    useState<DecisionFilter>("all");

  const [minimumConfidence, setMinimumConfidence] =
    useState(0);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingDetail, setLoadingDetail] =
    useState(false);

  const [activeAction, setActiveAction] =
    useState<string | null>(null);

  const [editing, setEditing] =
    useState(false);

  const [editState, setEditState] =
    useState<EditState | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const loadPageData = useCallback(
    async (showLoader = false) => {
      if (!workspaceId) {
        setDecisions([]);
        setStats(null);
        setLoading(false);
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      try {
        const [decisionData, statsData] =
          await Promise.all([
            getDecisions(
              workspaceId,
              filter,
              minimumConfidence,
            ),
            getDecisionStats(workspaceId),
          ]);

        setDecisions(decisionData);
        setStats(statsData);
        setError(null);

        if (
          selectedDecision &&
          !decisionData.some(
            (item) =>
              item.id === selectedDecision.id,
          )
        ) {
          setSelectedDecision(null);
          setTimeline(null);
          setEditing(false);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load decisions",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      workspaceId,
      filter,
      minimumConfidence,
      selectedDecision,
    ],
  );

  useEffect(() => {
    void loadPageData(true);
  }, [
    workspaceId,
    filter,
    minimumConfidence,
  ]);

  useEffect(() => {
    function handleWorkspaceChange(
      event: Event,
    ) {
      const workspaceEvent =
        event as CustomEvent<string>;

      setWorkspaceId(
        workspaceEvent.detail ??
          getActiveWorkspaceId(),
      );

      setSelectedDecision(null);
      setTimeline(null);
      setEditing(false);
      setLoading(true);
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

  async function openDecision(
    decisionId: string,
  ) {
    if (!workspaceId) {
      return;
    }

    setLoadingDetail(true);
    setEditing(false);
    setError(null);

    try {
      const [detail, timelineData] =
        await Promise.all([
          getDecision(
            workspaceId,
            decisionId,
          ),
          getDecisionTimeline(
            workspaceId,
            decisionId,
          ),
        ]);

      setSelectedDecision(detail);
      setTimeline(timelineData);
      setEditState(createEditState(detail));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load decision",
      );
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleReview(
    status: DecisionStatus,
  ) {
    if (
      !workspaceId ||
      !selectedDecision
    ) {
      return;
    }

    setActiveAction("review");
    setError(null);

    try {
      await reviewDecision(
        workspaceId,
        selectedDecision.id,
        status,
      );

      setNotice(
        `Decision marked as ${status}.`,
      );

      await openDecision(
        selectedDecision.id,
      );

      await loadPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to review decision",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !workspaceId ||
      !selectedDecision ||
      !editState
    ) {
      return;
    }

    setActiveAction("save");
    setError(null);

    try {
      await updateDecision(
        workspaceId,
        selectedDecision.id,
        {
          title: editState.title.trim(),
          summary:
            editState.summary.trim() || null,
          decision_statement:
            editState.decisionStatement.trim(),
          reason:
            editState.reason.trim() || null,
          alternatives: parseLines(
            editState.alternatives,
          ),
          participants: parseLines(
            editState.participants,
          ),
          related_entities: parseLines(
            editState.relatedEntities,
          ),
          decision_date:
            editState.decisionDate
              ? new Date(
                  `${editState.decisionDate}T00:00:00Z`,
                ).toISOString()
              : null,
        },
      );

      setNotice("Decision updated.");
      setEditing(false);

      await openDecision(
        selectedDecision.id,
      );

      await loadPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update decision",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDelete() {
    if (
      !workspaceId ||
      !selectedDecision
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${selectedDecision.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    setActiveAction("delete");

    try {
      await deleteDecision(
        workspaceId,
        selectedDecision.id,
      );

      setSelectedDecision(null);
      setTimeline(null);
      setEditing(false);
      setNotice("Decision deleted.");

      await loadPageData();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete decision",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleGenerateTimeline() {
    if (
      !workspaceId ||
      !selectedDecision
    ) {
      return;
    }

    setActiveAction("timeline");
    setError(null);

    try {
      await generateDecisionTimeline(
        workspaceId,
        selectedDecision.id,
      );

      setNotice(
        "Timeline generation started. Refresh after the worker finishes.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate timeline",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function refreshTimeline() {
    if (
      !workspaceId ||
      !selectedDecision
    ) {
      return;
    }

    setActiveAction("refresh-timeline");

    try {
      const timelineData =
        await getDecisionTimeline(
          workspaceId,
          selectedDecision.id,
        );

      setTimeline(timelineData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to refresh timeline",
      );
    } finally {
      setActiveAction(null);
    }
  }

  const filteredDecisions = useMemo(() => {
    const normalized =
      searchTerm.trim().toLowerCase();

    if (!normalized) {
      return decisions;
    }

    return decisions.filter((decision) =>
      [
        decision.title,
        decision.summary ?? "",
        decision.reason ?? "",
        decision.decision_statement,
      ].some((value) =>
        value
          .toLowerCase()
          .includes(normalized),
      ),
    );
  }, [decisions, searchTerm]);

  if (!workspaceId) {
    return (
      <div className="page decisions-page">
        <div className="empty-state large">
          <GitBranch size={40} />
          <h1>No active workspace</h1>
          <p>
            Select a workspace before reviewing
            extracted decisions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page decisions-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Human-in-the-loop review
          </p>

          <h1>Decision Explorer</h1>

          <p className="page-description">
            Validate AI-extracted decisions,
            inspect evidence, and reconstruct the
            timeline behind organizational change.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void loadPageData(true)
          }
        >
          <RefreshCw size={17} />
          Refresh
        </button>
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

      {notice && (
        <div className="page-notice">
          <CheckCircle2 size={17} />
          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <section className="decision-stat-grid">
        <article>
          <span>Total decisions</span>
          <strong>{stats?.total ?? 0}</strong>
        </article>

        <article>
          <span>Needs review</span>
          <strong>
            {stats?.candidates ?? 0}
          </strong>
        </article>

        <article>
          <span>Approved</span>
          <strong>
            {stats?.approved ?? 0}
          </strong>
        </article>

        <article>
          <span>Average confidence</span>
          <strong>
            {formatConfidence(
              stats?.average_confidence ?? 0,
            )}
          </strong>
        </article>
      </section>

      <section className="decision-toolbar">
        <div className="decision-filter-tabs">
          {(
            [
              "all",
              "candidate",
              "approved",
              "rejected",
            ] as DecisionFilter[]
          ).map((item) => (
            <button
              key={item}
              type="button"
              className={
                filter === item
                  ? "active"
                  : ""
              }
              onClick={() => setFilter(item)}
            >
              {item === "all"
                ? "All"
                : item}
            </button>
          ))}
        </div>

        <div className="decision-toolbar-right">
          <label className="confidence-filter">
            <span>
              Confidence ≥{" "}
              {Math.round(
                minimumConfidence * 100,
              )}
              %
            </span>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minimumConfidence}
              onChange={(event) =>
                setMinimumConfidence(
                  Number(event.target.value),
                )
              }
            />
          </label>

          <div className="search-field">
            <Search size={16} />

            <input
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value,
                )
              }
              placeholder="Search decisions"
            />
          </div>
        </div>
      </section>

      <section className="decision-explorer-grid">
        <div className="decision-list-panel">
          {loading && (
            <div className="loading-list">
              <LoaderCircle
                size={21}
                className="spin"
              />
              Loading decisions...
            </div>
          )}

          {!loading &&
            filteredDecisions.length === 0 && (
            <div className="empty-state">
              <GitBranch size={32} />
              <h3>No decisions found</h3>
              <p>
                Extract decisions from a completed
                document or change the current
                filters.
              </p>
            </div>
          )}

          {!loading &&
            filteredDecisions.map(
              (decision) => (
                <button
                  key={decision.id}
                  type="button"
                  className={
                    selectedDecision?.id ===
                    decision.id
                      ? "decision-list-item active"
                      : "decision-list-item"
                  }
                  onClick={() =>
                    void openDecision(
                      decision.id,
                    )
                  }
                >
                  <div className="decision-list-heading">
                    <span
                      className={`decision-status-badge ${decision.status}`}
                    >
                      {statusIcon(
                        decision.status,
                      )}
                      {decision.status}
                    </span>

                    <span className="decision-confidence">
                      {formatConfidence(
                        decision.confidence_score,
                      )}
                    </span>
                  </div>

                  <strong>{decision.title}</strong>

                  <p>
                    {decision.summary ??
                      decision.decision_statement}
                  </p>

                  <div className="decision-list-footer">
                    <span>
                      <CalendarDays size={13} />
                      {formatDate(
                        decision.decision_date,
                      )}
                    </span>

                    <ChevronRight size={16} />
                  </div>
                </button>
              ),
            )}
        </div>

        <div className="decision-detail-panel">
          {loadingDetail && (
            <div className="loading-list">
              <LoaderCircle
                size={22}
                className="spin"
              />
              Loading decision...
            </div>
          )}

          {!loadingDetail &&
            !selectedDecision && (
            <div className="decision-detail-empty">
              <Sparkles size={35} />
              <h2>Select a decision</h2>
              <p>
                Review its reason, evidence,
                participants, alternatives, and
                timeline.
              </p>
            </div>
          )}

          {!loadingDetail &&
            selectedDecision &&
            !editing && (
            <>
              <div className="decision-detail-header">
                <div>
                  <div className="detail-status-row">
                    <span
                      className={`decision-status-badge ${selectedDecision.status}`}
                    >
                      {statusIcon(
                        selectedDecision.status,
                      )}
                      {selectedDecision.status}
                    </span>

                    <span>
                      Confidence{" "}
                      {formatConfidence(
                        selectedDecision.confidence_score,
                      )}
                    </span>
                  </div>

                  <h2>
                    {selectedDecision.title}
                  </h2>

                  <p>
                    {selectedDecision.summary ??
                      selectedDecision.decision_statement}
                  </p>
                </div>

                <div className="detail-actions">
                  <button
                    type="button"
                    className="icon-button"
                    title="Edit decision"
                    onClick={() => {
                      setEditState(
                        createEditState(
                          selectedDecision,
                        ),
                      );
                      setEditing(true);
                    }}
                  >
                    <Edit3 size={17} />
                  </button>

                  <button
                    type="button"
                    className="danger-icon-button"
                    title="Delete decision"
                    disabled={
                      activeAction === "delete"
                    }
                    onClick={() =>
                      void handleDelete()
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>

              {selectedDecision.status ===
                "candidate" && (
                <div className="review-action-bar">
                  <div>
                    <strong>
                      Review required
                    </strong>
                    <p>
                      Confirm or reject this
                      AI-extracted decision.
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="reject-button"
                      disabled={
                        activeAction === "review"
                      }
                      onClick={() =>
                        void handleReview(
                          "rejected",
                        )
                      }
                    >
                      <XCircle size={16} />
                      Reject
                    </button>

                    <button
                      type="button"
                      className="approve-button"
                      disabled={
                        activeAction === "review"
                      }
                      onClick={() =>
                        void handleReview(
                          "approved",
                        )
                      }
                    >
                      <CheckCircle2 size={16} />
                      Approve
                    </button>
                  </div>
                </div>
              )}

              <div className="decision-section-grid">
                <section className="decision-info-card">
                  <span className="metadata-label">
                    Decision
                  </span>

                  <p>
                    {
                      selectedDecision.decision_statement
                    }
                  </p>
                </section>

                <section className="decision-info-card">
                  <span className="metadata-label">
                    Reason
                  </span>

                  <p>
                    {selectedDecision.reason ??
                      "No reason documented."}
                  </p>
                </section>
              </div>

              <div className="decision-section-grid">
                <section className="decision-info-card">
                  <span className="metadata-label">
                    Alternatives
                  </span>

                  {selectedDecision.alternatives
                    .length > 0 ? (
                    <ul>
                      {selectedDecision.alternatives.map(
                        (item) => (
                          <li key={item}>
                            {item}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p>
                      No alternatives documented.
                    </p>
                  )}
                </section>

                <section className="decision-info-card">
                  <span className="metadata-label">
                    Participants
                  </span>

                  <div className="entity-chip-list">
                    {selectedDecision.participants
                      .length > 0 ? (
                      selectedDecision.participants.map(
                        (item) => (
                          <span key={item}>
                            <UserRound size={13} />
                            {item}
                          </span>
                        ),
                      )
                    ) : (
                      <p>
                        No participants documented.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <section className="decision-info-card">
                <span className="metadata-label">
                  Related entities
                </span>

                <div className="entity-chip-list">
                  {selectedDecision.related_entities
                    .length > 0 ? (
                    selectedDecision.related_entities.map(
                      (item) => (
                        <span key={item}>
                          {item}
                        </span>
                      ),
                    )
                  ) : (
                    <p>
                      No related entities documented.
                    </p>
                  )}
                </div>
              </section>

              <section className="decision-info-card evidence-section">
                <div className="section-heading">
                  <div>
                    <span className="metadata-label">
                      Supporting evidence
                    </span>
                    <h3>
                      {
                        selectedDecision.evidence
                          .length
                      }{" "}
                      linked sources
                    </h3>
                  </div>
                </div>

                {selectedDecision.evidence
                  .length === 0 && (
                  <p>
                    No linked evidence is available.
                  </p>
                )}

                <div className="evidence-list">
                  {selectedDecision.evidence.map(
                    (evidence) => (
                      <article
                        key={evidence.id}
                        className="evidence-card"
                      >
                        <div className="evidence-card-header">
                          <FileText size={17} />

                          <div>
                            <strong>
                              {
                                evidence.document_name
                              }
                            </strong>

                            <small>
                              {evidence.page_number
                                ? `Page ${evidence.page_number}`
                                : `Chunk ${evidence.chunk_index}`}
                              {" · "}
                              relevance{" "}
                              {formatConfidence(
                                evidence.relevance_score,
                              )}
                            </small>
                          </div>
                        </div>

                        <p>{evidence.content}</p>

                        {evidence.explanation && (
                          <small className="evidence-explanation">
                            {
                              evidence.explanation
                            }
                          </small>
                        )}
                      </article>
                    ),
                  )}
                </div>
              </section>

              <section className="decision-info-card timeline-section">
                <div className="section-heading">
                  <div>
                    <span className="metadata-label">
                      Decision timeline
                    </span>

                    <h3>
                      {timeline?.event_count ?? 0}{" "}
                      events
                    </h3>
                  </div>

                  <div className="timeline-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        activeAction ===
                        "refresh-timeline"
                      }
                      onClick={() =>
                        void refreshTimeline()
                      }
                    >
                      <RefreshCw size={15} />
                      Refresh
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      disabled={
                        activeAction ===
                        "timeline"
                      }
                      onClick={() =>
                        void handleGenerateTimeline()
                      }
                    >
                      <Sparkles size={15} />
                      Generate
                    </button>
                  </div>
                </div>

                {!timeline ||
                timeline.events.length === 0 ? (
                  <div className="timeline-empty">
                    No timeline events yet.
                  </div>
                ) : (
                  <div className="decision-timeline">
                    {timeline.events.map(
                      (
                        event: DecisionEvent,
                      ) => (
                        <article
                          key={event.id}
                          className="timeline-event"
                        >
                          <div className="timeline-event-icon">
                            {timelineEventIcon(
                              event.event_type,
                            )}
                          </div>

                          <div>
                            <div className="timeline-event-heading">
                              <strong>
                                {event.title}
                              </strong>

                              <span>
                                {formatDate(
                                  event.event_date,
                                )}
                              </span>
                            </div>

                            <small>
                              {event.event_type}
                            </small>

                            {event.description && (
                              <p>
                                {
                                  event.description
                                }
                              </p>
                            )}
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {!loadingDetail &&
            selectedDecision &&
            editing &&
            editState && (
            <form
              className="decision-edit-form"
              onSubmit={handleSave}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    Human correction
                  </p>
                  <h2>Edit decision</h2>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    setEditing(false)
                  }
                >
                  <X size={17} />
                </button>
              </div>

              <label>
                <span>Title</span>
                <input
                  value={editState.title}
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      title:
                        event.target.value,
                    })
                  }
                  required
                />
              </label>

              <label>
                <span>Summary</span>
                <textarea
                  value={editState.summary}
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      summary:
                        event.target.value,
                    })
                  }
                  rows={3}
                />
              </label>

              <label>
                <span>
                  Decision statement
                </span>
                <textarea
                  value={
                    editState.decisionStatement
                  }
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      decisionStatement:
                        event.target.value,
                    })
                  }
                  rows={4}
                  required
                />
              </label>

              <label>
                <span>Reason</span>
                <textarea
                  value={editState.reason}
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      reason:
                        event.target.value,
                    })
                  }
                  rows={4}
                />
              </label>

              <div className="decision-edit-grid">
                <label>
                  <span>
                    Alternatives, one per line
                  </span>
                  <textarea
                    value={
                      editState.alternatives
                    }
                    onChange={(event) =>
                      setEditState({
                        ...editState,
                        alternatives:
                          event.target.value,
                      })
                    }
                    rows={5}
                  />
                </label>

                <label>
                  <span>
                    Participants, one per line
                  </span>
                  <textarea
                    value={
                      editState.participants
                    }
                    onChange={(event) =>
                      setEditState({
                        ...editState,
                        participants:
                          event.target.value,
                      })
                    }
                    rows={5}
                  />
                </label>
              </div>

              <label>
                <span>
                  Related entities, one per line
                </span>
                <textarea
                  value={
                    editState.relatedEntities
                  }
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      relatedEntities:
                        event.target.value,
                    })
                  }
                  rows={4}
                />
              </label>

              <label>
                <span>Decision date</span>
                <input
                  type="date"
                  value={
                    editState.decisionDate
                  }
                  onChange={(event) =>
                    setEditState({
                      ...editState,
                      decisionDate:
                        event.target.value,
                    })
                  }
                />
              </label>

              <div className="edit-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setEditing(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    activeAction === "save"
                  }
                >
                  <Save size={16} />
                  Save changes
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
