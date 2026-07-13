import type {
  WorkspaceProcessingEvent,
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
    const value =
      localStorage.getItem(key);

    if (value) {
      return value;
    }
  }

  return null;
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


interface StreamOptions {
  workspaceId: string;

  onEvent: (
    event: WorkspaceProcessingEvent,
  ) => void;

  onError?: (error: Error) => void;
  onClose?: () => void;
  signal?: AbortSignal;
}


export async function streamWorkspaceProcessingEvents({
  workspaceId,
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
      `${API_URL}/workspaces/${workspaceId}/processing/events`,
      {
        headers: {
          Accept: "text/event-stream",
          Authorization:
            `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
        signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        await response.text()
      );
    }

    if (!response.body) {
      throw new Error(
        "Workspace stream is unavailable.",
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

      const blocks =
        buffer.split("\n\n");

      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const parsed =
          parseEventBlock(block);

        if (
          !parsed ||
          parsed.eventName
            === "heartbeat"
        ) {
          continue;
        }

        if (
          parsed.eventName
          !==
          "workspace.processing.snapshot"
        ) {
          continue;
        }

        onEvent(
          JSON.parse(
            parsed.data,
          ) as WorkspaceProcessingEvent,
        );
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
            "Workspace stream failed.",
          );

    onError?.(resolvedError);

    throw resolvedError;
  }
}
