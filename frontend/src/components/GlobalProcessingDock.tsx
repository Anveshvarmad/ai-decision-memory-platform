import {
  Bell,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Radio,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useWorkspaceProcessing,
} from "../contexts/WorkspaceProcessingContext";


export function GlobalProcessingDock() {
  const navigate = useNavigate();

  const [expanded, setExpanded] =
    useState(false);

  const {
    snapshot,
    connected,
    error,
    notifications,
    browserNotificationsEnabled,
    enableBrowserNotifications,
    dismissNotification,
    clearNotifications,
  } = useWorkspaceProcessing();

  const activeDocuments =
    snapshot?.active_documents ?? [];

  const hasActivity =
    activeDocuments.length > 0 ||
    notifications.length > 0 ||
    Boolean(error);

  if (!hasActivity) {
    return null;
  }

  return (
    <aside
      className={[
        "global-processing-dock",
        expanded ? "expanded" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="global-processing-summary"
        onClick={() =>
          setExpanded(
            (current) => !current,
          )
        }
      >
        <span
          className={[
            "global-processing-status",
            connected
              ? "connected"
              : "",
          ].join(" ")}
        >
          {activeDocuments.length > 0 ? (
            <LoaderCircle
              size={17}
              className="spin"
            />
          ) : connected ? (
            <Radio size={17} />
          ) : (
            <XCircle size={17} />
          )}
        </span>

        <span>
          <strong>
            {activeDocuments.length > 0
              ? `${activeDocuments.length} document${
                  activeDocuments.length ===
                  1
                    ? ""
                    : "s"
                } processing`
              : notifications.length > 0
                ? `${notifications.length} new update${
                    notifications.length ===
                    1
                      ? ""
                      : "s"
                  }`
                : "Processing disconnected"}
          </strong>

          <small>
            {activeDocuments.length > 0
              ? activeDocuments[0].message
              : connected
                ? "Workspace stream connected"
                : error ??
                  "Live stream unavailable"}
          </small>
        </span>

        {expanded ? (
          <ChevronDown size={17} />
        ) : (
          <ChevronUp size={17} />
        )}
      </button>

      {expanded && (
        <div className="global-processing-panel">
          <div className="global-processing-toolbar">
            <div>
              <span
                className={
                  connected
                    ? "connected"
                    : ""
                }
              >
                <Radio size={12} />
                {connected
                  ? "Live"
                  : "Offline"}
              </span>

              <button
                type="button"
                onClick={() =>
                  void enableBrowserNotifications()
                }
              >
                {browserNotificationsEnabled ? (
                  <BellRing size={14} />
                ) : (
                  <Bell size={14} />
                )}

                {browserNotificationsEnabled
                  ? "Alerts enabled"
                  : "Enable alerts"}
              </button>
            </div>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={
                  clearNotifications
                }
              >
                <Trash2 size={14} />
                Clear
              </button>
            )}
          </div>

          {activeDocuments.length > 0 && (
            <section className="global-active-jobs">
              <h4>Active processing</h4>

              {activeDocuments.map(
                (item) => (
                  <button
                    key={item.document_id}
                    type="button"
                    className="global-active-job"
                    onClick={() =>
                      navigate(
                        "/app/processing",
                      )
                    }
                  >
                    <LoaderCircle
                      size={16}
                      className="spin"
                    />

                    <span>
                      <strong>
                        {item.filename}
                      </strong>

                      <small>
                        {item.stage.replaceAll(
                          "_",
                          " ",
                        )}
                      </small>
                    </span>

                    <b>
                      {item.progress}%
                    </b>

                    <i>
                      <span
                        style={{
                          width:
                            `${item.progress}%`,
                        }}
                      />
                    </i>
                  </button>
                ),
              )}
            </section>
          )}

          {notifications.length > 0 && (
            <section className="global-processing-notifications">
              <h4>Recent updates</h4>

              {notifications.map(
                (notification) => (
                  <article
                    key={notification.id}
                    className={
                      notification.type
                    }
                  >
                    <span>
                      {notification.type ===
                      "completed" ? (
                        <CheckCircle2
                          size={17}
                        />
                      ) : (
                        <XCircle
                          size={17}
                        />
                      )}
                    </span>

                    <div>
                      <strong>
                        {
                          notification.filename
                        }
                      </strong>

                      <p>
                        {
                          notification.message
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        dismissNotification(
                          notification.id,
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  </article>
                ),
              )}
            </section>
          )}

          <button
            type="button"
            className="global-processing-open"
            onClick={() => {
              setExpanded(false);
              navigate(
                "/app/processing",
              );
            }}
          >
            Open Processing Center
          </button>
        </div>
      )}
    </aside>
  );
}
