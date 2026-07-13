import type {
  ApiError,
  AuthResponse,
  ChatRequest,
  ChatResponse,
  Conversation,
  ConversationDetail,
  DecisionExtractionResponse,
  DocumentDetail,
  DocumentRecord,
  DocumentRetryResponse,
  DocumentUploadResponse,
  User,
  Workspace,
  WorkspaceCreateRequest,
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
