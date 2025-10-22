import { useQuery } from '@tanstack/react-query';
import api from '~/lib/api';
import type { operations } from '@ddms/sdk';

// Define the structure for pagination parameters
interface GetRecordsParams {
  entityTypeKey: string;
  pageIndex: number;
  pageSize: number;
  filter?: operations['searchRecords']['requestBody']['content']['application/json']['filter'];
}

// Query Keys
const recordsKeys = {
  all: (entityTypeKey: string) => ['records', entityTypeKey] as const,
  paginated: (params: Omit<GetRecordsParams, 'filter'>) => [
    ...recordsKeys.all(params.entityTypeKey),
    params,
  ],
};

// Hook to get paginated records for an entity type
export const useGetRecords = ({
  entityTypeKey,
  pageIndex,
  pageSize,
  filter,
}: GetRecordsParams) => {
  return useQuery({
    queryKey: recordsKeys.paginated({ entityTypeKey, pageIndex, pageSize }),
    queryFn: async () => {
      const offset = pageIndex * pageSize;
      const { data, error } = await api.POST('/entities/{entityTypeKey}/search', {
        params: { path: { entityTypeKey } },
        body: {
          filter: filter || null,
          limit: pageSize,
          offset: offset,
        },
      });

      if (error) throw error;

      return data as {
        rows: { id: string; data: Record<string, unknown> }[];
        total: number;
      };
    },
    enabled: !!entityTypeKey,
  });
};