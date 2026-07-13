import type {
  ApiError,
  AuthResponse,
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationDetail,
  Decision,
  DecisionDetail,
  DecisionExtractionResponse,
  DecisionReasoningRequest,
  DecisionReasoningResponse,
  DecisionStats,
  DecisionStatus,
  DecisionTimeline,
  DecisionUpdateRequest,
  DocumentDetail,
  DocumentRecord,
  DocumentRetryResponse,
  DocumentUploadResponse,
  GraphBuildResponse,
  TimelineGenerationResponse,
  User,
  Workspace,
  WorkspaceCreateRequest,
  WorkspaceGraph,
} from "../types/api";

const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://localhost:8000/api";

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem(
    "decision_memory_token",
  );

  const headers = new Headers(options.headers);

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const payload =
        (await response.json()) as ApiError;

      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // Response did not contain JSON.
    }

    throw new ApiRequestError(
      message,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export function register(
  email: string,
  fullName: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      full_name: fullName,
      password,
    }),
  });
}

export function getCurrentUser(): Promise<User> {
  return request<User>("/auth/me");
}

export function getWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>("/workspaces");
}

export function createWorkspace(
  payload: WorkspaceCreateRequest,
): Promise<Workspace> {
  return request<Workspace>("/workspaces", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function getDocuments(
  workspaceId: string,
): Promise<DocumentRecord[]> {
  return request<DocumentRecord[]>(
    `/workspaces/${workspaceId}/documents`,
  );
}

export function getDocument(
  workspaceId: string,
  documentId: string,
): Promise<DocumentDetail> {
  return request<DocumentDetail>(
    `/workspaces/${workspaceId}/documents/${documentId}`,
  );
}

export function uploadDocument(
  workspaceId: string,
  file: File,
): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return request<DocumentUploadResponse>(
    `/workspaces/${workspaceId}/documents`,
    {
      method: "POST",
      body: formData,
    },
  );
}

export function retryDocument(
  workspaceId: string,
  documentId: string,
): Promise<DocumentRetryResponse> {
  return request<DocumentRetryResponse>(
    `/workspaces/${workspaceId}/documents/${documentId}/retry`,
    {
      method: "POST",
    },
  );
}

export function deleteDocument(
  workspaceId: string,
  documentId: string,
): Promise<void> {
  return request<void>(
    `/workspaces/${workspaceId}/documents/${documentId}`,
    {
      method: "DELETE",
    },
  );
}

export function extractDocumentDecisions(
  workspaceId: string,
  documentId: string,
): Promise<DecisionExtractionResponse> {
  return request<DecisionExtractionResponse>(
    `/workspaces/${workspaceId}/documents/${documentId}/extract-decisions`,
    {
      method: "POST",
    },
  );
}

export function sendChatMessage(
  workspaceId: string,
  payload: ChatRequest,
): Promise<ChatResponse> {
  return request<ChatResponse>(
    `/workspaces/${workspaceId}/chat`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function getConversations(
  workspaceId: string,
): Promise<Conversation[]> {
  return request<Conversation[]>(
    `/workspaces/${workspaceId}/conversations`,
  );
}

export function getConversation(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationDetail> {
  return request<ConversationDetail>(
    `/workspaces/${workspaceId}/conversations/${conversationId}`,
  );
}

export function deleteConversation(
  workspaceId: string,
  conversationId: string,
): Promise<void> {
  return request<void>(
    `/workspaces/${workspaceId}/conversations/${conversationId}`,
    {
      method: "DELETE",
    },
  );
}

export function getDecisions(
  workspaceId: string,
  status?: DecisionStatus | "all",
  minimumConfidence = 0,
): Promise<Decision[]> {
  const params = new URLSearchParams();

  if (status && status !== "all") {
    params.set("decision_status", status);
  }

  params.set(
    "minimum_confidence",
    String(minimumConfidence),
  );

  return request<Decision[]>(
    `/workspaces/${workspaceId}/decisions?${params.toString()}`,
  );
}

export function getDecisionStats(
  workspaceId: string,
): Promise<DecisionStats> {
  return request<DecisionStats>(
    `/workspaces/${workspaceId}/decisions/stats`,
  );
}

export function getDecision(
  workspaceId: string,
  decisionId: string,
): Promise<DecisionDetail> {
  return request<DecisionDetail>(
    `/workspaces/${workspaceId}/decisions/${decisionId}`,
  );
}

export function updateDecision(
  workspaceId: string,
  decisionId: string,
  payload: DecisionUpdateRequest,
): Promise<Decision> {
  return request<Decision>(
    `/workspaces/${workspaceId}/decisions/${decisionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export function reviewDecision(
  workspaceId: string,
  decisionId: string,
  status: DecisionStatus,
): Promise<Decision> {
  return request<Decision>(
    `/workspaces/${workspaceId}/decisions/${decisionId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export function deleteDecision(
  workspaceId: string,
  decisionId: string,
): Promise<void> {
  return request<void>(
    `/workspaces/${workspaceId}/decisions/${decisionId}`,
    {
      method: "DELETE",
    },
  );
}

export function getDecisionTimeline(
  workspaceId: string,
  decisionId: string,
): Promise<DecisionTimeline> {
  return request<DecisionTimeline>(
    `/workspaces/${workspaceId}/decisions/${decisionId}/timeline`,
  );
}

export function generateDecisionTimeline(
  workspaceId: string,
  decisionId: string,
): Promise<TimelineGenerationResponse> {
  return request<TimelineGenerationResponse>(
    `/workspaces/${workspaceId}/decisions/${decisionId}/generate-timeline`,
    {
      method: "POST",
    },
  );
}

export function getWorkspaceGraph(
  workspaceId: string,
  entityType?: string,
): Promise<WorkspaceGraph> {
  const params = new URLSearchParams();

  if (entityType && entityType !== "all") {
    params.set("entity_type", entityType);
  }

  const query = params.toString();

  return request<WorkspaceGraph>(
    `/workspaces/${workspaceId}/graph${
      query ? `?${query}` : ""
    }`,
  );
}

export function getGraphNeighbors(
  workspaceId: string,
  entityId: string,
): Promise<WorkspaceGraph> {
  return request<WorkspaceGraph>(
    `/workspaces/${workspaceId}/graph/entities/${entityId}/neighbors`,
  );
}

export function buildDecisionGraph(
  workspaceId: string,
  decisionId: string,
): Promise<GraphBuildResponse> {
  return request<GraphBuildResponse>(
    `/workspaces/${workspaceId}/decisions/${decisionId}/build-graph`,
    {
      method: "POST",
    },
  );
}

export function clearWorkspaceGraph(
  workspaceId: string,
): Promise<void> {
  return request<void>(
    `/workspaces/${workspaceId}/graph`,
    {
      method: "DELETE",
    },
  );
}

export function generateDecisionReasoning(
  workspaceId: string,
  payload: DecisionReasoningRequest,
): Promise<DecisionReasoningResponse> {
  return request<DecisionReasoningResponse>(
    `/workspaces/${workspaceId}/context/reason`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

