import type {
  ApiError,
  AuthResponse,
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
