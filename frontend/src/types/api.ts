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

export type DecisionStatus =
  | "candidate"
  | "approved"
  | "rejected";

export interface Decision {
  id: string;
  workspace_id: string;
  title: string;
  summary: string | null;
  decision_statement: string;
  reason: string | null;
  alternatives: string[];
  participants: string[];
  related_entities: string[];
  status: DecisionStatus;
  confidence_score: number;
  decision_date: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DecisionEvidence {
  id: string;
  chunk_id: string;
  evidence_type: string;
  relevance_score: number;
  explanation: string | null;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section_title: string | null;
}

export interface DecisionDetail extends Decision {
  evidence: DecisionEvidence[];
}

export interface DecisionStats {
  total: number;
  candidates: number;
  approved: number;
  rejected: number;
  average_confidence: number;
}

export interface DecisionUpdateRequest {
  title?: string;
  summary?: string | null;
  decision_statement?: string;
  reason?: string | null;
  alternatives?: string[];
  participants?: string[];
  related_entities?: string[];
  decision_date?: string | null;
}

export interface DecisionEvent {
  id: string;
  decision_id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string | null;
  source_reference: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DecisionTimeline {
  decision_id: string;
  decision_title: string;
  event_count: number;
  events: DecisionEvent[];
}

export interface TimelineGenerationResponse {
  decision_id: string;
  status: string;
  task_id: string;
}

export type GraphEntityType =
  | "decision"
  | "person"
  | "technology"
  | "service"
  | "incident"
  | "project"
  | "document"
  | "concept"
  | string;

export interface GraphNode {
  id: string;
  label: string;
  entity_type: GraphEntityType;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  description: string | null;
  metadata: Record<string, unknown>;
}

export interface WorkspaceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphBuildResponse {
  decision_id: string;
  created_entities: number;
  reused_entities: number;
  created_relationships: number;
  skipped_relationships: number;
  status: string;
}

export interface ReasoningCitation {
  citation_number: number;
  source_id: string;
  source_type: string;
  title: string;
  document_id: string | null;
  chunk_id: string | null;
  decision_id: string | null;
  document_name: string | null;
  page_number: number | null;
  section_title: string | null;
  excerpt: string;
  score: number;
}

export interface ReasoningTimelineItem {
  date: string | null;
  title: string;
  description: string | null;
  source_ids: string[];
}

export interface RelatedDecisionItem {
  decision_id: string | null;
  title: string;
  relationship: string | null;
  status: string | null;
  source_ids: string[];
}

export interface DecisionReasoningResult {
  answer: string;
  summary: string;
  decision_title: string | null;
  decision_status: string | null;
  decision_date: string | null;
  confidence: number;
  reasons: string[];
  alternatives: string[];
  stakeholders: string[];
  risks: string[];
  impacts: string[];
  timeline: ReasoningTimelineItem[];
  related_decisions: RelatedDecisionItem[];
  uncertainties: string[];
  reason_claims: ReasoningClaim[];
  alternative_claims: ReasoningClaim[];
  stakeholder_claims: ReasoningClaim[];
  risk_claims: ReasoningClaim[];
  impact_claims: ReasoningClaim[];
  uncertainty_claims: ReasoningClaim[];
  source_ids: string[];
}

export interface DecisionReasoningRequest {
  query: string;
  decision_limit?: number;
  document_limit?: number;
  timeline_limit?: number;
  graph_neighbor_limit?: number;
  minimum_similarity?: number;
  token_budget?: number;
  maximum_items?: number;
  deduplication_threshold?: number;
  include_raw_context?: boolean;
}

export interface DecisionReasoningResponse {
  query: string;
  query_type: string;
  result: DecisionReasoningResult;
  citations: ReasoningCitation[];
  claim_citations: ClaimCitationGroup[];
  citation_coverage: CitationCoverage;
  selected_context_items: number;
  estimated_context_tokens: number;
  model: string;
  raw_context: unknown[] | null;
}

export interface ReasoningClaim {
  text: string;
  source_ids: string[];
  supported: boolean;
}

export interface ClaimCitationGroup {
  claim_type: string;
  claim_index: number;
  claim_text: string;
  supported: boolean;
  citations: ReasoningCitation[];
}

export interface CitationCoverage {
  total_claims: number;
  supported_claims: number;
  unsupported_claims: number;
  coverage_ratio: number;
}

export interface ComparisonClaim {
  text: string;
  source_ids: string[];
  supported: boolean;
}

export interface DecisionComparisonSnapshot {
  decision_id: string;
  title: string;
  status: string;
  summary: string | null;
  decision_statement: string;
  reason: string | null;
  alternatives: unknown[];
  participants: unknown[];
  related_entities: unknown[];
  confidence_score: number;
  decision_date: string | null;
  evidence_count: number;
  timeline_event_count: number;
}

export interface DecisionComparisonResult {
  executive_summary: string;
  comparison_answer: string;
  preferred_decision_id: string | null;
  preference_reason: string | null;
  similarities: ComparisonClaim[];
  differences: ComparisonClaim[];
  changed_reasons: ComparisonClaim[];
  changed_alternatives: ComparisonClaim[];
  changed_stakeholders: ComparisonClaim[];
  changed_risks: ComparisonClaim[];
  changed_impacts: ComparisonClaim[];
  conflicts: ComparisonClaim[];
  uncertainties: ComparisonClaim[];
  confidence: number;
  source_ids: string[];
}

export interface DecisionComparisonRequest {
  decision_a_id: string;
  decision_b_id: string;
  question?: string;
  evidence_limit?: number;
  timeline_limit?: number;
}

export interface DecisionComparisonResponse {
  question: string;
  decision_a: DecisionComparisonSnapshot;
  decision_b: DecisionComparisonSnapshot;
  result: DecisionComparisonResult;
  citations: ReasoningCitation[];
  model: string;
  total_sources: number;
  supported_claims: number;
  unsupported_claims: number;
  citation_coverage: number;
}

export interface DocumentProcessingEvent {
  event_type: string;
  document_id: string;
  workspace_id: string;
  status: string;
  progress: number;
  stage: string;
  message: string;
  chunk_count: number | null;
  error_message: string | null;
  terminal: boolean;
  timestamp: string;
}
