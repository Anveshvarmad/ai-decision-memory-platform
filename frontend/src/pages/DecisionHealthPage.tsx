import {
  useEffect,
  useState,
} from "react";

import {
  ACTIVE_WORKSPACE_KEY,
} from "../lib/workspace";



interface DecisionHealthIssue {
  decision_id: string;
  title: string;
  issue_type: string;
  severity: string;
  summary: string;
  status: string;
  age_days: number | null;
  evidence_count: number;
}


interface DecisionHealthResponse {
  workspace_id: string;
  health_score: number;
  grade: string;
  total_decisions: number;
  healthy_decisions: number;
  decisions_needing_review: number;
  counts: {
    stale: number;
    missing_evidence: number;
    conflicts: number;
    reversed: number;
    frequent_reversals: number;
  };
  issues: DecisionHealthIssue[];
  recommendations: string[];
}


const RAW_API_URL = (
  import.meta.env.VITE_API_URL
  || "http://localhost:8000/api"
).replace(/\/+$/, "");


const API_ROOT =
  RAW_API_URL.endsWith("/api")
    ? RAW_API_URL
    : `${RAW_API_URL}/api`;


const TOKEN_KEY =
  "decision_memory_token";


function authHeaders(): HeadersInit {
  const token =
    window.localStorage.getItem(
      TOKEN_KEY,
    );

  if (!token) {
    return {
      Accept: "application/json",
    };
  }

  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}


function extractWorkspaceId(
  value: unknown,
): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = extractWorkspaceId(item);

      if (id) {
        return id;
      }
    }

    return null;
  }

  if (
    value
    && typeof value === "object"
  ) {
    const record =
      value as Record<string, unknown>;

    for (const key of [
      "workspace_id",
      "active_workspace_id",
      "current_workspace_id",
      "id",
    ]) {
      const candidate = record[key];

      if (
        typeof candidate === "string"
        && candidate
      ) {
        return candidate;
      }
    }

    for (const key of [
      "items",
      "data",
      "results",
      "workspaces",
    ]) {
      const nested =
        extractWorkspaceId(record[key]);

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}


async function findWorkspaceId():
Promise<string | null> {
  const storedWorkspaceId =
    window.localStorage.getItem(
      ACTIVE_WORKSPACE_KEY,
    );

  if (storedWorkspaceId) {
    return storedWorkspaceId.replace(
      /^"|"$/g,
      "",
    );
  }

  const response = await fetch(
    `${API_ROOT}/workspaces`,
    {
      headers: authHeaders(),
    },
  );

  if (response.status === 401) {
    throw new Error(
      "Your login session is missing or expired. "
      + "Sign out and sign in again.",
    );
  }

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `Workspace request failed: `
      + `${response.status} `
      + `${response.statusText}`
      + (
        detail
          ? `: ${detail}`
          : ""
      ),
    );
  }

  const payload =
    await response.json();

  const workspaceId =
    extractWorkspaceId(payload);

  if (workspaceId) {
    window.localStorage.setItem(
      ACTIVE_WORKSPACE_KEY,
      workspaceId,
    );
  }

  return workspaceId;
}


async function fetchDecisionHealth(
  workspaceId: string,
  staleAfterDays: number,
): Promise<DecisionHealthResponse> {
  const encodedWorkspaceId =
    encodeURIComponent(workspaceId);

  const url =
    `${API_ROOT}/workspaces/`
    + `${encodedWorkspaceId}`
    + "/analytics/decision-health"
    + `?stale_after_days=${staleAfterDays}`;

  const response = await fetch(
    url,
    {
      headers: authHeaders(),
    },
  );

  if (response.status === 401) {
    throw new Error(
      "Your login session is missing or expired. "
      + "Sign out and sign in again.",
    );
  }

  if (!response.ok) {
    const detail =
      await response.text();

    throw new Error(
      `Decision health request failed: `
      + `${response.status} `
      + `${response.statusText}`
      + (
        detail
          ? `: ${detail}`
          : ""
      ),
    );
  }

  return await response.json();
}


