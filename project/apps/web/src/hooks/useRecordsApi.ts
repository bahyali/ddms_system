import { useQuery } from '@tanstack/react-query';
import api from '~/lib/api';
import type { components } from '@ddms/sdk';

type Filter = components['schemas']['Filter'];

// Define the structure for pagination parameters
export interface GetRecordsParams {
  entityTypeKey: string;
  pageIndex: number;
  pageSize: number;
  filter?: Filter;
}

// Query Keys
const recordsKeys = {
  all: (entityTypeKey: string) => ['records', entityTypeKey] as const,
  paginated: (params: GetRecordsParams) => [
    ...recordsKeys.all(params.entityTypeKey),
    params,
  ],
};

// Hook to get paginated records for an entity type
export const useGetRecords = (params: GetRecordsParams) => {
  const { entityTypeKey, pageIndex, pageSize, filter } = params;

  return useQuery({
    queryKey: recordsKeys.paginated(params),
    queryFn: async () => {
      const offset = pageIndex * pageSize;
      // Use null for the first page's cursor, which the API interprets as offset 0
      const cursor =
        offset > 0 ? Buffer.from(String(offset)).toString('base64') : null;

      const { data, error } = await api.POST('/entities/{entityTypeKey}/search', {
        params: { path: { entityTypeKey } },
        body: {
          filter: filter || undefined,
          limit: pageSize,
          cursor: cursor,
        },
      });

      if (error) throw error;

      return data;
    },
    enabled: !!entityTypeKey,
  });
};