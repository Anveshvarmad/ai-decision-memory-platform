import {
  AlertCircle,
  Database,
  FileText,
  Filter,
  GitBranch,
  LoaderCircle,
  Maximize2,
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
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type OnNodeDrag,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

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

import {
  KnowledgeGraphNode,
  type KnowledgeGraphNodeData,
} from "../components/KnowledgeGraphNode";

import {
  GraphLayoutToolbar,
} from "../components/GraphLayoutToolbar";

import {
  applyGraphLayout,
  applySavedPositions,
  clearGraphPositions,
  loadGraphPositions,
  saveGraphPositions,
  type GraphLayoutMode,
} from "../lib/graphLayout";

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

const nodeTypes = {
  knowledgeNode: KnowledgeGraphNode,
};

function entityIcon(entityType: string) {
  switch (entityType) {
    case "decision":
      return <GitBranch size={17} />;

    case "person":
      return <UserRound size={17} />;

    case "technology":
      return <Database size={17} />;

    case "service":
      return <Server size={17} />;

    case "incident":
      return <Zap size={17} />;

    case "document":
      return <FileText size={17} />;

    default:
      return <Network size={17} />;
  }
}

function formatRelationship(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function createInitialPosition(
  index: number,
  total: number,
  entityType: string,
) {
  if (entityType === "decision") {
    return {
      x: 380 + (index % 3) * 230,
      y: 250 + Math.floor(index / 3) * 180,
    };
  }

  const angle =
    (2 * Math.PI * index) /
    Math.max(total, 1);

  const radius =
    270 + (index % 3) * 55;

  return {
    x: 480 + Math.cos(angle) * radius,
    y: 330 + Math.sin(angle) * radius,
  };
}

function convertNodes(
  graphNodes: GraphNode[],
): Node<KnowledgeGraphNodeData>[] {
  const decisions = graphNodes.filter(
    (node) =>
      node.entity_type === "decision",
  );

  const others = graphNodes.filter(
    (node) =>
      node.entity_type !== "decision",
  );

  const ordered = [
    ...decisions,
    ...others,
  ];

  return ordered.map((node, index) => ({
    id: node.id,
    type: "knowledgeNode",
    position: createInitialPosition(
      index,
      ordered.length,
      node.entity_type,
    ),
    data: {
      label: node.label,
      entityType: node.entity_type,
    },
  }));
}

function convertEdges(
  graphEdges: GraphEdge[],
): Edge[] {
  return graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: formatRelationship(
      edge.relationship_type,
    ),
    type: "smoothstep",
    animated:
      edge.relationship_type ===
      "caused_by",
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    data: {
      relationshipType:
        edge.relationship_type,
      description: edge.description,
    },
  }));
}

