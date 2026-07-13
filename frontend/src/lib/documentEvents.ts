import type {
  DocumentProcessingEvent,
} from "../types/api";


const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api";


function getAccessToken(): string | null {
  const possibleKeys = [
    "decision-memory-token",
    "access_token",
    "token",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (value) {
      return value;
    }
  }

  return null;
}


interface StreamOptions {
  workspaceId: string;
  documentId: string;

  onEvent: (
    event: DocumentProcessingEvent,
  ) => void;

  onError?: (error: Error) => void;
  onClose?: () => void;

  signal?: AbortSignal;
}


function parseEventBlock(
  block: string,
): {
  eventName: string;
  data: string;
} | null {
  const lines = block.split("\n");

  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line
        .slice("event:".length)
        .trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(
        line
          .slice("data:".length)
          .trimStart(),
      );
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    eventName,
    data: dataLines.join("\n"),
  };
}


export async function streamDocumentEvents({
  workspaceId,
  documentId,
  onEvent,
  onError,
  onClose,
  signal,
}: StreamOptions): Promise<void> {
  const token = getAccessToken();

  if (!token) {
    throw new Error(
      "Authentication token is missing.",
    );
  }

  try {
    const response = await fetch(
      `${API_URL}/workspaces/${workspaceId}/documents/${documentId}/events`,
      {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
        signal,
      },
    );

    if (!response.ok) {
      const message = await response.text();

      throw new Error(
        message ||
          `Streaming request failed with ${response.status}`,
      );
    }

    if (!response.body) {
      throw new Error(
        "Streaming response body is unavailable.",
      );
    }

    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder();

    let buffer = "";

    while (true) {
      const {
        done,
        value,
      } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(
        value,
        {
          stream: true,
        },
      );

      const blocks = buffer.split("\n\n");

      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed =
          parseEventBlock(block);

        if (
          !parsed ||
          parsed.eventName === "heartbeat"
        ) {
          continue;
        }

        const payload = JSON.parse(
          parsed.data,
        ) as DocumentProcessingEvent;

        onEvent(payload);

        if (payload.terminal) {
          await reader.cancel();
          onClose?.();
          return;
        }
      }
    }

    onClose?.();
  } catch (error) {
    if (
      signal?.aborted ||
      (
        error instanceof DOMException &&
        error.name === "AbortError"
      )
    ) {
      return;
    }

    const resolvedError =
      error instanceof Error
        ? error
        : new Error(
            "Document event stream failed.",
          );

    onError?.(resolvedError);
    throw resolvedError;
  }
}
