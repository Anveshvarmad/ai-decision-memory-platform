import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  useWorkspaceProcessingStream,
} from "../hooks/useWorkspaceProcessingStream";

import {
  getActiveWorkspaceId,
} from "../lib/workspace";

import type {
  WorkspaceProcessingDocument,
  WorkspaceProcessingEvent,
} from "../types/api";


export interface ProcessingNotification {
  id: string;
  documentId: string;
  filename: string;
  type:
    | "completed"
    | "failed";
  message: string;
  createdAt: string;
}


interface WorkspaceProcessingContextValue {
  workspaceId: string | null;
  snapshot:
    | WorkspaceProcessingEvent
    | null;
  connected: boolean;
  error: string | null;
  notifications:
    ProcessingNotification[];
  browserNotificationsEnabled: boolean;

  enableBrowserNotifications:
    () => Promise<void>;

  dismissNotification:
    (notificationId: string) => void;

  clearNotifications: () => void;
}


const WorkspaceProcessingContext =
  createContext<
    WorkspaceProcessingContextValue
    | undefined
  >(undefined);


const NOTIFICATION_SETTING_KEY =
  "decision-memory-browser-notifications";


function isFailed(
  item: WorkspaceProcessingDocument,
): boolean {
  return [
    "failed",
    "error",
    "cancelled",
  ].includes(
    item.status.toLowerCase(),
  );
}


function notificationId(
  item: WorkspaceProcessingDocument,
): string {
  return [
    item.document_id,
    item.status,
    item.updated_at ?? item.progress,
  ].join(":");
}


export function WorkspaceProcessingProvider({
  children,
}: {
  children: ReactNode;
}) {
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

  const [
    notifications,
    setNotifications,
  ] = useState<
    ProcessingNotification[]
  >([]);

  const [
    browserNotificationsEnabled,
    setBrowserNotificationsEnabled,
  ] = useState(
    () =>
      localStorage.getItem(
        NOTIFICATION_SETTING_KEY,
      ) === "enabled",
  );

  const seenTerminalEvents =
    useRef(new Set<string>());

  const initialSnapshotLoaded =
    useRef(false);


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

      setNotifications([]);
      seenTerminalEvents.current.clear();
      initialSnapshotLoaded.current =
        false;
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


  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (!initialSnapshotLoaded.current) {
      snapshot.recent_documents.forEach(
        (item) => {
          seenTerminalEvents.current.add(
            notificationId(item),
          );
        },
      );

      initialSnapshotLoaded.current =
        true;

      return;
    }

    const newNotifications:
      ProcessingNotification[] = [];

    snapshot.recent_documents.forEach(
      (item) => {
        const id =
          notificationId(item);

        if (
          seenTerminalEvents.current.has(
            id,
          )
        ) {
          return;
        }

        seenTerminalEvents.current.add(
          id,
        );

        const failed = isFailed(item);

        newNotifications.push({
          id,
          documentId:
            item.document_id,
          filename: item.filename,
          type: failed
            ? "failed"
            : "completed",
          message: failed
            ? (
                item.error_message ??
                `${item.filename} could not be processed.`
              )
            : `${item.filename} is ready.`,
          createdAt:
            item.updated_at ??
            new Date().toISOString(),
        });
      },
    );

    if (
      newNotifications.length === 0
    ) {
      return;
    }

    setNotifications((current) =>
      [
        ...newNotifications,
        ...current,
      ].slice(0, 20),
    );

    if (
      browserNotificationsEnabled &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission
        === "granted"
    ) {
      newNotifications.forEach(
        (notification) => {
          new Notification(
            notification.type ===
              "completed"
              ? "Document ready"
              : "Processing failed",
            {
              body:
                notification.message,
              tag: notification.id,
            },
          );
        },
      );
    }
  }, [
    snapshot,
    browserNotificationsEnabled,
  ]);


  useEffect(() => {
    const originalTitle =
      "Decision Memory";

    if (
      snapshot &&
      snapshot.active_count > 0
    ) {
      document.title =
        `(${snapshot.active_count}) Processing · ${originalTitle}`;
    } else {
      document.title =
        originalTitle;
    }

    return () => {
      document.title =
        originalTitle;
    };
  }, [snapshot]);


  async function enableBrowserNotifications() {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      return;
    }

    const permission =
      await Notification
        .requestPermission();

    const enabled =
      permission === "granted";

    setBrowserNotificationsEnabled(
      enabled,
    );

    if (enabled) {
      localStorage.setItem(
        NOTIFICATION_SETTING_KEY,
        "enabled",
      );
    } else {
      localStorage.removeItem(
        NOTIFICATION_SETTING_KEY,
      );
    }
  }


  function dismissNotification(
    notificationIdValue: string,
  ) {
    setNotifications((current) =>
      current.filter(
        (notification) =>
          notification.id !==
          notificationIdValue,
      ),
    );
  }


  function clearNotifications() {
    setNotifications([]);
  }


  const value = useMemo(
    () => ({
      workspaceId,
      snapshot,
      connected,
      error,
      notifications,
      browserNotificationsEnabled,
      enableBrowserNotifications,
      dismissNotification,
      clearNotifications,
    }),
    [
      workspaceId,
      snapshot,
      connected,
      error,
      notifications,
      browserNotificationsEnabled,
    ],
  );


  return (
    <WorkspaceProcessingContext.Provider
      value={value}
    >
      {children}
    </WorkspaceProcessingContext.Provider>
  );
}


export function useWorkspaceProcessing() {
  const context = useContext(
    WorkspaceProcessingContext,
  );

  if (!context) {
    throw new Error(
      "useWorkspaceProcessing must be used inside WorkspaceProcessingProvider.",
    );
  }

  return context;
}
