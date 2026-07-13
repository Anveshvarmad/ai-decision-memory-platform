import {
  AlertCircle,
  CheckCircle2,
  File,
  FileJson,
  FileText,
  LoaderCircle,
  MoreVertical,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  deleteDocument,
  extractDocumentDecisions,
  getDocuments,
  retryDocument,
  uploadDocument,
} from "../lib/api";

import {
  getActiveWorkspaceId,
} from "../lib/workspace";

import {
  LiveDocumentProgress,
} from "../components/LiveDocumentProgress";

import {
  useDocumentProcessingStream,
} from "../hooks/useDocumentProcessingStream";

import type {
  DocumentRecord,
  DocumentStatus,
} from "../types/api";


function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function getFileIcon(filename: string) {
  const extension =
    filename.split(".").pop()?.toLowerCase();

  if (extension === "json") {
    return FileJson;
  }

  if (
    extension === "txt" ||
    extension === "md" ||
    extension === "markdown"
  ) {
    return FileText;
  }

  return File;
}

function getStatusLabel(
  status: DocumentStatus,
): string {
  const labels: Record<DocumentStatus, string> = {
    pending: "Queued",
    processing: "Extracting",
    embedding: "Embedding",
    completed: "Ready",
    failed: "Failed",
  };

  return labels[status];
}

