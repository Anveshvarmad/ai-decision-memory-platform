import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  GitBranch,
  LoaderCircle,
  MessageSquareText,
  Network,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  deleteConversation,
  getConversation,
  getConversations,
  sendChatMessage,
} from "../lib/api";

import {
  getActiveWorkspaceId,
} from "../lib/workspace";

import type {
  Citation,
  Conversation,
  ConversationMessage,
  MatchedDecision,
} from "../types/api";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  metadata: {
    queryType?: string;
    classificationConfidence?: number;
    matchedDecisions?: MatchedDecision[];
    timelineEventCount?: number;
    graphNodeCount?: number;
    documentResultCount?: number;
    evidenceFound?: boolean;
  };
  createdAt: string;
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(date);
}

function toNumber(
  value: unknown,
): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);

    return Number.isNaN(parsed)
      ? undefined
      : parsed;
  }

  return undefined;
}

function toBoolean(
  value: unknown,
): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function toMatchedDecisions(
  value: unknown,
): MatchedDecision[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is MatchedDecision => {
      if (
        typeof item !== "object" ||
        item === null
      ) {
        return false;
      }

      const candidate =
        item as Record<string, unknown>;

      return (
        typeof candidate.decision_id ===
          "string" &&
        typeof candidate.title === "string" &&
        typeof candidate.status === "string" &&
        typeof candidate.confidence_score ===
          "number" &&
        typeof candidate.relevance_score ===
          "number"
      );
    },
  );
}

function convertStoredMessage(
  message: ConversationMessage,
): LocalMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    citations: Array.isArray(message.citations)
      ? message.citations
      : [],
    metadata: {
      queryType:
        typeof message.metadata_json[
          "query_type"
        ] === "string"
          ? (
              message.metadata_json[
                "query_type"
              ] as string
            )
          : undefined,
      classificationConfidence: toNumber(
        message.metadata_json[
          "classification_confidence"
        ],
      ),
      matchedDecisions: toMatchedDecisions(
        message.metadata_json[
          "matched_decisions"
        ],
      ),
      timelineEventCount: toNumber(
        message.metadata_json[
          "timeline_event_count"
        ],
      ),
      graphNodeCount: toNumber(
        message.metadata_json[
          "graph_node_count"
        ],
      ),
      documentResultCount: toNumber(
        message.metadata_json[
          "document_result_count"
        ],
      ),
      evidenceFound: toBoolean(
        message.metadata_json[
          "evidence_found"
        ],
      ),
    },
    createdAt: message.created_at,
  };
}

function CitationCard({
  citation,
}: {
  citation: Citation;
}) {
  const [expanded, setExpanded] =
    useState(false);

  return (
    <article className="citation-card">
      <button
        type="button"
        className="citation-header"
        onClick={() =>
          setExpanded((current) => !current)
        }
      >
        <span className="citation-number">
          {citation.citation_number}
        </span>

        <span className="citation-document">
          <strong>
            {citation.document_name}
          </strong>

          <small>
            {citation.page_number
              ? `Page ${citation.page_number}`
              : citation.section_title ??
                "Document evidence"}
          </small>
        </span>

        <span className="citation-similarity">
          {Math.round(
            citation.similarity * 100,
          )}
          %
        </span>

        {expanded ? (
          <ChevronDown size={17} />
        ) : (
          <ChevronRight size={17} />
        )}
      </button>

      {expanded && (
        <div className="citation-body">
          <p>{citation.excerpt}</p>
        </div>
      )}
    </article>
  );
}

