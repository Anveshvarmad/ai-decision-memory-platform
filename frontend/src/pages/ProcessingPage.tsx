import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Radio,
  RotateCw,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  useWorkspaceProcessingStream,
} from "../hooks/useWorkspaceProcessingStream";

import {
  getActiveWorkspaceId,
} from "../lib/workspace";

import type {
  WorkspaceProcessingDocument,
} from "../types/api";


function statusIcon(
  item: WorkspaceProcessingDocument,
) {
  if (
    ["failed", "error", "cancelled"]
      .includes(
        item.status.toLowerCase(),
      )
  ) {
    return <XCircle size={18} />;
  }

  if (item.terminal) {
    return (
      <CheckCircle2 size={18} />
    );
  }

  return (
    <LoaderCircle
      size={18}
      className="spin"
    />
  );
}


function ProcessingDocumentCard({
  item,
}: {
  item: WorkspaceProcessingDocument;
}) {
  const failed = [
    "failed",
    "error",
    "cancelled",
  ].includes(
    item.status.toLowerCase(),
  );

  return (
    <article
      className={[
        "processing-document-card",
        failed ? "failed" : "",
        item.terminal
          ? "terminal"
          : "active",
      ].join(" ")}
    >
      <div className="processing-document-icon">
        {statusIcon(item)}
      </div>

      <div className="processing-document-body">
        <div className="processing-document-heading">
          <div>
            <strong>
              {item.filename}
            </strong>

            <span>
              {item.stage.replaceAll(
                "_",
                " ",
              )}
            </span>
          </div>

          <b>{item.progress}%</b>
        </div>

        <p>{item.message}</p>

        <div className="processing-document-meter">
          <div
            style={{
              width:
                `${item.progress}%`,
            }}
          />
        </div>

        {item.error_message && (
          <small className="processing-error">
            {item.error_message}
          </small>
        )}
      </div>
    </article>
  );
}


export function ProcessingPage() {
  const [
    workspaceId,
    setWorkspaceId,
  ] = useState<string | null>(
    getActiveWorkspaceId(),
  );

  const {
    snapshot,
    connected,
    error,
  } = useWorkspaceProcessingStream(
    workspaceId,
  );

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

    return () =>
      window.removeEventListener(
        "decision-memory-workspace-change",
        handleWorkspaceChange,
      );
  }, []);

  if (!workspaceId) {
    return (
      <div className="page">
        <div className="empty-state large">
          <FileText size={40} />
          <h1>No active workspace</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page processing-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Real-time pipeline visibility
          </p>

          <h1>Processing Center</h1>

          <p className="page-description">
            Track extraction, chunking,
            embedding, indexing, and document
            intelligence across the workspace.
          </p>
        </div>

        <span
          className={
            connected
              ? "processing-live connected"
              : "processing-live"
          }
        >
          <Radio size={14} />

          {connected
            ? "Live stream"
            : "Disconnected"}
        </span>
      </header>

      {error && (
        <div className="page-error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <section className="processing-stat-grid">
        <article>
          <RotateCw size={19} />
          <span>Active</span>
          <strong>
            {snapshot?.active_count ?? 0}
          </strong>
        </article>

        <article>
          <CheckCircle2 size={19} />
          <span>Recently completed</span>
          <strong>
            {snapshot?.completed_count ?? 0}
          </strong>
        </article>

        <article>
          <XCircle size={19} />
          <span>Recent failures</span>
          <strong>
            {snapshot?.failed_count ?? 0}
          </strong>
        </article>
      </section>

      <section className="processing-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              Active pipeline
            </p>

            <h2>
              Documents being processed
            </h2>
          </div>

          <LoaderCircle
            size={18}
            className={
              snapshot?.active_count
                ? "spin"
                : ""
            }
          />
        </div>

        {snapshot?.active_documents
          .length ? (
          <div className="processing-document-list">
            {snapshot.active_documents.map(
              (item) => (
                <ProcessingDocumentCard
                  key={item.document_id}
                  item={item}
                />
              ),
            )}
          </div>
        ) : (
          <div className="processing-empty">
            <Clock3 size={30} />
            <h3>No active processing jobs</h3>
            <p>
              Uploaded documents will appear
              here automatically.
            </p>
          </div>
        )}
      </section>

      <section className="processing-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              Processing history
            </p>

            <h2>Recent results</h2>
          </div>
        </div>

        {snapshot?.recent_documents
          .length ? (
          <div className="processing-document-list">
            {snapshot.recent_documents.map(
              (item) => (
                <ProcessingDocumentCard
                  key={item.document_id}
                  item={item}
                />
              ),
            )}
          </div>
        ) : (
          <div className="processing-empty compact">
            <FileText size={25} />
            <p>
              No recently processed documents.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
