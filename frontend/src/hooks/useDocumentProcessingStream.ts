import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  streamDocumentEvents,
} from "../lib/documentEvents";

import type {
  DocumentProcessingEvent,
} from "../types/api";


interface UseDocumentProcessingStreamOptions {
  workspaceId: string | null;
  documentId: string | null;
  enabled?: boolean;

  onCompleted?: (
    event: DocumentProcessingEvent,
  ) => void;
}


export function useDocumentProcessingStream({
  workspaceId,
  documentId,
  enabled = true,
  onCompleted,
}: UseDocumentProcessingStreamOptions) {
  const [event, setEvent] =
    useState<DocumentProcessingEvent | null>(
      null,
    );

  const [connected, setConnected] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const completedCallback =
    useRef(onCompleted);

  completedCallback.current =
    onCompleted;

  useEffect(() => {
    if (
      !enabled ||
      !workspaceId ||
      !documentId
    ) {
      setConnected(false);
      return;
    }

    const controller =
      new AbortController();

    setError(null);
    setConnected(true);

    void streamDocumentEvents({
      workspaceId,
      documentId,

      signal: controller.signal,

      onEvent: (
        processingEvent,
      ) => {
        setEvent(processingEvent);

        if (
          processingEvent.terminal
        ) {
          setConnected(false);

          completedCallback.current?.(
            processingEvent,
          );
        }
      },

      onError: (
        streamError,
      ) => {
        setConnected(false);
        setError(
          streamError.message,
        );
      },

      onClose: () => {
        setConnected(false);
      },
    }).catch(() => {
      // Error state is set by onError.
    });

    return () => {
      controller.abort();
      setConnected(false);
    };
  }, [
    workspaceId,
    documentId,
    enabled,
  ]);

  return {
    event,
    connected,
    error,
  };
}
