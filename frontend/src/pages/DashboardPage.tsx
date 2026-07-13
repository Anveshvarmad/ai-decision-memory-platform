import {
  AlertCircle,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  GitBranch,
  LoaderCircle,
  MessageSquareText,
  Network,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { useNavigate } from "react-router";

import {
  createWorkspace,
  getConversations,
  getDecisions,
  getDecisionStats,
  getDocuments,
  getWorkspaces,
  getWorkspaceGraph,
} from "../lib/api";

import {
  ACTIVE_WORKSPACE_KEY,
  setActiveWorkspaceId,
} from "../lib/workspace";

import type {
  Conversation,
  Decision,
  DecisionStats,
  DocumentRecord,
  Workspace,
  WorkspaceGraph,
} from "../types/api";

function formatDate(value: string | null): string {
  if (!value) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function statusLabel(status: string): string {
  if (status === "completed") {
    return "Ready";
  }

  if (status === "embedding") {
    return "Embedding";
  }

  if (status === "processing") {
    return "Extracting";
  }

  if (status === "pending") {
    return "Queued";
  }

  return "Failed";
}

export function DashboardPage() {
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] =
    useState<Workspace[]>([]);

  const [selectedWorkspace, setSelectedWorkspace] =
    useState<string | null>(
      localStorage.getItem(ACTIVE_WORKSPACE_KEY),
    );

  const [documents, setDocuments] =
    useState<DocumentRecord[]>([]);

  const [decisions, setDecisions] =
    useState<Decision[]>([]);

  const [decisionStats, setDecisionStats] =
    useState<DecisionStats | null>(null);

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [graph, setGraph] =
    useState<WorkspaceGraph>({
      nodes: [],
      edges: [],
    });

  const [newWorkspaceName, setNewWorkspaceName] =
    useState("");

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  function selectWorkspace(id: string) {
    setSelectedWorkspace(id);
    setActiveWorkspaceId(id);
  }

  const loadWorkspaceData = useCallback(
    async (
      workspaceId: string,
      showLoader = false,
    ) => {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [
          documentData,
          decisionData,
          statsData,
          conversationData,
          graphData,
        ] = await Promise.all([
          getDocuments(workspaceId),
          getDecisions(workspaceId, "all", 0),
          getDecisionStats(workspaceId),
          getConversations(workspaceId),
          getWorkspaceGraph(workspaceId),
        ]);

        setDocuments(documentData);
        setDecisions(decisionData);
        setDecisionStats(statsData);
        setConversations(conversationData);
        setGraph(graphData);
        setError(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load dashboard data",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    async function initializeDashboard() {
      setLoading(true);

      try {
        const workspaceData =
          await getWorkspaces();

        setWorkspaces(workspaceData);

        let workspaceId =
          selectedWorkspace;

        const selectedStillExists =
          workspaceData.some(
            (workspace) =>
              workspace.id === workspaceId,
          );

        if (
          !workspaceId ||
          !selectedStillExists
        ) {
          workspaceId =
            workspaceData[0]?.id ?? null;
        }

        if (workspaceId) {
          selectWorkspace(workspaceId);

          await loadWorkspaceData(
            workspaceId,
            false,
          );
        } else {
          setLoading(false);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to initialize dashboard",
        );

        setLoading(false);
      }
    }

    void initializeDashboard();
  }, []);

  useEffect(() => {
    if (!selectedWorkspace) {
      return;
    }

    void loadWorkspaceData(
      selectedWorkspace,
      true,
    );
  }, [selectedWorkspace, loadWorkspaceData]);

  useEffect(() => {
    const activeDocuments = documents.some(
      (document) =>
        [
          "pending",
          "processing",
          "embedding",
        ].includes(document.status),
    );

    if (
      !selectedWorkspace ||
      !activeDocuments
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadWorkspaceData(
        selectedWorkspace,
      );
    }, 4000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    documents,
    selectedWorkspace,
    loadWorkspaceData,
  ]);

  async function handleCreateWorkspace(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const name = newWorkspaceName.trim();

    if (!name) {
      return;
    }

    try {
      const workspace = await createWorkspace({
        name,
      });

      setWorkspaces((current) => [
        workspace,
        ...current,
      ]);

      selectWorkspace(workspace.id);
      setNewWorkspaceName("");
      setShowCreateForm(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create workspace",
      );
    }
  }

  const activeWorkspace = workspaces.find(
    (workspace) =>
      workspace.id === selectedWorkspace,
  );

  const completedDocuments =
    documents.filter(
      (document) =>
        document.status === "completed",
    ).length;

  const processingDocuments =
    documents.filter((document) =>
      [
        "pending",
        "processing",
        "embedding",
      ].includes(document.status),
    );

  const recentDecisions = useMemo(
    () =>
      [...decisions]
        .sort(
          (left, right) =>
            new Date(
              right.updated_at,
            ).getTime() -
            new Date(
              left.updated_at,
            ).getTime(),
        )
        .slice(0, 3),
    [decisions],
  );

  const recentDocuments = useMemo(
    () =>
      [...documents]
        .sort(
          (left, right) =>
            new Date(
              right.updated_at,
            ).getTime() -
            new Date(
              left.updated_at,
            ).getTime(),
        )
        .slice(0, 4),
    [documents],
  );

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Decision intelligence workspace
          </p>

          <h1>
            {activeWorkspace?.name ??
              "Your workspace"}
          </h1>

          <p className="page-description">
            Search, review, and understand the
            reasoning behind organizational change.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={
              refreshing ||
              !selectedWorkspace
            }
            onClick={() => {
              if (selectedWorkspace) {
                void loadWorkspaceData(
                  selectedWorkspace,
                );
              }
            }}
          >
            {refreshing ? (
              <LoaderCircle
                size={17}
                className="spin"
              />
            ) : (
              <RefreshCw size={17} />
            )}
            Refresh
          </button>

          <button
            className="primary-button"
            type="button"
            onClick={() =>
              setShowCreateForm(
                (current) => !current,
              )
            }
          >
            <Plus size={18} />
            New workspace
          </button>
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
            ×
          </button>
        </div>
      )}

      {showCreateForm && (
        <form
          className="workspace-create-card"
          onSubmit={handleCreateWorkspace}
        >
          <div>
            <strong>Create a workspace</strong>

            <p>
              Workspaces isolate documents,
              decisions, members, and conversations.
            </p>
          </div>

          <input
            value={newWorkspaceName}
            onChange={(event) =>
              setNewWorkspaceName(
                event.target.value,
              )
            }
            placeholder="Example: Platform Engineering"
            minLength={2}
            required
          />

          <button
            type="submit"
            className="primary-button"
          >
            Create
          </button>
        </form>
      )}

      <section className="workspace-strip">
        <div className="section-heading">
          <div>
            <h2>Workspaces</h2>
            <p>
              Select your active knowledge space.
            </p>
          </div>
        </div>

        <div className="workspace-list">
          {workspaces.length === 0 &&
            !loading && (
              <div className="muted-card">
                No workspace exists yet.
              </div>
            )}

          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              className={
                workspace.id ===
                selectedWorkspace
                  ? "workspace-pill active"
                  : "workspace-pill"
              }
              onClick={() =>
                selectWorkspace(workspace.id)
              }
            >
              <span className="workspace-icon">
                {workspace.name
                  .slice(0, 1)
                  .toUpperCase()}
              </span>

              <span>
                <strong>
                  {workspace.name}
                </strong>

                <small>
                  {workspace.role ?? "member"}
                </small>
              </span>
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="dashboard-loading">
          <LoaderCircle
            size={24}
            className="spin"
          />
          Loading workspace intelligence...
        </div>
      ) : (
        <>
          <section className="stat-grid">
            <button
              type="button"
              className="stat-card dashboard-stat-button"
              onClick={() =>
                navigate("/app/documents")
              }
            >
              <div className="stat-icon">
                <FileText size={21} />
              </div>

              <span>Indexed documents</span>
              <strong>
                {completedDocuments}
              </strong>

              <small>
                {processingDocuments.length > 0
                  ? `${processingDocuments.length} processing`
                  : `${documents.length} total documents`}
              </small>
            </button>

            <button
              type="button"
              className="stat-card dashboard-stat-button"
              onClick={() =>
                navigate("/app/decisions")
              }
            >
              <div className="stat-icon">
                <GitBranch size={21} />
              </div>

              <span>Extracted decisions</span>

              <strong>
                {decisionStats?.total ?? 0}
              </strong>

              <small>
                {decisionStats?.candidates ?? 0}{" "}
                waiting for review
              </small>
            </button>

            <button
              type="button"
              className="stat-card dashboard-stat-button"
              onClick={() =>
                navigate("/app/graph")
              }
            >
              <div className="stat-icon">
                <Network size={21} />
              </div>

              <span>Connected entities</span>

              <strong>
                {graph.nodes.length}
              </strong>

              <small>
                {graph.edges.length} relationships
              </small>
            </button>

            <button
              type="button"
              className="stat-card dashboard-stat-button"
              onClick={() =>
                navigate("/app/chat")
              }
            >
              <div className="stat-icon">
                <MessageSquareText
                  size={21}
                />
              </div>

              <span>
                Decision conversations
              </span>

              <strong>
                {conversations.length}
              </strong>

              <small>
                Grounded in workspace evidence
              </small>
            </button>
          </section>

          <section className="dashboard-main-grid">
            <article className="panel dashboard-recent-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    Recent decisions
                  </p>

                  <h2>
                    Organizational decision memory
                  </h2>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  title="Open decisions"
                  onClick={() =>
                    navigate("/app/decisions")
                  }
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>

              {recentDecisions.length === 0 ? (
                <div className="dashboard-empty">
                  <GitBranch size={29} />

                  <p>
                    No decisions have been
                    extracted yet.
                  </p>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      navigate("/app/documents")
                    }
                  >
                    Upload documents
                  </button>
                </div>
              ) : (
                <div className="dashboard-decision-list">
                  {recentDecisions.map(
                    (decision) => (
                      <button
                        key={decision.id}
                        type="button"
                        className="dashboard-decision-row"
                        onClick={() =>
                          navigate(
                            "/app/decisions",
                          )
                        }
                      >
                        <div>
                          <span
                            className={`status-badge ${decision.status}`}
                          >
                            {decision.status}
                          </span>

                          <strong>
                            {decision.title}
                          </strong>

                          <p>
                            {decision.summary ??
                              decision.decision_statement}
                          </p>
                        </div>

                        <div className="dashboard-decision-meta">
                          <span>
                            {formatConfidence(
                              decision.confidence_score,
                            )}
                          </span>

                          <span>
                            {formatDate(
                              decision.decision_date,
                            )}
                          </span>

                          <ArrowUpRight
                            size={16}
                          />
                        </div>
                      </button>
                    ),
                  )}
                </div>
              )}
            </article>

            <article className="panel ask-card">
              <div className="ask-icon">
                <BrainCircuit size={26} />
              </div>

              <p className="eyebrow">
                Ask decision memory
              </p>

              <h2>
                What do you need to understand?
              </h2>

              <p>
                Search decisions, source evidence,
                people, incidents, and timelines.
              </p>

              <div className="search-preview">
                <Search size={18} />

                <span>
                  Why did we migrate to PostgreSQL?
                </span>
              </div>

              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  navigate("/app/chat")
                }
              >
                Open decision chat
                <ArrowUpRight size={17} />
              </button>
            </article>
          </section>

          <section className="dashboard-secondary-grid">
            <article className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    Document activity
                  </p>

                  <h2>Latest source files</h2>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    navigate("/app/documents")
                  }
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>

              {recentDocuments.length === 0 ? (
                <div className="dashboard-empty compact">
                  <FileText size={25} />
                  <p>No documents uploaded.</p>
                </div>
              ) : (
                <div className="dashboard-document-list">
                  {recentDocuments.map(
                    (document) => (
                      <div
                        key={document.id}
                        className="dashboard-document-row"
                      >
                        <div className="dashboard-document-icon">
                          <FileText size={17} />
                        </div>

                        <div>
                          <strong>
                            {
                              document.original_filename
                            }
                          </strong>

                          <small>
                            {statusLabel(
                              document.status,
                            )}
                          </small>
                        </div>

                        {document.status ===
                        "completed" ? (
                          <CheckCircle2
                            size={17}
                            className="dashboard-ready-icon"
                          />
                        ) : (
                          <span className="dashboard-progress-value">
                            {
                              document.processing_progress
                            }
                            %
                          </span>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </article>

            <article className="panel dashboard-health-panel">
              <p className="eyebrow">
                Workspace health
              </p>

              <h2>Review and retrieval readiness</h2>

              <div className="dashboard-health-list">
                <div>
                  <span>Approved decisions</span>
                  <strong>
                    {decisionStats?.approved ?? 0}
                  </strong>
                </div>

                <div>
                  <span>Rejected decisions</span>
                  <strong>
                    {decisionStats?.rejected ?? 0}
                  </strong>
                </div>

                <div>
                  <span>
                    Average confidence
                  </span>

                  <strong>
                    {formatConfidence(
                      decisionStats
                        ?.average_confidence ?? 0,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Graph relationships</span>
                  <strong>
                    {graph.edges.length}
                  </strong>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
