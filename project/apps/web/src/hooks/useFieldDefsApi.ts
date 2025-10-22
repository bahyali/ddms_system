import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '~/lib/api';
import type { components } from '@ddms/sdk';

type FieldDefCreate = components['schemas']['FieldDefCreate'];
type FieldDefUpdate = components['schemas']['FieldDefUpdate'];

// Query Keys
const fieldDefsKeys = {
  all: (entityTypeId: string) => ['entityTypes', entityTypeId, 'fieldDefs'] as const,
  lists: (entityTypeId: string) => [...fieldDefsKeys.all(entityTypeId), 'list'] as const,
};

// Hook to get all field definitions for an entity type
export const useGetFieldDefs = (entityTypeId: string) => {
  return useQuery({
    queryKey: fieldDefsKeys.lists(entityTypeId),
    queryFn: async () => {
      const { data, error } = await api.GET('/entity-types/{entityTypeId}/fields', {
        params: { path: { entityTypeId } },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!entityTypeId,
  });
};

// Hook to create a field definition
export const useCreateFieldDef = (entityTypeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fieldDef: FieldDefCreate) => {
      const { data, error } = await api.POST('/entity-types/{entityTypeId}/fields', {
        params: { path: { entityTypeId } },
        body: fieldDef,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fieldDefsKeys.lists(entityTypeId) });
    },
  });
};

// Hook to update a field definition
export const useUpdateFieldDef = (entityTypeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fieldDef,
    }: {
      id: string;
      fieldDef: FieldDefUpdate;
    }) => {
      const { data, error } = await api.PATCH('/fields/{fieldId}', {
        params: { path: { fieldId: id } },
        body: fieldDef,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: fieldDefsKeys.lists(entityTypeId) });
    },
  });
};