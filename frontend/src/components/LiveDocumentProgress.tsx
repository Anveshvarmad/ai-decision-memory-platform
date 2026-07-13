import {
  CheckCircle2,
  Circle,
  LoaderCircle,
  Radio,
  XCircle,
} from "lucide-react";

import type {
  DocumentProcessingEvent,
} from "../types/api";


const STAGES = [
  {
    id: "queued",
    label: "Queued",
  },
  {
    id: "extracting",
    label: "Extracting",
  },
  {
    id: "chunking",
    label: "Chunking",
  },
  {
    id: "embedding",
    label: "Embedding",
  },
  {
    id: "finalizing",
    label: "Finalizing",
  },
  {
    id: "completed",
    label: "Ready",
  },
];


function stageIndex(stage: string): number {
  const exactIndex =
    STAGES.findIndex(
      (item) => item.id === stage,
    );

  if (exactIndex >= 0) {
    return exactIndex;
  }

  if (
    [
      "indexing",
      "detecting_decisions",
      "building_graph",
      "building_timeline",
    ].includes(stage)
  ) {
    return 4;
  }

  return 0;
}


export function LiveDocumentProgress({
  event,
  connected,
}: {
  event: DocumentProcessingEvent;
  connected: boolean;
}) {
  const currentStageIndex =
    stageIndex(event.stage);

  const failed = [
    "failed",
    "error",
    "cancelled",
  ].includes(
    event.status.toLowerCase(),
  );

  return (
    <section className="live-document-progress">
      <div className="live-progress-header">
        <div>
          <span className="metadata-label">
            Live processing
          </span>

          <h3>{event.message}</h3>
        </div>

        <span
          className={
            connected
              ? "live-indicator connected"
              : "live-indicator"
          }
        >
          <Radio size={13} />

          {connected
            ? "Live"
            : event.terminal
              ? "Finished"
              : "Disconnected"}
        </span>
      </div>

      <div className="live-progress-meter">
        <div
          style={{
            width: `${event.progress}%`,
          }}
        />
      </div>

      <div className="live-progress-meta">
        <strong>
          {event.progress}%
        </strong>

        <span>{event.status}</span>
      </div>

      <div className="live-stage-list">
        {STAGES.map(
          (stage, index) => {
            const completed =
              !failed &&
              (
                index <
                  currentStageIndex ||
                event.terminal
              );

            const active =
              !failed &&
              index ===
                currentStageIndex &&
              !event.terminal;

            return (
              <article
                key={stage.id}
                className={[
                  completed
                    ? "completed"
                    : "",
                  active
                    ? "active"
                    : "",
                  failed
                    ? "failed"
                    : "",
                ].join(" ")}
              >
                <span>
                  {failed &&
                  index ===
                    currentStageIndex ? (
                    <XCircle
                      size={16}
                    />
                  ) : completed ? (
                    <CheckCircle2
                      size={16}
                    />
                  ) : active ? (
                    <LoaderCircle
                      size={16}
                      className="spin"
                    />
                  ) : (
                    <Circle
                      size={16}
                    />
                  )}
                </span>

                <small>
                  {stage.label}
                </small>
              </article>
            );
          },
        )}
      </div>

      {event.error_message && (
        <div className="live-progress-error">
          {event.error_message}
        </div>
      )}
    </section>
  );
}
