import '~/styles/globals.css';
import type { AppProps } from 'next/app';
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useCallback } from 'react';
import { useSse, type SseEvent } from '~/hooks/use-sse';

// A component that handles the SSE connection and cache invalidation
const SseHandler = () => {
  const queryClient = useQueryClient();

  const handleSseEvent = useCallback(
    (event: SseEvent) => {
      console.log('Received SSE event:', event);

      const { type, payload } = event;

      // Invalidate queries based on the event type
      switch (type) {
        case 'record.created':
        case 'record.updated':
        case 'record.deleted':
          if (payload.entity_type_key) {
            console.log(
              `Invalidating queries for entity: ${payload.entity_type_key}`
            );
            // This will invalidate all list queries and detail queries for this entity type
            queryClient.invalidateQueries({
              queryKey: ['records', payload.entity_type_key],
            });
          }
          break;

        case 'entity_type.created':
        case 'entity_type.updated':
        case 'entity_type.deleted':
          console.log('Invalidating entity type queries');
          queryClient.invalidateQueries({ queryKey: ['entityTypes'] });
          break;

        case 'field_def.created':
        case 'field_def.updated':
        case 'field_def.deleted':
          if (payload.entity_type_id) {
            console.log(
              `Invalidating field defs for entity type ID: ${payload.entity_type_id}`
            );
            queryClient.invalidateQueries({
              queryKey: ['entityTypes', payload.entity_type_id, 'fieldDefs'],
            });
          }
          break;

        // Add more cases for other events like edges, etc.
        default:
          console.warn(`Unhandled SSE event type: ${type}`);
          break;
      }
    },
    [queryClient]
  );

  // The SSE endpoint is proxied by Next.js to the API server
  useSse('/events', handleSseEvent);

  return null; // This component does not render anything
};

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // It's beneficial to have a short staleTime when using SSE
            // so that manual refetches also get fresh data, but invalidations
            // will trigger refetches regardless of staleTime.
            staleTime: 5 * 1000, // 5 seconds
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SseHandler />
      <Component {...pageProps} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}