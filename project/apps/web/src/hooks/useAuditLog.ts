import { useQuery } from '@tanstack/react-query';
import type { components } from '@ddms/sdk';
import api from '~/lib/api';

type ActivityLogResponse = components['schemas']['ActivityLogResponse'];

export function useActivityLog() {
  return useQuery<ActivityLogResponse>({
    queryKey: ['activity-log'],
    queryFn: async () => {
      const { data, error } = await api.GET('/audit/activity-log', {
        params: {
          query: {
            limit: 200,
          },
        },
      });
      if (error) throw error;
      return (
        data ?? {
          events: [],
          summary: {
            totalEvents: 0,
            schemaEdits: 0,
            recordUpdates: 0,
            uniqueActors: 0,
            lastEventAt: null,
          },
        }
      );
    },
  });
}
