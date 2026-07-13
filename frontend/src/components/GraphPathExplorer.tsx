import {
  Focus,
  GitFork,
  RotateCcw,
  Route,
  SearchX,
} from "lucide-react";

import type {
  GraphPath,
} from "../lib/graphTraversal";

import type {
  GraphNode,
} from "../types/api";

interface GraphPathExplorerProps {
  nodes: GraphNode[];
  startNodeId: string;
  endNodeId: string;
  path: GraphPath | null;
  pathSearched: boolean;
  neighborhoodDepth: number;
  selectedRelationshipTypes: string[];
  relationshipTypes: string[];

  onStartNodeChange: (
    nodeId: string,
  ) => void;

  onEndNodeChange: (
    nodeId: string,
  ) => void;

  onFindPath: () => void;
  onResetPath: () => void;

  onNeighborhoodDepthChange: (
    depth: number,
  ) => void;

  onFocusNeighborhood: () => void;
  onResetFocus: () => void;

  onRelationshipTypesChange: (
    relationshipTypes: string[],
  ) => void;
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

export function GraphPathExplorer({
  nodes,
  startNodeId,
  endNodeId,
  path,
  pathSearched,
  neighborhoodDepth,
  selectedRelationshipTypes,
  relationshipTypes,
  onStartNodeChange,
  onEndNodeChange,
  onFindPath,
  onResetPath,
  onNeighborhoodDepthChange,
  onFocusNeighborhood,
  onResetFocus,
  onRelationshipTypesChange,
}: GraphPathExplorerProps) {
  function toggleRelationshipType(
    relationshipType: string,
  ) {
    if (
      selectedRelationshipTypes.includes(
        relationshipType,
      )
    ) {
      onRelationshipTypesChange(
        selectedRelationshipTypes.filter(
          (item) =>
            item !== relationshipType,
        ),
      );

      return;
    }

    onRelationshipTypesChange([
      ...selectedRelationshipTypes,
      relationshipType,
    ]);
  }

  return (
    <section className="graph-path-explorer">
      <div className="graph-path-heading">
        <div>
          <span className="metadata-label">
            Relationship intelligence
          </span>

          <h3>Path Explorer</h3>
        </div>

        <Route size={20} />
      </div>

      <div className="graph-path-selectors">
        <label>
          <span>Start entity</span>

          <select
            value={startNodeId}
            onChange={(event) =>
              onStartNodeChange(
                event.target.value,
              )
            }
          >
            <option value="">
              Select start entity
            </option>

            {nodes.map((node) => (
              <option
                key={node.id}
                value={node.id}
              >
                {node.label} ({node.entity_type})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Target entity</span>

          <select
            value={endNodeId}
            onChange={(event) =>
              onEndNodeChange(
                event.target.value,
              )
            }
          >
            <option value="">
              Select target entity
            </option>

            {nodes.map((node) => (
              <option
                key={node.id}
                value={node.id}
              >
                {node.label} ({node.entity_type})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="graph-path-actions">
        <button
          type="button"
          className="primary-button"
          disabled={
            !startNodeId ||
            !endNodeId ||
            startNodeId === endNodeId
          }
          onClick={onFindPath}
        >
          <Route size={15} />
          Find connection
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onResetPath}
        >
          <RotateCcw size={15} />
          Clear path
        </button>
      </div>

      {path && (
        <div className="graph-path-result">
          <div className="graph-path-summary">
            <GitFork size={17} />

            <div>
              <strong>
                {path.edges.length} relationship
                {path.edges.length === 1
                  ? ""
                  : "s"}
              </strong>

              <small>
                {path.nodes.length} connected
                entities
              </small>
            </div>
          </div>

          <div className="graph-path-chain">
            {path.nodes.map(
              (node, index) => (
                <div
                  key={node.id}
                  className="graph-path-step"
                >
                  <span>
                    <strong>{node.label}</strong>
                    <small>
                      {node.entity_type}
                    </small>
                  </span>

                  {index <
                    path.edges.length && (
                    <i>
                      {formatRelationship(
                        path.edges[index]
                          .relationship_type,
                      )}
                    </i>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {!path && pathSearched && (
        <div className="graph-path-not-found">
          <SearchX size={18} />

          <span>
            No connection exists between the
            selected entities in the current
            graph.
          </span>
        </div>
      )}

      <div className="graph-neighborhood-controls">
        <div>
          <span className="metadata-label">
            Neighborhood focus
          </span>

          <p>
            Show only entities within the selected
            number of hops from the start entity.
          </p>
        </div>

        <div className="graph-depth-selector">
          {[1, 2, 3].map((depth) => (
            <button
              key={depth}
              type="button"
              className={
                neighborhoodDepth === depth
                  ? "active"
                  : ""
              }
              onClick={() =>
                onNeighborhoodDepthChange(
                  depth,
                )
              }
            >
              {depth} hop
              {depth === 1 ? "" : "s"}
            </button>
          ))}
        </div>

        <div className="graph-path-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={!startNodeId}
            onClick={onFocusNeighborhood}
          >
            <Focus size={15} />
            Focus neighborhood
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={onResetFocus}
          >
            <RotateCcw size={15} />
            Show full graph
          </button>
        </div>
      </div>

      {relationshipTypes.length > 0 && (
        <div className="graph-relationship-filters">
          <div>
            <span className="metadata-label">
              Relationship filters
            </span>

            <button
              type="button"
              onClick={() =>
                onRelationshipTypesChange([])
              }
            >
              Clear filters
            </button>
          </div>

          <div>
            {relationshipTypes.map(
              (relationshipType) => (
                <button
                  key={relationshipType}
                  type="button"
                  className={
                    selectedRelationshipTypes
                      .includes(
                        relationshipType,
                      )
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    toggleRelationshipType(
                      relationshipType,
                    )
                  }
                >
                  {formatRelationship(
                    relationshipType,
                  )}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </section>
  );
}
