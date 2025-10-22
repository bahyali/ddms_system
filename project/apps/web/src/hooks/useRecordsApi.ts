import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '~/lib/api';
import type { components } from '@ddms/sdk';

type Filter = components['schemas']['Filter'];
type RecordCreate = components['schemas']['RecordCreate'];
type RecordUpdate = components['schemas']['RecordUpdate'];

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
  lists: (entityTypeKey: string) => [...recordsKeys.all(entityTypeKey), 'list'] as const,
  paginated: (params: GetRecordsParams) => [
    ...recordsKeys.lists(params.entityTypeKey),
    params,
  ],
  details: (entityTypeKey: string) => [...recordsKeys.all(entityTypeKey), 'detail'] as const,
  detail: (entityTypeKey: string, recordId: string) => [
    ...recordsKeys.details(entityTypeKey),
    recordId,
  ] as const,
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

// Hook to get a single record by ID
export const useGetRecord = (entityTypeKey: string, recordId: string) => {
  return useQuery({
    queryKey: recordsKeys.detail(entityTypeKey, recordId),
    queryFn: async () => {
      const { data, error } = await api.GET('/entities/{entityTypeKey}/{recordId}', {
        params: { path: { entityTypeKey, recordId } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!entityTypeKey && !!recordId,
  });
};

// Hook to create a record
export const useCreateRecord = (entityTypeKey: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: RecordCreate) => {
      const { data, error } = await api.POST('/entities/{entityTypeKey}', {
        params: { path: { entityTypeKey } },
        body: record,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recordsKeys.lists(entityTypeKey) });
    },
  });
};

// Hook to update a record
export const useUpdateRecord = (entityTypeKey: string, recordId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: RecordUpdate) => {
      const { data, error } = await api.PATCH('/entities/{entityTypeKey}/{recordId}', {
        params: { path: { entityTypeKey, recordId } },
        body: record,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: recordsKeys.lists(entityTypeKey) });
      queryClient.setQueryData(recordsKeys.detail(entityTypeKey, recordId), data);
    },
  });
};