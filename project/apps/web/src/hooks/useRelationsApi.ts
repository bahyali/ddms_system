import { useQuery } from '@tanstack/react-query';
import api from '~/lib/api';
import type { components } from '@ddms/sdk';

export type RelationWithContext = components['schemas']['RelationWithContext'];

interface UseRelationsParams {
  recordId: string;
  role?: 'from' | 'to';
  fieldId?: string;
  enabled?: boolean;
}

export function useRelations({
  recordId,
  role = 'from',
  fieldId,
  enabled = true,
}: UseRelationsParams) {
  return useQuery({
    queryKey: ['relations', { recordId, role, fieldId }],
    queryFn: async () => {
      const query: Record<string, string> = {
        record_id: recordId,
      };
      if (role) {
        query.role = role;
      }
      if (fieldId) {
        query.field_id = fieldId;
      }
      const { data, error } = await api.GET('/relations', {
        params: { query },
      });
      if (error) throw error;
      return (data ?? []) as RelationWithContext[];
    },
    enabled: enabled && Boolean(recordId),
  });
}