export function DocumentsPage() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [workspaceId, setWorkspaceId] =
    useState<string | null>(
      getActiveWorkspaceId(),
    );

  const [documents, setDocuments] =
    useState<DocumentRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] =
    useState(false);

  const [dragActive, setDragActive] =
    useState(false);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [error, setError] =
    useState<string | null>(null);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [activeAction, setActiveAction] =
    useState<string | null>(null);

  const loadDocuments = useCallback(
    async (showLoader = false) => {
      if (!workspaceId) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      try {
        const data = await getDocuments(
          workspaceId,
        );

        setDocuments(data);
        setError(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load documents",
        );
      } finally {
        setLoading(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    void loadDocuments(true);
  }, [loadDocuments]);

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


  async function handleFiles(files: FileList | File[]) {
    if (!workspaceId) {
      setError(
        "Select or create a workspace before uploading documents.",
      );
      return;
    }

    const selectedFiles = Array.from(files);

    if (selectedFiles.length === 0) {
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);

    const failures: string[] = [];

    for (const file of selectedFiles) {
      try {
        const response = await uploadDocument(
          workspaceId,
          file,
        );

        setDocuments((current) => [
          response.document,
          ...current.filter(
            (document) =>
              document.id !== response.document.id,
          ),
        ]);
      } catch (requestError) {
        failures.push(
          `${file.name}: ${
            requestError instanceof Error
              ? requestError.message
              : "Upload failed"
          }`,
        );
      }
    }

    setUploading(false);

    if (failures.length > 0) {
      setError(failures.join(" | "));
    } else {
      setNotice(
        `${selectedFiles.length} document${
          selectedFiles.length === 1
            ? ""
            : "s"
        } queued for processing.`,
      );
    }

    void loadDocuments();
  }

  function handleFileInput(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    if (event.target.files) {
      void handleFiles(event.target.files);
    }

    event.target.value = "";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    setDragActive(false);

    void handleFiles(event.dataTransfer.files);
  }

  async function handleRetry(
    document: DocumentRecord,
  ) {
    if (!workspaceId) {
      return;
    }

    setActiveAction(document.id);
    setError(null);

    try {
      await retryDocument(
        workspaceId,
        document.id,
      );

      setNotice(
        `${document.original_filename} was queued again.`,
      );

      await loadDocuments();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to retry document",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleDelete(
    document: DocumentRecord,
  ) {
    if (!workspaceId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${document.original_filename}?`,
    );

    if (!confirmed) {
      return;
    }

    setActiveAction(document.id);
    setError(null);

    try {
      await deleteDocument(
        workspaceId,
        document.id,
      );

      setDocuments((current) =>
        current.filter(
          (item) =>
            item.id !== document.id,
        ),
      );

      setNotice(
        `${document.original_filename} was deleted.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete document",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleExtractDecisions(
    document: DocumentRecord,
  ) {
    if (!workspaceId) {
      return;
    }

    setActiveAction(document.id);
    setError(null);

    try {
      await extractDocumentDecisions(
        workspaceId,
        document.id,
      );

      setNotice(
        `Decision extraction started for ${document.original_filename}.`,
      );

      await loadDocuments();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start decision extraction",
      );
    } finally {
      setActiveAction(null);
    }
  }

  const filteredDocuments = useMemo(() => {
    const normalized =
      searchTerm.trim().toLowerCase();

    if (!normalized) {
      return documents;
    }

    return documents.filter((document) =>
      document.original_filename
        .toLowerCase()
        .includes(normalized),
    );
  }, [documents, searchTerm]);

  const completedCount = documents.filter(
    (document) =>
      document.status === "completed",
  ).length;

  const processingCount = documents.filter(
    (document) =>
      ["pending", "processing", "embedding"].includes(
        document.status,
      ),
  ).length;

  const failedCount = documents.filter(
    (document) =>
      document.status === "failed",
  ).length;

  if (!workspaceId) {
    return (
      <div className="page documents-page">
        <div className="empty-state large">
          <UploadCloud size={38} />
          <h1>No active workspace</h1>
          <p>
            Return to Overview and select or create
            a workspace before uploading documents.
          </p>
        </div>
      </div>
    );
  }

  const activeProcessingDocument =
    documents.find((document) =>
      [
        "pending",
        "queued",
        "processing",
        "extracting",
        "chunking",
        "embedding",
        "indexing",
        "detecting_decisions",
        "building_graph",
        "building_timeline",
      ].includes(document.status),
    ) ?? null;

  const {
    event: liveProcessingEvent,
    connected: liveProcessingConnected,
    error: liveProcessingError,
  } = useDocumentProcessingStream({
    workspaceId: workspaceId,
    documentId:
      activeProcessingDocument?.id ?? null,
    enabled: Boolean(
      activeProcessingDocument,
    ),
    onCompleted: () => {
      void loadDocuments();
    },
  });

  useEffect(() => {
    if (!liveProcessingEvent) {
      return;
    }

    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id ===
        liveProcessingEvent.document_id
          ? {
              ...document,
              status:
                liveProcessingEvent.status as DocumentRecord["status"],
              processing_progress:
                liveProcessingEvent.progress,
            }
          : document,
      ),
    );
  }, [liveProcessingEvent]);


  return (
    <div className="page documents-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Knowledge ingestion
          </p>

          <h1>Documents</h1>

          <p className="page-description">
            Upload source material and monitor
            extraction, chunking, embedding, and
            decision detection.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={uploading}
        >
          {uploading ? (
            <LoaderCircle
              size={18}
              className="spin"
            />
          ) : (
            <UploadCloud size={18} />
          )}

          {uploading
            ? "Uploading..."
            : "Upload documents"}
        </button>

        <input
          ref={fileInputRef}
          hidden
          multiple
          type="file"
          accept=".pdf,.txt,.md,.markdown,.csv,.json"
          onChange={handleFileInput}
        />
      </header>

      {liveProcessingEvent && (
        <LiveDocumentProgress
          event={liveProcessingEvent}
          connected={
            liveProcessingConnected
          }
        />
      )}

      {liveProcessingError && (
        <div className="page-error">
          <span>
            Live updates disconnected:{" "}
            {liveProcessingError}
          </span>
        </div>
      )}


      {error && (
        <div className="page-error">
          <AlertCircle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="page-notice">
          <CheckCircle2 size={18} />
          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="document-stat-grid">
        <article className="mini-stat-card">
          <span>Total documents</span>
          <strong>{documents.length}</strong>
        </article>

        <article className="mini-stat-card">
          <span>Ready</span>
          <strong>{completedCount}</strong>
        </article>

        <article className="mini-stat-card">
          <span>Processing</span>
          <strong>{processingCount}</strong>
        </article>

        <article className="mini-stat-card">
          <span>Failed</span>
          <strong>{failedCount}</strong>
        </article>
      </section>

      <section
        className={
          dragActive
            ? "upload-drop-zone active"
            : "upload-drop-zone"
        }
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() =>
          setDragActive(false)
        }
        onDrop={handleDrop}
      >
        <div className="upload-zone-icon">
          <UploadCloud size={30} />
        </div>

        <div>
          <h2>
            Drop organizational files here
          </h2>

          <p>
            PDF, TXT, Markdown, CSV, and JSON.
            Maximum file size is 10 MB.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={uploading}
        >
          Browse files
        </button>
      </section>

      <section className="documents-panel">
        <div className="documents-toolbar">
          <div>
            <h2>Workspace documents</h2>
            <p>
              Background progress refreshes
              automatically.
            </p>
          </div>

          <div className="table-actions">
            <div className="search-field">
              <Search size={17} />

              <input
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value,
                  )
                }
                placeholder="Search documents"
              />
            </div>

            <button
              type="button"
              className="icon-button"
              title="Refresh"
              onClick={() =>
                void loadDocuments(true)
              }
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="loading-list">
            <LoaderCircle
              size={22}
              className="spin"
            />
            Loading documents...
          </div>
        )}

        {!loading &&
          filteredDocuments.length === 0 && (
            <div className="empty-state">
              <FileText size={32} />
              <h3>No documents found</h3>
              <p>
                Upload your first source file to
                begin building organizational
                decision memory.
              </p>
            </div>
          )}

        {!loading &&
          filteredDocuments.length > 0 && (
            <div className="document-list">
              {filteredDocuments.map(
                (document) => {
                  const FileIcon =
                    getFileIcon(
                      document.original_filename,
                    );

                  const rawExtractionStatus =
                    document.metadata_json[
                      "decision_extraction_status"
                    ];

                  const extractionStatus =
                    typeof rawExtractionStatus === "string"
                      ? rawExtractionStatus
                      : null;

                  return (
                    <article
                      key={document.id}
                      className="document-row"
                    >
                      <div className="document-file-icon">
                        <FileIcon size={22} />
                      </div>

                      <div className="document-main">
                        <div className="document-title-row">
                          <strong>
                            {
                              document.original_filename
                            }
                          </strong>

                          <span
                            className={`document-status ${document.status}`}
                          >
                            {document.status ===
                              "completed" && (
                              <CheckCircle2
                                size={13}
                              />
                            )}

                            {document.status ===
                              "failed" && (
                              <AlertCircle
                                size={13}
                              />
                            )}

                            {[
                              "pending",
                              "processing",
                              "embedding",
                            ].includes(
                              document.status,
                            ) && (
                              <LoaderCircle
                                size={13}
                                className="spin"
                              />
                            )}

                            {getStatusLabel(
                              document.status,
                            )}
                          </span>
                        </div>

                        <div className="document-details">
                          <span>
                            {formatFileSize(
                              document.file_size,
                            )}
                          </span>

                          <span>
                            {formatDate(
                              document.created_at,
                            )}
                          </span>

                          {typeof document
                            .metadata_json[
                            "chunk_count"
                          ] === "number" && (
                            <span>
                              {
                                document
                                  .metadata_json[
                                  "chunk_count"
                                ] as number
                              }{" "}
                              chunks
                            </span>
                          )}

                          {extractionStatus !== null && (
                            <span>
                              Decision extraction:{" "}
                              {extractionStatus}
                            </span>
                          )}
                        </div>

                        {document.status !==
                          "completed" &&
                          document.status !==
                            "failed" && (
                            <div className="progress-track">
                              <div
                                style={{
                                  width: `${Math.max(
                                    document.processing_progress,
                                    4,
                                  )}%`,
                                }}
                              />

                              <span>
                                {
                                  document.processing_progress
                                }
                                %
                              </span>
                            </div>
                          )}

                        {document.error_message && (
                          <p className="document-error">
                            {
                              document.error_message
                            }
                          </p>
                        )}
                      </div>

                      <div className="document-actions">
                        {document.status ===
                          "completed" && (
                          <button
                            type="button"
                            className="action-button"
                            disabled={
                              activeAction ===
                              document.id
                            }
                            onClick={() =>
                              void handleExtractDecisions(
                                document,
                              )
                            }
                          >
                            <Sparkles size={16} />
                            Extract decisions
                          </button>
                        )}

                        {document.status ===
                          "failed" && (
                          <button
                            type="button"
                            className="action-button"
                            disabled={
                              activeAction ===
                              document.id
                            }
                            onClick={() =>
                              void handleRetry(
                                document,
                              )
                            }
                          >
                            <RefreshCw size={16} />
                            Retry
                          </button>
                        )}

                        <button
                          type="button"
                          className="danger-icon-button"
                          title="Delete document"
                          disabled={
                            activeAction ===
                            document.id
                          }
                          onClick={() =>
                            void handleDelete(
                              document,
                            )
                          }
                        >
                          <Trash2 size={17} />
                        </button>

                        <button
                          type="button"
                          className="icon-button"
                          title="More options"
                        >
                          <MoreVertical size={17} />
                        </button>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          )}
      </section>
    </div>
  );
}
