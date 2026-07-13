import {
  AlertCircle,
  BrainCircuit,
  Database,
  FileText,
  Filter,
  GitBranch,
  LoaderCircle,
  Network,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Trash2,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  buildDecisionGraph,
  clearWorkspaceGraph,
  getDecisions,
  getGraphNeighbors,
  getWorkspaceGraph,
} from "../lib/api";

import {
  getActiveWorkspaceId,
} from "../lib/workspace";

import type {
  Decision,
  GraphEdge,
  GraphNode,
  WorkspaceGraph,
} from "../types/api";

type GraphFilter =
  | "all"
  | "decision"
  | "person"
  | "technology"
  | "service"
  | "incident"
  | "document"
  | "project"
  | "concept";

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 620;

function entityIcon(entityType: string) {
  if (entityType === "decision") {
    return <GitBranch size={17} />;
  }

  if (entityType === "person") {
    return <UserRound size={17} />;
  }

  if (entityType === "technology") {
    return <Database size={17} />;
  }

  if (entityType === "service") {
    return <Server size={17} />;
  }

  if (entityType === "incident") {
    return <Zap size={17} />;
  }

  if (entityType === "document") {
    return <FileText size={17} />;
  }

  return <Network size={17} />;
}

function truncateLabel(
  value: string,
  length = 25,
): string {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length - 3)}...`;
}

function createGraphLayout(
  nodes: GraphNode[],
): PositionedNode[] {
  if (nodes.length === 0) {
    return [];
  }

  const decisionNodes = nodes.filter(
    (node) =>
      node.entity_type === "decision",
  );

  const remainingNodes = nodes.filter(
    (node) =>
      node.entity_type !== "decision",
  );

  const positioned: PositionedNode[] = [];

  if (decisionNodes.length === 1) {
    positioned.push({
      ...decisionNodes[0],
      x: GRAPH_WIDTH / 2,
      y: GRAPH_HEIGHT / 2,
    });
  } else {
    decisionNodes.forEach((node, index) => {
      const angle =
        (2 * Math.PI * index) /
        Math.max(decisionNodes.length, 1);

      positioned.push({
        ...node,
        x:
          GRAPH_WIDTH / 2 +
          Math.cos(angle) * 130,
        y:
          GRAPH_HEIGHT / 2 +
          Math.sin(angle) * 130,
      });
    });
  }

  remainingNodes.forEach((node, index) => {
    const angle =
      (2 * Math.PI * index) /
      Math.max(remainingNodes.length, 1);

    const ring =
      210 +
      (index % 3) * 45;

    positioned.push({
      ...node,
      x:
        GRAPH_WIDTH / 2 +
        Math.cos(angle) * ring,
      y:
        GRAPH_HEIGHT / 2 +
        Math.sin(angle) * ring,
    });
  });

  return positioned;
}

function getNodePosition(
  positionedNodes: PositionedNode[],
  id: string,
): PositionedNode | undefined {
  return positionedNodes.find(
    (node) => node.id === id,
  );
}

function formatRelationship(
  relationship: string,
): string {
  return relationship
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

export function GraphPage() {
  const [workspaceId, setWorkspaceId] =
    useState<string | null>(
      getActiveWorkspaceId(),
    );

  const [graph, setGraph] =
    useState<WorkspaceGraph>({
      nodes: [],
      edges: [],
    });

  const [decisions, setDecisions] =
    useState<Decision[]>([]);

  const [selectedNode, setSelectedNode] =
    useState<GraphNode | null>(null);

  const [neighborGraph, setNeighborGraph] =
    useState<WorkspaceGraph | null>(null);

  const [filter, setFilter] =
    useState<GraphFilter>("all");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedDecisionId, setSelectedDecisionId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingNeighbors, setLoadingNeighbors] =
    useState(false);

  const [activeAction, setActiveAction] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const loadGraph = useCallback(
    async (showLoader = false) => {
      if (!workspaceId) {
        setGraph({
          nodes: [],
          edges: [],
        });
        setLoading(false);
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      try {
        const [graphData, decisionData] =
          await Promise.all([
            getWorkspaceGraph(
              workspaceId,
              filter,
            ),
            getDecisions(
              workspaceId,
              "all",
              0,
            ),
          ]);

        setGraph(graphData);
        setDecisions(decisionData);
        setError(null);

        if (
          selectedNode &&
          !graphData.nodes.some(
            (node) =>
              node.id === selectedNode.id,
          )
        ) {
          setSelectedNode(null);
          setNeighborGraph(null);
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load graph",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      workspaceId,
      filter,
      selectedNode,
    ],
  );

  useEffect(() => {
    void loadGraph(true);
  }, [
    workspaceId,
    filter,
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

      setGraph({
        nodes: [],
        edges: [],
      });

      setSelectedNode(null);
      setNeighborGraph(null);
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

  async function handleSelectNode(
    node: GraphNode,
  ) {
    if (!workspaceId) {
      return;
    }

    setSelectedNode(node);
    setLoadingNeighbors(true);
    setError(null);

    try {
      const data = await getGraphNeighbors(
        workspaceId,
        node.id,
      );

      setNeighborGraph(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load graph neighbors",
      );
    } finally {
      setLoadingNeighbors(false);
    }
  }

  async function handleBuildGraph() {
    if (
      !workspaceId ||
      !selectedDecisionId
    ) {
      setError(
        "Select a decision before building the graph.",
      );
      return;
    }

    setActiveAction("build");
    setError(null);

    try {
      const result = await buildDecisionGraph(
        workspaceId,
        selectedDecisionId,
      );

      setNotice(
        `Graph updated: ${result.created_entities} entities and ${result.created_relationships} relationships created.`,
      );

      await loadGraph();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to build decision graph",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleClearGraph() {
    if (!workspaceId) {
      return;
    }

    const confirmed = window.confirm(
      "Clear every graph node and relationship in this workspace?",
    );

    if (!confirmed) {
      return;
    }

    setActiveAction("clear");
    setError(null);

    try {
      await clearWorkspaceGraph(
        workspaceId,
      );

      setGraph({
        nodes: [],
        edges: [],
      });

      setSelectedNode(null);
      setNeighborGraph(null);
      setNotice("Workspace graph cleared.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to clear graph",
      );
    } finally {
      setActiveAction(null);
    }
  }

  const visibleNodes = useMemo(() => {
    const normalized =
      searchTerm.trim().toLowerCase();

    if (!normalized) {
      return graph.nodes;
    }

    return graph.nodes.filter((node) =>
      node.label
        .toLowerCase()
        .includes(normalized),
    );
  }, [graph.nodes, searchTerm]);

  const visibleNodeIds = useMemo(
    () =>
      new Set(
        visibleNodes.map((node) => node.id),
      ),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.source) &&
          visibleNodeIds.has(edge.target),
      ),
    [
      graph.edges,
      visibleNodeIds,
    ],
  );

  const positionedNodes = useMemo(
    () => createGraphLayout(visibleNodes),
    [visibleNodes],
  );

  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    graph.nodes.forEach((node) => {
      counts[node.entity_type] =
        (counts[node.entity_type] ?? 0) + 1;
    });

    return counts;
  }, [graph.nodes]);

  const selectedRelationships = useMemo(() => {
    if (!selectedNode) {
      return [];
    }

    const sourceGraph =
      neighborGraph ?? graph;

    return sourceGraph.edges.filter(
      (edge) =>
        edge.source === selectedNode.id ||
        edge.target === selectedNode.id,
    );
  }, [
    selectedNode,
    neighborGraph,
    graph,
  ]);

  function getConnectedNode(
    edge: GraphEdge,
  ): GraphNode | undefined {
    if (!selectedNode) {
      return undefined;
    }

    const connectedId =
      edge.source === selectedNode.id
        ? edge.target
        : edge.source;

    return (
      neighborGraph?.nodes.find(
        (node) => node.id === connectedId,
      ) ??
      graph.nodes.find(
        (node) => node.id === connectedId,
      )
    );
  }

  if (!workspaceId) {
    return (
      <div className="page graph-page">
        <div className="empty-state large">
          <Network size={40} />

          <h1>No active workspace</h1>

          <p>
            Select a workspace before exploring
            decision relationships.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page graph-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Connected decision intelligence
          </p>

          <h1>Knowledge Graph</h1>

          <p className="page-description">
            Explore how decisions connect to
            people, technologies, services,
            incidents, projects, and source
            documents.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            void loadGraph(true)
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
          <Sparkles size={17} />
          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <section className="graph-stat-grid">
        <article>
          <span>Total nodes</span>
          <strong>{graph.nodes.length}</strong>
        </article>

        <article>
          <span>Relationships</span>
          <strong>{graph.edges.length}</strong>
        </article>

        <article>
          <span>Decisions</span>
          <strong>
            {nodeTypeCounts.decision ?? 0}
          </strong>
        </article>

        <article>
          <span>People and systems</span>
          <strong>
            {(nodeTypeCounts.person ?? 0) +
              (nodeTypeCounts.technology ?? 0) +
              (nodeTypeCounts.service ?? 0)}
          </strong>
        </article>
      </section>

      <section className="graph-builder-panel">
        <div>
          <span className="metadata-label">
            Build graph from reviewed decision
          </span>

          <p>
            Select a structured decision and
            generate its connected entities and
            evidence relationships.
          </p>
        </div>

        <select
          value={selectedDecisionId}
          onChange={(event) =>
            setSelectedDecisionId(
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

        <button
          type="button"
          className="primary-button"
          disabled={
            activeAction === "build" ||
            !selectedDecisionId
          }
          onClick={() =>
            void handleBuildGraph()
          }
        >
          {activeAction === "build" ? (
            <LoaderCircle
              size={17}
              className="spin"
            />
          ) : (
            <Sparkles size={17} />
          )}

          Build graph
        </button>

        <button
          type="button"
          className="danger-icon-button graph-clear-button"
          title="Clear workspace graph"
          disabled={
            activeAction === "clear"
          }
          onClick={() =>
            void handleClearGraph()
          }
        >
          <Trash2 size={17} />
        </button>
      </section>

      <section className="graph-toolbar">
        <div className="graph-filter-list">
          <Filter size={16} />

          {(
            [
              "all",
              "decision",
              "person",
              "technology",
              "service",
              "incident",
              "document",
              "project",
              "concept",
            ] as GraphFilter[]
          ).map((item) => (
            <button
              key={item}
              type="button"
              className={
                filter === item
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilter(item)
              }
            >
              {item}
            </button>
          ))}
        </div>

        <div className="search-field">
          <Search size={16} />

          <input
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
            placeholder="Search graph nodes"
          />
        </div>
      </section>

      <section className="graph-explorer-grid">
        <div className="graph-canvas-panel">
          {loading && (
            <div className="graph-loading">
              <LoaderCircle
                size={24}
                className="spin"
              />
              Loading graph...
            </div>
          )}

          {!loading &&
            positionedNodes.length === 0 && (
            <div className="graph-empty-state">
              <BrainCircuit size={42} />

              <h2>No graph data yet</h2>

              <p>
                Select a decision above and build
                its graph to create connected
                organizational memory.
              </p>
            </div>
          )}

          {!loading &&
            positionedNodes.length > 0 && (
            <div className="graph-canvas-scroll">
              <svg
                className="graph-canvas"
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                role="img"
                aria-label="Decision knowledge graph"
              >
                <defs>
                  <marker
                    id="graph-arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path
                      d="M 0 0 L 10 5 L 0 10 z"
                    />
                  </marker>
                </defs>

                {visibleEdges.map((edge) => {
                  const source =
                    getNodePosition(
                      positionedNodes,
                      edge.source,
                    );

                  const target =
                    getNodePosition(
                      positionedNodes,
                      edge.target,
                    );

                  if (!source || !target) {
                    return null;
                  }

                  const labelX =
                    (source.x + target.x) / 2;

                  const labelY =
                    (source.y + target.y) / 2;

                  return (
                    <g key={edge.id}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        className="graph-edge-line"
                        markerEnd="url(#graph-arrow)"
                      />

                      <text
                        x={labelX}
                        y={labelY - 5}
                        className="graph-edge-label"
                      >
                        {formatRelationship(
                          edge.relationship_type,
                        )}
                      </text>
                    </g>
                  );
                })}

                {positionedNodes.map((node) => {
                  const selected =
                    selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      className={`graph-svg-node ${node.entity_type} ${
                        selected
                          ? "selected"
                          : ""
                      }`}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() =>
                        void handleSelectNode(
                          node,
                        )
                      }
                    >
                      <circle r="34" />

                      <foreignObject
                        x="-15"
                        y="-15"
                        width="30"
                        height="30"
                      >
                        <div className="graph-node-icon">
                          {entityIcon(
                            node.entity_type,
                          )}
                        </div>
                      </foreignObject>

                      <text
                        y="52"
                        textAnchor="middle"
                        className="graph-node-label"
                      >
                        {truncateLabel(
                          node.label,
                        )}
                      </text>

                      <text
                        y="67"
                        textAnchor="middle"
                        className="graph-node-type"
                      >
                        {node.entity_type}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <aside className="graph-detail-panel">
          {!selectedNode && (
            <div className="graph-detail-empty">
              <Network size={31} />

              <h3>Select a node</h3>

              <p>
                Inspect its metadata and immediate
                relationships.
              </p>
            </div>
          )}

          {selectedNode && (
            <>
              <div className="graph-selected-header">
                <div className={`graph-selected-icon ${selectedNode.entity_type}`}>
                  {entityIcon(
                    selectedNode.entity_type,
                  )}
                </div>

                <div>
                  <span>
                    {selectedNode.entity_type}
                  </span>

                  <h2>
                    {selectedNode.label}
                  </h2>
                </div>
              </div>

              <section className="graph-detail-section">
                <span className="metadata-label">
                  Metadata
                </span>

                {Object.keys(
                  selectedNode.metadata,
                ).length === 0 ? (
                  <p>
                    No metadata stored for this
                    entity.
                  </p>
                ) : (
                  <div className="graph-metadata-list">
                    {Object.entries(
                      selectedNode.metadata,
                    ).map(
                      ([key, value]) => (
                        <div key={key}>
                          <span>
                            {formatRelationship(
                              key,
                            )}
                          </span>

                          <strong>
                            {typeof value ===
                              "object"
                              ? JSON.stringify(
                                  value,
                                )
                              : String(value)}
                          </strong>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </section>

              <section className="graph-detail-section">
                <div className="section-heading">
                  <div>
                    <span className="metadata-label">
                      Connected entities
                    </span>

                    <h3>
                      {
                        selectedRelationships.length
                      }{" "}
                      relationships
                    </h3>
                  </div>

                  {loadingNeighbors && (
                    <LoaderCircle
                      size={17}
                      className="spin"
                    />
                  )}
                </div>

                <div className="graph-neighbor-list">
                  {selectedRelationships.length ===
                    0 && (
                    <p>
                      No direct relationships found.
                    </p>
                  )}

                  {selectedRelationships.map(
                    (edge) => {
                      const connected =
                        getConnectedNode(edge);

                      if (!connected) {
                        return null;
                      }

                      const outgoing =
                        edge.source ===
                        selectedNode.id;

                      return (
                        <button
                          key={edge.id}
                          type="button"
                          className="graph-neighbor-card"
                          onClick={() =>
                            void handleSelectNode(
                              connected,
                            )
                          }
                        >
                          <span
                            className={`neighbor-icon ${connected.entity_type}`}
                          >
                            {entityIcon(
                              connected.entity_type,
                            )}
                          </span>

                          <span>
                            <strong>
                              {connected.label}
                            </strong>

                            <small>
                              {outgoing
                                ? "→"
                                : "←"}{" "}
                              {formatRelationship(
                                edge.relationship_type,
                              )}
                            </small>
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </section>
            </>
          )}
        </aside>
      </section>
    </div>
  );
}
