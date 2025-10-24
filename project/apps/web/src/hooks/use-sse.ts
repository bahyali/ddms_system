import { useEffect } from 'react';
import { apiDefaultHeaders } from '~/lib/api';

// A generic handler for any type of message data
type MessageHandler<T> = (data: T) => void;

// Define a type for the expected event data structure
// This should align with what the backend sends.
export interface SseEvent {
  type: string;
  payload: {
    entity_type_key?: string;
    entity_type_id?: string;
    record_id?: string;
    // Add other potential payload properties here
  };
}

const resolveSseUrl = (path: string) => {
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('//')
  ) {
    return path;
  }

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    const base = apiBase.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return normalizedPath;
};

export const useSse = (path: string, onMessage: MessageHandler<SseEvent>) => {
  useEffect(() => {
    // Ensure this code only runs in the browser
    if (typeof window === 'undefined') {
      return;
    }

    const url = resolveSseUrl(path);
    let reconnectTimer: number | null = null;
    let abortController: AbortController | null = null;
    let isActive = true;

    const connect = async () => {
      abortController = new AbortController();

      const headers = new Headers({
        Accept: 'text/event-stream',
        ...apiDefaultHeaders,
      });

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(
            `SSE connection failed with status ${response.status}`,
          );
        }

        if (!response.body) {
          throw new Error('SSE response does not contain a readable stream.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        const processBuffer = () => {
          let delimiterIndex = buffer.indexOf('\n\n');

          while (delimiterIndex !== -1) {
            const rawEvent = buffer.slice(0, delimiterIndex);
            buffer = buffer.slice(delimiterIndex + 2);

            const trimmed = rawEvent.trim();
            if (!trimmed || trimmed.startsWith(':')) {
              delimiterIndex = buffer.indexOf('\n\n');
              continue;
            }

            const lines = trimmed.split(/\r?\n/);
            const dataLines: string[] = [];

            for (const line of lines) {
              if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
              }
            }

            if (dataLines.length > 0) {
              const dataPayload = dataLines.join('\n');

              try {
                const parsedData = JSON.parse(dataPayload);
                onMessage(parsedData);
              } catch (error) {
                console.error(
                  'Failed to parse SSE message data:',
                  dataPayload,
                  error,
                );
              }
            }

            delimiterIndex = buffer.indexOf('\n\n');
          }
        };

        while (isActive) {
          const { value, done } = await reader.read();

          if (value) {
            buffer += decoder.decode(value, { stream: true });
            processBuffer();
          }

          if (done) {
            buffer += decoder.decode();
            processBuffer();
            break;
          }
        }

        reader.releaseLock();
      } catch (error) {
        const isAbortError =
          typeof DOMException !== 'undefined' &&
          error instanceof DOMException &&
          error.name === 'AbortError';

        if (isActive && !isAbortError) {
          console.error('SSE Error:', error);
        }
      } finally {
        if (isActive) {
          reconnectTimer = window.setTimeout(connect, 5000);
        }
      }
    };

    void connect();

    // Cleanup on component unmount
    return () => {
      isActive = false;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, [path, onMessage]); // Re-run effect if URL or handler changes
};
