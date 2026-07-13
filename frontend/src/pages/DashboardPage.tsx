import {
  ArrowUpRight,
  BrainCircuit,
  FileText,
  GitBranch,
  MessageSquareText,
  Network,
  Plus,
  Search,
} from "lucide-react";

import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import { useNavigate } from "react-router";

import {
  createWorkspace,
  getWorkspaces,
} from "../lib/api";

import type { Workspace } from "../types/api";

import {
  ACTIVE_WORKSPACE_KEY,
  setActiveWorkspaceId,
} from "../lib/workspace";

export function DashboardPage() {
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] =
    useState<Workspace[]>([]);

  const [selectedWorkspace, setSelectedWorkspace] =
    useState<string | null>(
      localStorage.getItem(ACTIVE_WORKSPACE_KEY),
    );

  const [newWorkspaceName, setNewWorkspaceName] =
    useState("");

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    getWorkspaces()
      .then((data) => {
        setWorkspaces(data);

        if (!selectedWorkspace && data[0]) {
          selectWorkspace(data[0].id);
        }
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load workspaces",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function selectWorkspace(id: string) {
    setSelectedWorkspace(id);
    setActiveWorkspaceId(id);
  }

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
      </header>

      {error && (
        <div className="page-error">{error}</div>
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
            <p>Select your active knowledge space.</p>
          </div>
        </div>

        <div className="workspace-list">
          {loading && (
            <div className="muted-card">
              Loading workspaces...
            </div>
          )}

          {!loading &&
            workspaces.map((workspace) => (
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
                  <strong>{workspace.name}</strong>
                  <small>
                    {workspace.role ?? "member"}
                  </small>
                </span>
              </button>
            ))}
        </div>
      </section>

      <section className="stat-grid">
        <article className="stat-card">
          <div className="stat-icon">
            <FileText size={21} />
          </div>
          <span>Indexed documents</span>
          <strong>1</strong>
          <small>Ready for retrieval</small>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <GitBranch size={21} />
          </div>
          <span>Extracted decisions</span>
          <strong>1</strong>
          <small>1 approved</small>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <Network size={21} />
          </div>
          <span>Connected entities</span>
          <strong>7</strong>
          <small>People, systems, and evidence</small>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <MessageSquareText size={21} />
          </div>
          <span>Decision conversations</span>
          <strong>4</strong>
          <small>Grounded in evidence</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel recent-decision">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                Recent decision
              </p>
              <h2>
                MongoDB to PostgreSQL migration
              </h2>
            </div>

            <button
              type="button"
              className="icon-button"
            >
              <ArrowUpRight size={19} />
            </button>
          </div>

          <p>
            The order-management service will move
            to PostgreSQL to improve transactional
            consistency and reporting performance.
          </p>

          <div className="decision-meta">
            <span className="status-badge approved">
              Approved
            </span>

            <span>Confidence 94%</span>
            <span>March 18, 2026</span>
          </div>

          <div className="timeline-preview">
            <div>
              <span />
              <strong>Incident detected</strong>
              <small>March 4</small>
            </div>

            <div>
              <span />
              <strong>Options reviewed</strong>
              <small>March 18</small>
            </div>

            <div>
              <span />
              <strong>Migration approved</strong>
              <small>March 18</small>
            </div>

            <div>
              <span />
              <strong>Target rollout</strong>
              <small>April 15</small>
            </div>
          </div>
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
    </div>
  );
}
