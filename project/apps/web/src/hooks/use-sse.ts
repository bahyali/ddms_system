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

export const useSse = (url: string, onMessage: MessageHandler<SseEvent>) => {
  useEffect(() => {
    // Ensure this code only runs in the browser
    if (typeof window === 'undefined') {
      return;
    }

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
  }, [url, onMessage]); // Re-run effect if URL or handler changes
};