function AssistantMetadata({
  message,
}: {
  message: LocalMessage;
}) {
  const matchedDecisions =
    message.metadata.matchedDecisions ?? [];

  return (
    <div className="assistant-metadata">
      <div className="metadata-badges">
        {message.metadata.queryType && (
          <span className="metadata-badge purple">
            <Sparkles size={13} />
            {message.metadata.queryType}
          </span>
        )}

        {message.metadata
          .classificationConfidence !==
          undefined && (
          <span className="metadata-badge">
            Classification{" "}
            {Math.round(
              message.metadata
                .classificationConfidence * 100,
            )}
            %
          </span>
        )}

        {message.metadata.evidenceFound ===
          true && (
          <span className="metadata-badge green">
            <CheckCircle2 size={13} />
            Evidence found
          </span>
        )}

        {message.metadata.evidenceFound ===
          false && (
          <span className="metadata-badge red">
            <AlertCircle size={13} />
            Limited evidence
          </span>
        )}
      </div>

      {(message.metadata.timelineEventCount ??
        0) > 0 ||
      (message.metadata.graphNodeCount ?? 0) >
        0 ||
      (message.metadata.documentResultCount ??
        0) > 0 ? (
        <div className="context-summary">
          <span>
            <Clock3 size={14} />
            {message.metadata
              .timelineEventCount ?? 0}{" "}
            timeline events
          </span>

          <span>
            <Network size={14} />
            {message.metadata.graphNodeCount ??
              0}{" "}
            graph nodes
          </span>

          <span>
            <FileText size={14} />
            {message.metadata
              .documentResultCount ?? 0}{" "}
            document results
          </span>
        </div>
      ) : null}

      {matchedDecisions.length > 0 && (
        <div className="matched-decision-list">
          <span className="metadata-label">
            Matched decisions
          </span>

          {matchedDecisions.map((decision) => (
            <div
              key={decision.decision_id}
              className="matched-decision"
            >
              <GitBranch size={15} />

              <div>
                <strong>{decision.title}</strong>

                <small>
                  {decision.status} · confidence{" "}
                  {Math.round(
                    decision.confidence_score *
                      100,
                  )}
                  %
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatPage() {
  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  const [workspaceId, setWorkspaceId] =
    useState<string | null>(
      getActiveWorkspaceId(),
    );

  const [conversations, setConversations] =
    useState<Conversation[]>([]);

  const [
    activeConversationId,
    setActiveConversationId,
  ] = useState<string | null>(null);

  const [messages, setMessages] =
    useState<LocalMessage[]>([]);

  const [question, setQuestion] =
    useState("");

  const [loadingConversations, setLoadingConversations] =
    useState(true);

  const [loadingConversation, setLoadingConversation] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadConversations = useCallback(
    async () => {
      if (!workspaceId) {
        setConversations([]);
        setLoadingConversations(false);
        return;
      }

      try {
        const data = await getConversations(
          workspaceId,
        );

        setConversations(data);
        setError(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load conversations",
        );
      } finally {
        setLoadingConversations(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    function handleWorkspaceChange(
      event: Event,
    ) {
      const workspaceEvent =
        event as CustomEvent<string>;

      setWorkspaceId(
        workspaceEvent.detail ??
          getActiveWorkspaceId(),
      );

      setActiveConversationId(null);
      setMessages([]);
      setConversations([]);
      setLoadingConversations(true);
    }

    window.addEventListener(
      "decision-memory-workspace-change",
      handleWorkspaceChange,
    );

    return () => {
      window.removeEventListener(
        "decision-memory-workspace-change",
        handleWorkspaceChange,
      );
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function openConversation(
    conversationId: string,
  ) {
    if (!workspaceId) {
      return;
    }

    setLoadingConversation(true);
    setError(null);

    try {
      const detail = await getConversation(
        workspaceId,
        conversationId,
      );

      setMessages(
        detail.messages.map(
          convertStoredMessage,
        ),
      );

      setActiveConversationId(
        conversationId,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to open conversation",
      );
    } finally {
      setLoadingConversation(false);
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setQuestion("");
    setError(null);
  }

  async function handleDeleteConversation(
    event: React.MouseEvent,
    conversation: Conversation,
  ) {
    event.stopPropagation();

    if (!workspaceId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${conversation.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteConversation(
        workspaceId,
        conversation.id,
      );

      setConversations((current) =>
        current.filter(
          (item) =>
            item.id !== conversation.id,
        ),
      );

      if (
        activeConversationId ===
        conversation.id
      ) {
        startNewConversation();
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete conversation",
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !workspaceId ||
      !question.trim() ||
      sending
    ) {
      return;
    }

    const submittedQuestion =
      question.trim();

    const temporaryUserMessage: LocalMessage = {
      id: `temporary-user-${Date.now()}`,
      role: "user",
      content: submittedQuestion,
      citations: [],
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [
      ...current,
      temporaryUserMessage,
    ]);

    setQuestion("");
    setSending(true);
    setError(null);

    try {
      const response = await sendChatMessage(
        workspaceId,
        {
          question: submittedQuestion,
          conversation_id:
            activeConversationId ?? undefined,
          limit: 5,
          minimum_similarity: 0.1,
        },
      );

      const assistantMessage: LocalMessage = {
        id: response.message_id,
        role: "assistant",
        content: response.answer,
        citations: response.citations,
        metadata: {
          queryType: response.query_type,
          classificationConfidence:
            response.classification_confidence,
          matchedDecisions:
            response.matched_decisions,
          timelineEventCount:
            response.timeline_event_count,
          graphNodeCount:
            response.graph_node_count,
          documentResultCount:
            response.document_result_count,
          evidenceFound:
            response.evidence_found,
        },
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);

      setActiveConversationId(
        response.conversation_id,
      );

      await loadConversations();
    } catch (requestError) {
      setMessages((current) =>
        current.filter(
          (message) =>
            message.id !==
            temporaryUserMessage.id,
        ),
      );

      setQuestion(submittedQuestion);

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send message",
      );
    } finally {
      setSending(false);
    }
  }

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.id ===
          activeConversationId,
      ),
    [
      conversations,
      activeConversationId,
    ],
  );

  const suggestionQuestions = [
    "Why did the team migrate from MongoDB to PostgreSQL?",
    "Who approved the database migration?",
    "Which alternatives were considered?",
    "What was the timeline leading to rollout?",
  ];

  if (!workspaceId) {
    return (
      <div className="page chat-page">
        <div className="empty-state large">
          <MessageSquareText size={40} />

          <h1>No active workspace</h1>

          <p>
            Select or create a workspace from the
            Overview page before starting a
            decision conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-shell">
      <aside className="conversation-sidebar">
        <div className="conversation-sidebar-header">
          <div>
            <p className="eyebrow">
              Decision conversations
            </p>

            <h2>Chat history</h2>
          </div>

          <button
            type="button"
            className="icon-button"
            title="New conversation"
            onClick={startNewConversation}
          >
            <Plus size={18} />
          </button>
        </div>

        <button
          type="button"
          className="new-chat-button"
          onClick={startNewConversation}
        >
          <Plus size={17} />
          New conversation
        </button>

        <div className="conversation-list">
          {loadingConversations && (
            <div className="conversation-loading">
              <LoaderCircle
                size={17}
                className="spin"
              />
              Loading...
            </div>
          )}

          {!loadingConversations &&
            conversations.length === 0 && (
            <div className="conversation-empty">
              <MessageSquareText size={25} />
              <p>No conversations yet.</p>
            </div>
          )}

          {conversations.map(
            (conversation) => (
              <div
                key={conversation.id}
                className={
                  activeConversationId ===
                  conversation.id
                    ? "conversation-item active"
                    : "conversation-item"
                }
              >
                <button
                  type="button"
                  className="conversation-open"
                  onClick={() =>
                    void openConversation(
                      conversation.id,
                    )
                  }
                >
                  <MessageSquareText size={16} />

                  <span>
                    <strong>
                      {conversation.title}
                    </strong>

                    <small>
                      {formatRelativeDate(
                        conversation.updated_at,
                      )}
                    </small>
                  </span>
                </button>

                <button
                  type="button"
                  className="conversation-delete"
                  title="Delete conversation"
                  onClick={(event) =>
                    void handleDeleteConversation(
                      event,
                      conversation,
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          )}
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <p className="eyebrow">
              Decision-aware RAG
            </p>

            <h1>
              {activeConversation?.title ??
                "Ask Decision Memory"}
            </h1>

            <p>
              Answers combine structured decisions,
              timeline events, graph relationships,
              and source evidence.
            </p>
          </div>

          <div className="chat-model-status">
            <span />
            Local AI active
          </div>
        </header>

        {error && (
          <div className="chat-error">
            <AlertCircle size={17} />
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError(null)}
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="message-area">
          {loadingConversation && (
            <div className="chat-center-loader">
              <LoaderCircle
                size={23}
                className="spin"
              />

              Loading conversation...
            </div>
          )}

          {!loadingConversation &&
            messages.length === 0 && (
            <div className="chat-welcome">
              <div className="chat-welcome-icon">
                <BrainCircuit size={31} />
              </div>

              <p className="eyebrow">
                Organizational intelligence
              </p>

              <h2>
                Understand why decisions happened.
              </h2>

              <p>
                Ask questions about reasons,
                approvers, alternatives, timelines,
                systems, incidents, and current
                decision status.
              </p>

              <div className="suggestion-grid">
                {suggestionQuestions.map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() =>
                        setQuestion(suggestion)
                      }
                    >
                      <Sparkles size={16} />
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {!loadingConversation &&
            messages.map((message) => (
              <article
                key={message.id}
                className={`chat-message ${message.role}`}
              >
                <div className="message-avatar">
                  {message.role === "assistant" ? (
                    <BrainCircuit size={18} />
                  ) : (
                    "You"
                  )}
                </div>

                <div className="message-content">
                  <div className="message-heading">
                    <strong>
                      {message.role === "assistant"
                        ? "Decision Memory"
                        : "You"}
                    </strong>

                    <span>
                      {formatRelativeDate(
                        message.createdAt,
                      )}
                    </span>
                  </div>

                  <div className="message-text">
                    {message.content
                      .split("\n")
                      .map((line, index) => (
                        <p key={`${message.id}-${index}`}>
                          {line || "\u00A0"}
                        </p>
                      ))}
                  </div>

                  {message.role === "assistant" && (
                    <>
                      <AssistantMetadata
                        message={message}
                      />

                      {message.citations.length >
                        0 && (
                        <div className="citation-list">
                          <span className="metadata-label">
                            Source citations
                          </span>

                          {message.citations.map(
                            (citation) => (
                              <CitationCard
                                key={`${message.id}-${citation.chunk_id}`}
                                citation={
                                  citation
                                }
                              />
                            ),
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}

          {sending && (
            <article className="chat-message assistant">
              <div className="message-avatar">
                <BrainCircuit size={18} />
              </div>

              <div className="message-content">
                <div className="assistant-thinking">
                  <LoaderCircle
                    size={18}
                    className="spin"
                  />

                  <div>
                    <strong>
                      Reconstructing decision context
                    </strong>

                    <span>
                      Searching decisions, documents,
                      timeline, and graph…
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="chat-composer-wrapper">
          <form
            className="chat-composer"
            onSubmit={handleSubmit}
          >
            <textarea
              value={question}
              onChange={(event) =>
                setQuestion(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask why a decision happened, who approved it, or what alternatives were considered..."
              rows={3}
              disabled={sending}
            />

            <div className="composer-footer">
              <span>
                Enter to send · Shift + Enter for a
                new line
              </span>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  sending || !question.trim()
                }
              >
                {sending ? (
                  <LoaderCircle
                    size={17}
                    className="spin"
                  />
                ) : (
                  <Send size={17} />
                )}

                Send
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
