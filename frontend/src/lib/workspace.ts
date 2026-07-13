export const ACTIVE_WORKSPACE_KEY =
  "decision_memory_workspace";

export function getActiveWorkspaceId():
  | string
  | null {
  return localStorage.getItem(
    ACTIVE_WORKSPACE_KEY,
  );
}

export function setActiveWorkspaceId(
  workspaceId: string,
) {
  localStorage.setItem(
    ACTIVE_WORKSPACE_KEY,
    workspaceId,
  );

  window.dispatchEvent(
    new CustomEvent(
      "decision-memory-workspace-change",
      {
        detail: workspaceId,
      },
    ),
  );
}