function GraphCanvas({
  graph,
  workspaceId,
  selectedNode,
  onSelectNode,
  onPositionsSaved,
  onPositionsReset,
}: {
  graph: WorkspaceGraph;
  workspaceId: string;
  selectedNode: GraphNode | null;
  onSelectNode: (
    node: GraphNode,
  ) => void;
  onPositionsSaved: () => void;
  onPositionsReset: () => void;
}) {
  const { fitView } = useReactFlow();

  const convertedEdges = useMemo(
    () => convertEdges(graph.edges),
    [graph.edges],
  );

  const convertedNodes = useMemo(() => {
    const baseNodes =
      convertNodes(graph.nodes);

    const savedPositions =
      loadGraphPositions(workspaceId);

    if (
      Object.keys(savedPositions).length > 0
    ) {
      return applySavedPositions(
        baseNodes,
        savedPositions,
      );
    }

    return applyGraphLayout(
      baseNodes,
      convertedEdges,
      "hierarchical",
    );
  }, [
    graph.nodes,
    convertedEdges,
    workspaceId,
  ]);

  const [nodes, setNodes, onNodesChange] =
    useNodesState(convertedNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(convertedEdges);

  const [layoutMode, setLayoutMode] =
    useState<GraphLayoutMode>(() => {
      const savedPositions =
        loadGraphPositions(workspaceId);

      return Object.keys(savedPositions)
        .length > 0
        ? "custom"
        : "hierarchical";
    });

  useEffect(() => {
    setNodes(convertedNodes);
    setEdges(convertedEdges);

    const timer = window.setTimeout(() => {
      void fitView({
        padding: 0.22,
        duration: 500,
      });
    }, 100);

    return () =>
      window.clearTimeout(timer);
  }, [
    convertedNodes,
    convertedEdges,
    setNodes,
    setEdges,
    fitView,
  ]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected:
          node.id === selectedNode?.id,
      })),
    );
  }, [selectedNode, setNodes]);

  function handleLayoutChange(
    mode: GraphLayoutMode,
  ) {
    const layouted = applyGraphLayout(
      nodes,
      edges,
      mode,
    );

    setNodes(layouted);
    setLayoutMode(mode);

    window.setTimeout(() => {
      void fitView({
        padding: 0.2,
        duration: 500,
      });
    }, 50);
  }

  function handleSavePositions() {
    saveGraphPositions(
      workspaceId,
      nodes,
    );

    setLayoutMode("custom");
    onPositionsSaved();
  }

  function handleResetPositions() {
    clearGraphPositions(workspaceId);

    const resetNodes = applyGraphLayout(
      convertNodes(graph.nodes),
      convertedEdges,
      "hierarchical",
    );

    setNodes(resetNodes);
    setLayoutMode("hierarchical");
    onPositionsReset();

    window.setTimeout(() => {
      void fitView({
        padding: 0.2,
        duration: 500,
      });
    }, 50);
  }

  const handleNodeDragStop:
    OnNodeDrag = () => {
      setLayoutMode("custom");
    };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={
        handleNodeDragStop
      }
      onNodeClick={(_, node) => {
        const graphNode =
          graph.nodes.find(
            (item) =>
              item.id === node.id,
          );

        if (graphNode) {
          onSelectNode(graphNode);
        }
      }}
      fitView
      minZoom={0.15}
      maxZoom={2.5}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      deleteKeyCode={null}
      className="interactive-graph-flow"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1}
      />

      <Controls
        position="bottom-left"
        showInteractive={false}
      />

      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        nodeStrokeWidth={3}
      />

      <Panel
        position="top-left"
        className="graph-layout-panel"
      >
        <GraphLayoutToolbar
          layoutMode={layoutMode}
          onLayoutChange={
            handleLayoutChange
          }
          onSave={handleSavePositions}
          onReset={
            handleResetPositions
          }
        />
      </Panel>

      <Panel
        position="top-right"
        className="graph-fit-panel"
      >
        <button
          type="button"
          onClick={() =>
            void fitView({
              padding: 0.22,
              duration: 500,
            })
          }
        >
          <Maximize2 size={15} />
          Fit graph
        </button>
      </Panel>
    </ReactFlow>
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

  const [
    selectedDecisionId,
    setSelectedDecisionId,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    loadingNeighbors,
    setLoadingNeighbors,
  ] = useState(false);

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
        const [
          graphData,
          decisionData,
        ] = await Promise.all([
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
              node.id ===
              selectedNode.id,
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
  }, [workspaceId, filter]);

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

    return () =>
      window.removeEventListener(
        "decision-memory-workspace-change",
        handleWorkspaceChange,
      );
  }, []);

  async function selectNode(
    node: GraphNode,
  ) {
    if (!workspaceId) {
      return;
    }

    setSelectedNode(node);
    setLoadingNeighbors(true);

    try {
      setNeighborGraph(
        await getGraphNeighbors(
          workspaceId,
          node.id,
        ),
      );
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

    try {
      const result =
        await buildDecisionGraph(
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
          : "Unable to build graph",
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

    try {
      await clearWorkspaceGraph(
        workspaceId,
      );

      setGraph({
        nodes: [],
        edges: [],
      });

      clearGraphPositions(workspaceId);

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

  const visibleGraph = useMemo(() => {
    const normalized =
      searchTerm.trim().toLowerCase();

    if (!normalized) {
      return graph;
    }

    const nodes = graph.nodes.filter(
      (node) =>
        node.label
          .toLowerCase()
          .includes(normalized) ||
        node.entity_type
          .toLowerCase()
          .includes(normalized),
    );

    const nodeIds = new Set(
      nodes.map((node) => node.id),
    );

    return {
      nodes,
      edges: graph.edges.filter(
        (edge) =>
          nodeIds.has(edge.source) &&
          nodeIds.has(edge.target),
      ),
    };
  }, [graph, searchTerm]);

  const selectedRelationships =
    useMemo(() => {
      if (!selectedNode) {
        return [];
      }

      return (
        neighborGraph?.edges ??
        graph.edges
      ).filter(
        (edge) =>
          edge.source ===
            selectedNode.id ||
          edge.target ===
            selectedNode.id,
      );
    }, [
      selectedNode,
      neighborGraph,
      graph.edges,
    ]);

  function connectedNode(
    edge: GraphEdge,
  ) {
    if (!selectedNode) {
      return undefined;
    }

    const connectedId =
      edge.source === selectedNode.id
        ? edge.target
        : edge.source;

    return (
      neighborGraph?.nodes.find(
        (node) =>
          node.id === connectedId,
      ) ??
      graph.nodes.find(
        (node) =>
          node.id === connectedId,
      )
    );
  }

  if (!workspaceId) {
    return (
      <div className="page graph-page">
        <div className="empty-state large">
          <Network size={40} />
          <h1>No active workspace</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page graph-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Interactive organizational memory
          </p>

          <h1>Knowledge Graph</h1>

          <p className="page-description">
            Drag, zoom, pan, search, and inspect
            relationships between decisions,
            people, systems, incidents, and
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
            onClick={() =>
              setError(null)
            }
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
            onClick={() =>
              setNotice(null)
            }
          >
            <X size={15} />
          </button>
        </div>
      )}

      <section className="graph-builder-panel">
        <div>
          <span className="metadata-label">
            Build from decision
          </span>

          <p>
            Generate entities and relationships
            from a structured decision.
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
            placeholder="Search nodes"
          />
        </div>
      </section>

      <section className="graph-cluster-legend">
        {[
          "decision",
          "person",
          "technology",
          "service",
          "incident",
          "document",
          "project",
          "concept",
        ].map((entityType) => (
          <span key={entityType}>
            <i
              className={`entity-cluster-dot ${entityType}`}
            />
            {entityType}
          </span>
        ))}
      </section>

      <section className="interactive-graph-layout">
        <div className="interactive-graph-canvas">
          {loading ? (
            <div className="graph-loading">
              <LoaderCircle
                size={24}
                className="spin"
              />
              Loading graph...
            </div>
          ) : visibleGraph.nodes.length ===
            0 ? (
            <div className="graph-empty-state">
              <Network size={42} />
              <h2>No graph data</h2>
              <p>
                Build a graph from a decision or
                change the active filters.
              </p>
            </div>
          ) : (
            <ReactFlowProvider>
              <GraphCanvas
                graph={visibleGraph}
                workspaceId={workspaceId}
                selectedNode={selectedNode}
                onSelectNode={(node) =>
                  void selectNode(node)
                }
                onPositionsSaved={() =>
                  setNotice(
                    "Graph positions saved for this workspace.",
                  )
                }
                onPositionsReset={() =>
                  setNotice(
                    "Saved positions cleared and layout reset.",
                  )
                }
              />
            </ReactFlowProvider>
          )}
        </div>

        <aside className="graph-detail-panel">
          {!selectedNode ? (
            <div className="graph-detail-empty">
              <Network size={31} />
              <h3>Select a node</h3>
              <p>
                Click any graph node to inspect its
                metadata and relationships.
              </p>
            </div>
          ) : (
            <>
              <div className="graph-selected-header">
                <div
                  className={`graph-selected-icon ${selectedNode.entity_type}`}
                >
                  {entityIcon(
                    selectedNode.entity_type,
                  )}
                </div>

                <div>
                  <span>
                    {selectedNode.entity_type}
                  </span>
                  <h2>{selectedNode.label}</h2>
                </div>
              </div>

              <section className="graph-detail-section">
                <span className="metadata-label">
                  Metadata
                </span>

                {Object.keys(
                  selectedNode.metadata,
                ).length === 0 ? (
                  <p>No metadata available.</p>
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
                  {selectedRelationships.map(
                    (edge) => {
                      const connected =
                        connectedNode(edge);

                      if (!connected) {
                        return null;
                      }

                      return (
                        <button
                          key={edge.id}
                          type="button"
                          className="graph-neighbor-card"
                          onClick={() =>
                            void selectNode(
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
