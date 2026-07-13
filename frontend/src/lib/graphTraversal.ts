import type {
  GraphEdge,
  GraphNode,
  WorkspaceGraph,
} from "../types/api";

export interface GraphPath {
  nodeIds: string[];
  edgeIds: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface AdjacencyItem {
  nodeId: string;
  edge: GraphEdge;
}

function buildAdjacency(
  graph: WorkspaceGraph,
): Map<string, AdjacencyItem[]> {
  const adjacency = new Map<
    string,
    AdjacencyItem[]
  >();

  graph.nodes.forEach((node) => {
    adjacency.set(node.id, []);
  });

  graph.edges.forEach((edge) => {
    adjacency.get(edge.source)?.push({
      nodeId: edge.target,
      edge,
    });

    adjacency.get(edge.target)?.push({
      nodeId: edge.source,
      edge,
    });
  });

  return adjacency;
}

export function findShortestPath(
  graph: WorkspaceGraph,
  startNodeId: string,
  endNodeId: string,
): GraphPath | null {
  if (!startNodeId || !endNodeId) {
    return null;
  }

  if (startNodeId === endNodeId) {
    const node = graph.nodes.find(
      (item) => item.id === startNodeId,
    );

    if (!node) {
      return null;
    }

    return {
      nodeIds: [startNodeId],
      edgeIds: [],
      nodes: [node],
      edges: [],
    };
  }

  const adjacency = buildAdjacency(graph);

  const queue: string[] = [startNodeId];
  const visited = new Set<string>([
    startNodeId,
  ]);

  const previousNode = new Map<
    string,
    string
  >();

  const previousEdge = new Map<
    string,
    GraphEdge
  >();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    const neighbors =
      adjacency.get(current) ?? [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) {
        continue;
      }

      visited.add(neighbor.nodeId);
      previousNode.set(
        neighbor.nodeId,
        current,
      );

      previousEdge.set(
        neighbor.nodeId,
        neighbor.edge,
      );

      if (neighbor.nodeId === endNodeId) {
        queue.length = 0;
        break;
      }

      queue.push(neighbor.nodeId);
    }
  }

  if (!visited.has(endNodeId)) {
    return null;
  }

  const nodeIds: string[] = [];
  const edges: GraphEdge[] = [];

  let currentNodeId = endNodeId;

  nodeIds.unshift(currentNodeId);

  while (currentNodeId !== startNodeId) {
    const parentNodeId =
      previousNode.get(currentNodeId);

    const connectingEdge =
      previousEdge.get(currentNodeId);

    if (!parentNodeId || !connectingEdge) {
      return null;
    }

    edges.unshift(connectingEdge);
    currentNodeId = parentNodeId;
    nodeIds.unshift(currentNodeId);
  }

  const nodes = nodeIds
    .map((nodeId) =>
      graph.nodes.find(
        (node) => node.id === nodeId,
      ),
    )
    .filter(
      (node): node is GraphNode =>
        Boolean(node),
    );

  return {
    nodeIds,
    edgeIds: edges.map(
      (edge) => edge.id,
    ),
    nodes,
    edges,
  };
}

export function getNeighborhood(
  graph: WorkspaceGraph,
  rootNodeId: string,
  depth: number,
): WorkspaceGraph {
  if (!rootNodeId || depth < 1) {
    return {
      nodes: [],
      edges: [],
    };
  }

  const adjacency = buildAdjacency(graph);

  const visited = new Set<string>([
    rootNodeId,
  ]);

  let frontier = new Set<string>([
    rootNodeId,
  ]);

  for (
    let currentDepth = 0;
    currentDepth < depth;
    currentDepth += 1
  ) {
    const nextFrontier =
      new Set<string>();

    frontier.forEach((nodeId) => {
      const neighbors =
        adjacency.get(nodeId) ?? [];

      neighbors.forEach((neighbor) => {
        if (
          !visited.has(neighbor.nodeId)
        ) {
          visited.add(neighbor.nodeId);
          nextFrontier.add(
            neighbor.nodeId,
          );
        }
      });
    });

    frontier = nextFrontier;

    if (frontier.size === 0) {
      break;
    }
  }

  return {
    nodes: graph.nodes.filter((node) =>
      visited.has(node.id),
    ),

    edges: graph.edges.filter(
      (edge) =>
        visited.has(edge.source) &&
        visited.has(edge.target),
    ),
  };
}

export function getRelationshipTypes(
  edges: GraphEdge[],
): string[] {
  return Array.from(
    new Set(
      edges.map(
        (edge) =>
          edge.relationship_type,
      ),
    ),
  ).sort((left, right) =>
    left.localeCompare(right),
  );
}