export function DecisionHealthPage() {
  const [
    data,
    setData,
  ] =
    useState<DecisionHealthResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    workspaceId,
    setWorkspaceId,
  ] = useState("");

  const [
    manualWorkspaceId,
    setManualWorkspaceId,
  ] = useState("");

  const [
    staleAfterDays,
    setStaleAfterDays,
  ] = useState(180);


  async function load(
    explicitWorkspaceId?: string,
  ) {
    setLoading(true);
    setError(null);

    try {
      const resolvedWorkspaceId =
        explicitWorkspaceId
        || workspaceId
        || await findWorkspaceId();

      if (!resolvedWorkspaceId) {
        throw new Error(
          "No active workspace was found. "
          + "Enter a workspace ID below.",
        );
      }

      setWorkspaceId(resolvedWorkspaceId);

      window.localStorage.setItem(
        "active_workspace_id",
        resolvedWorkspaceId,
      );

      const result =
        await fetchDecisionHealth(
          resolvedWorkspaceId,
          staleAfterDays,
        );

      setData(result);
    } catch (loadError) {
      setData(null);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Decision health could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void load();
  }, [staleAfterDays]);


  const cards = data
    ? [
        [
          "Total decisions",
          data.total_decisions,
        ],
        [
          "Healthy",
          data.healthy_decisions,
        ],
        [
          "Needs review",
          data.decisions_needing_review,
        ],
        [
          "Missing evidence",
          data.counts.missing_evidence,
        ],
        [
          "Stale",
          data.counts.stale,
        ],
        [
          "Conflicts",
          data.counts.conflicts,
        ],
      ]
    : [];


  return (
    <main
      style={{
        padding: "28px",
        color: "#f7f8fc",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 7px",
              color: "#9588ef",
              fontWeight: 700,
            }}
          >
            Phase 17B
          </p>

          <h1 style={{ margin: 0 }}>
            Decision Health
          </h1>

          <p
            style={{
              maxWidth: "680px",
              color: "#9ea6b8",
              lineHeight: 1.6,
            }}
          >
            Monitor stale, unsupported,
            conflicting, and reversed decisions.
          </p>
        </div>

        <div>
          <select
            value={staleAfterDays}
            onChange={(event) => {
              setStaleAfterDays(
                Number(event.target.value),
              );
            }}
            style={{
              padding: "10px",
              borderRadius: "8px",
              background: "#151a28",
              color: "#ffffff",
            }}
          >
            <option value={90}>
              Stale after 90 days
            </option>

            <option value={180}>
              Stale after 180 days
            </option>

            <option value={365}>
              Stale after 365 days
            </option>
          </select>
        </div>
      </header>

      {error && (
        <section
          style={{
            padding: "18px",
            marginBottom: "18px",
            border: "1px solid #824753",
            borderRadius: "12px",
            background: "#28161d",
          }}
        >
          <strong>
            Unable to load decision health
          </strong>

          <p>{error}</p>

          <form
            onSubmit={(event) => {
              event.preventDefault();

              void load(
                manualWorkspaceId.trim(),
              );
            }}
          >
            <input
              value={manualWorkspaceId}
              onChange={(event) => {
                setManualWorkspaceId(
                  event.target.value,
                );
              }}
              placeholder="Workspace ID"
              style={{
                padding: "10px",
                minWidth: "300px",
              }}
            />

            <button
              type="submit"
              style={{
                marginLeft: "8px",
                padding: "10px 15px",
              }}
            >
              Load
            </button>
          </form>
        </section>
      )}

      {loading && (
        <p>Analyzing workspace decisions…</p>
      )}

      {data && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 0.7fr) "
                + "minmax(300px, 2fr)",
              gap: "18px",
              marginBottom: "18px",
            }}
          >
            <article
              style={{
                padding: "24px",
                border: "1px solid #30374c",
                borderRadius: "14px",
                background: "#151a28",
              }}
            >
              <span
                style={{ color: "#9ea6b8" }}
              >
                Health score
              </span>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "56px",
                  fontWeight: 800,
                }}
              >
                {data.health_score}
                <small
                  style={{
                    marginLeft: "12px",
                    fontSize: "25px",
                    color: "#9588ef",
                  }}
                >
                  {data.grade}
                </small>
              </div>
            </article>

            <article
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,"
                  + "minmax(140px,1fr))",
                gap: "10px",
              }}
            >
              {cards.map(([label, value]) => (
                <div
                  key={String(label)}
                  style={{
                    padding: "16px",
                    border:
                      "1px solid #2d3448",
                    borderRadius: "11px",
                    background: "#111621",
                  }}
                >
                  <span
                    style={{
                      color: "#929bad",
                      fontSize: "13px",
                    }}
                  >
                    {label}
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginTop: "8px",
                      fontSize: "24px",
                    }}
                  >
                    {value}
                  </strong>
                </div>
              ))}
            </article>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0,2fr) "
                + "minmax(250px,0.8fr)",
              gap: "18px",
            }}
          >
            <article
              style={{
                border: "1px solid #2d3448",
                borderRadius: "14px",
                background: "#111621",
                overflow: "hidden",
              }}
            >
              <h2
                style={{
                  padding: "18px",
                  margin: 0,
                  borderBottom:
                    "1px solid #2d3448",
                }}
              >
                Decisions requiring review
              </h2>

              {data.issues.length === 0 && (
                <p
                  style={{ padding: "20px" }}
                >
                  No health issues were detected.
                </p>
              )}

              {data.issues.map(
                (issue, index) => (
                  <div
                    key={
                      issue.decision_id
                      + issue.issue_type
                      + index
                    }
                    style={{
                      padding: "18px",
                      borderBottom:
                        "1px solid #252b3c",
                    }}
                  >
                    <strong>
                      {issue.title}
                    </strong>

                    <p
                      style={{
                        color: "#aab2c3",
                      }}
                    >
                      {issue.summary}
                    </p>

                    <small
                      style={{
                        color: "#858fa4",
                      }}
                    >
                      {issue.issue_type}
                      {" · "}
                      {issue.severity}
                      {" · evidence: "}
                      {issue.evidence_count}
                    </small>
                  </div>
                ),
              )}
            </article>

            <aside
              style={{
                padding: "18px",
                border: "1px solid #2d3448",
                borderRadius: "14px",
                background: "#111621",
              }}
            >
              <h2>Recommended actions</h2>

              <ol
                style={{
                  paddingLeft: "20px",
                  color: "#b1b8c8",
                  lineHeight: 1.7,
                }}
              >
                {data.recommendations.map(
                  (recommendation) => (
                    <li
                      key={recommendation}
                      style={{
                        marginBottom: "10px",
                      }}
                    >
                      {recommendation}
                    </li>
                  ),
                )}
              </ol>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}
