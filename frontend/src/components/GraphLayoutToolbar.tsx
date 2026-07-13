import {
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  CircleDot,
  Eraser,
  Save,
} from "lucide-react";

import type {
  GraphLayoutMode,
} from "../lib/graphLayout";

interface GraphLayoutToolbarProps {
  layoutMode: GraphLayoutMode;
  onLayoutChange: (
    mode: GraphLayoutMode,
  ) => void;
  onSave: () => void;
  onReset: () => void;
}

export function GraphLayoutToolbar({
  layoutMode,
  onLayoutChange,
  onSave,
  onReset,
}: GraphLayoutToolbarProps) {
  return (
    <div className="graph-layout-toolbar">
      <div className="graph-layout-options">
        <button
          type="button"
          className={
            layoutMode === "hierarchical"
              ? "active"
              : ""
          }
          onClick={() =>
            onLayoutChange("hierarchical")
          }
          title="Top-to-bottom layout"
        >
          <AlignVerticalSpaceAround
            size={15}
          />
          Vertical
        </button>

        <button
          type="button"
          className={
            layoutMode === "horizontal"
              ? "active"
              : ""
          }
          onClick={() =>
            onLayoutChange("horizontal")
          }
          title="Left-to-right layout"
        >
          <AlignHorizontalSpaceAround
            size={15}
          />
          Horizontal
        </button>

        <button
          type="button"
          className={
            layoutMode === "clustered"
              ? "active"
              : ""
          }
          onClick={() =>
            onLayoutChange("clustered")
          }
          title="Group by entity type"
        >
          <CircleDot size={15} />
          Clusters
        </button>
      </div>

      <div className="graph-layout-actions">
        <button
          type="button"
          onClick={onSave}
          title="Save current positions"
        >
          <Save size={15} />
          Save
        </button>

        <button
          type="button"
          onClick={onReset}
          title="Clear saved positions"
        >
          <Eraser size={15} />
          Reset
        </button>
      </div>
    </div>
  );
}
