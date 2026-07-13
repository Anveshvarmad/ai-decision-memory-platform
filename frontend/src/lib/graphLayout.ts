import dagre from "@dagrejs/dagre";

import type {
  Edge,
  Node,
  XYPosition,
} from "@xyflow/react";

import type {
  KnowledgeGraphNodeData,
} from "../components/KnowledgeGraphNode";

export type GraphLayoutMode =
  | "hierarchical"
  | "horizontal"
  | "clustered"
  | "custom";

const NODE_WIDTH = 190;
const NODE_HEIGHT = 66;

const CLUSTER_ORDER = [
  "decision",
  "person",
  "technology",
  "service",
  "incident",
  "document",
  "project",
  "concept",
];

const CLUSTER_CENTERS: Record<
  string,
  XYPosition
> = {
  decision: {
    x: 480,
    y: 300,
  },
  person: {
    x: 140,
    y: 100,
  },
  technology: {
    x: 850,
    y: 110,
  },
  service: {
    x: 880,
    y: 460,
  },
  incident: {
    x: 500,
    y: 610,
  },
  document: {
    x: 120,
    y: 480,
  },
  project: {
    x: 500,
    y: 70,
  },
  concept: {
    x: 210,
    y: 650,
  },
};

function dagreLayout(
  nodes: Node<KnowledgeGraphNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR",
): Node<KnowledgeGraphNodeData>[] {
  const graph = new dagre.graphlib.Graph()
    .setDefaultEdgeLabel(() => ({}));

  graph.setGraph({
    rankdir: direction,
    ranksep: direction === "TB" ? 105 : 145,
    nodesep: 70,
    edgesep: 35,
    marginx: 50,
    marginy: 50,
    acyclicer: "greedy",
    ranker: "network-simplex",
  });

  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    if (
      graph.hasNode(edge.source) &&
      graph.hasNode(edge.target)
    ) {
      graph.setEdge(
        edge.source,
        edge.target,
      );
    }
  });

  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);

    if (!position) {
      return node;
    }

    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });
}

function clusteredLayout(
  nodes: Node<KnowledgeGraphNodeData>[],
): Node<KnowledgeGraphNodeData>[] {
  const groups = new Map<
    string,
    Node<KnowledgeGraphNodeData>[]
  >();

  nodes.forEach((node) => {
    const entityType =
      node.data.entityType || "concept";

    const current =
      groups.get(entityType) ?? [];

    current.push(node);
    groups.set(entityType, current);
  });

  const positioned: Node<
    KnowledgeGraphNodeData
  >[] = [];

  CLUSTER_ORDER.forEach((entityType) => {
    const clusterNodes =
      groups.get(entityType) ?? [];

    if (clusterNodes.length === 0) {
      return;
    }

    const center =
      CLUSTER_CENTERS[entityType] ??
      CLUSTER_CENTERS.concept;

    const columns = Math.max(
      1,
      Math.ceil(
        Math.sqrt(clusterNodes.length),
      ),
    );

    const horizontalSpacing = 230;
    const verticalSpacing = 105;

    clusterNodes.forEach((node, index) => {
      const row = Math.floor(
        index / columns,
      );

      const column = index % columns;

      const totalWidth =
        (columns - 1) *
        horizontalSpacing;

      positioned.push({
        ...node,
        position: {
          x:
            center.x -
            totalWidth / 2 +
            column * horizontalSpacing,
          y:
            center.y +
            row * verticalSpacing,
        },
      });
    });
  });

  const positionedIds = new Set(
    positioned.map((node) => node.id),
  );

  nodes
    .filter(
      (node) => !positionedIds.has(node.id),
    )
    .forEach((node, index) => {
      positioned.push({
        ...node,
        position: {
          x: 300 + (index % 4) * 230,
          y:
            760 +
            Math.floor(index / 4) * 105,
        },
      });
    });

  return positioned;
}

export function applyGraphLayout(
  nodes: Node<KnowledgeGraphNodeData>[],
  edges: Edge[],
  mode: GraphLayoutMode,
): Node<KnowledgeGraphNodeData>[] {
  if (mode === "hierarchical") {
    return dagreLayout(
      nodes,
      edges,
      "TB",
    );
  }

  if (mode === "horizontal") {
    return dagreLayout(
      nodes,
      edges,
      "LR",
    );
  }

  if (mode === "clustered") {
    return clusteredLayout(nodes);
  }

  return nodes;
}

export function createPositionStorageKey(
  workspaceId: string,
): string {
  return `decision-memory-graph-positions:${workspaceId}`;
}

export function saveGraphPositions(
  workspaceId: string,
  nodes: Node[],
): void {
  const positions = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      node.position,
    ]),
  );

  localStorage.setItem(
    createPositionStorageKey(workspaceId),
    JSON.stringify(positions),
  );
}

export function loadGraphPositions(
  workspaceId: string,
): Record<string, XYPosition> {
  const stored = localStorage.getItem(
    createPositionStorageKey(workspaceId),
  );

  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed as Record<
      string,
      XYPosition
    >;
  } catch {
    return {};
  }
}

export function applySavedPositions(
  nodes: Node<KnowledgeGraphNodeData>[],
  positions: Record<string, XYPosition>,
): Node<KnowledgeGraphNodeData>[] {
  return nodes.map((node) => {
    const savedPosition =
      positions[node.id];

    if (!savedPosition) {
      return node;
    }

    return {
      ...node,
      position: savedPosition,
    };
  });
}

export function clearGraphPositions(
  workspaceId: string,
): void {
  localStorage.removeItem(
    createPositionStorageKey(workspaceId),
  );
}
