import { useEffect } from 'react';

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
    const eventSource = new EventSource(url, { withCredentials: true });

    const handleMessage = (event: MessageEvent) => {
      try {
        const parsedData = JSON.parse(event.data);
        onMessage(parsedData);
      } catch (error) {
        console.error('Failed to parse SSE message data:', event.data, error);
      }
    };

    eventSource.addEventListener('message', handleMessage);

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // EventSource will automatically try to reconnect.
      // You could add logic here to show a 'reconnecting' status in the UI.
    };

    // Cleanup on component unmount
    return () => {
      eventSource.removeEventListener('message', handleMessage);
      eventSource.close();
    };
  }, [path, onMessage]); // Re-run effect if URL or handler changes
};
