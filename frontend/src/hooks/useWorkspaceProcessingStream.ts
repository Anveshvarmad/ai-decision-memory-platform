import {
  useEffect,
  useState,
} from "react";

import {
  streamWorkspaceProcessingEvents,
} from "../lib/workspaceProcessingEvents";

import type {
  WorkspaceProcessingEvent,
} from "../types/api";


export function useWorkspaceProcessingStream(
  workspaceId: string | null,
) {
  const [snapshot, setSnapshot] =
    useState<WorkspaceProcessingEvent | null>(
      null,
    );

  const [connected, setConnected] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setConnected(false);
      setSnapshot(null);
      return;
    }

    const controller =
      new AbortController();

    setConnected(true);
    setError(null);

    void streamWorkspaceProcessingEvents({
      workspaceId,
      signal: controller.signal,

      onEvent: (event) => {
        setSnapshot(event);
        setConnected(true);
      },

      onError: (streamError) => {
        setConnected(false);
        setError(
          streamError.message
        );
      },

      onClose: () => {
        setConnected(false);
      },
    }).catch(() => {
      // Error state is handled above.
    });

    return () => {
      controller.abort();
      setConnected(false);
    };
  }, [workspaceId]);

  return {
    snapshot,
    connected,
    error,
  };
}
