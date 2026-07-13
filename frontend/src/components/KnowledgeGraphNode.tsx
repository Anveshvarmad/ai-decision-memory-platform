import {
  AlertTriangle,
  BrainCircuit,
  Database,
  FileText,
  FolderKanban,
  Lightbulb,
  Server,
  UserRound,
} from "lucide-react";

import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";

export interface KnowledgeGraphNodeData
  extends Record<string, unknown> {
  label: string;
  entityType: string;
  selected?: boolean;
}

function entityIcon(entityType: string) {
  switch (entityType) {
    case "decision":
      return <BrainCircuit size={18} />;

    case "person":
      return <UserRound size={18} />;

    case "technology":
      return <Database size={18} />;

    case "service":
      return <Server size={18} />;

    case "incident":
      return <AlertTriangle size={18} />;

    case "document":
      return <FileText size={18} />;

    case "project":
      return <FolderKanban size={18} />;

    default:
      return <Lightbulb size={18} />;
  }
}

export function KnowledgeGraphNode({
  data,
  selected,
}: NodeProps<
  Node<KnowledgeGraphNodeData>
>) {
  const nodeData =
    data as KnowledgeGraphNodeData;

  return (
    <div
      className={[
        "interactive-graph-node",
        `entity-${nodeData.entityType}`,
        selected ? "selected" : "",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="interactive-node-handle"
      />

      <div className="interactive-node-icon">
        {entityIcon(nodeData.entityType)}
      </div>

      <div className="interactive-node-content">
        <strong>{nodeData.label}</strong>
        <span>{nodeData.entityType}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="interactive-node-handle"
      />
    </div>
  );
}
