export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  role: string | null;
}

export interface WorkspaceCreateRequest {
  name: string;
}

export interface ApiError {
  detail?: string;
}

export type DocumentStatus =
  | "pending"
  | "processing"
  | "embedding"
  | "completed"
  | "failed";

export interface DocumentRecord {
  id: string;
  workspace_id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  source_type: string;
  status: DocumentStatus;
  processing_progress: number;
  error_message: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetail extends DocumentRecord {
  chunk_count: number;
}

export interface DocumentUploadResponse {
  document: DocumentRecord;
  task_id: string;
}

export interface DocumentRetryResponse {
  document_id: string;
  status: string;
  task_id: string;
}

export interface DecisionExtractionResponse {
  document_id: string;
  status: string;
  task_id: string;
}

export interface Citation {
  citation_number: number;
  chunk_id: string;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  excerpt: string;
  similarity: number;
}

export interface MatchedDecision {
  decision_id: string;
  title: string;
  status: string;
  confidence_score: number;
  relevance_score: number;
}

export interface ChatRequest {
  question: string;
  conversation_id?: string;
  limit?: number;
  minimum_similarity?: number;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  question: string;
  answer: string;
  citations: Citation[];
  evidence_found: boolean;
  query_type: string;
  classification_confidence: number;
  matched_decisions: MatchedDecision[];
  timeline_event_count: number;
  graph_node_count: number;
  document_result_count: number;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
}
