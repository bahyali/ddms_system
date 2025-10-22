import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '~/lib/api';
import type { components } from '@ddms/sdk';

type EntityTypeCreate = components['schemas']['EntityTypeCreate'];
type EntityTypeUpdate = components['schemas']['EntityTypeUpdate'];

// Query Keys
const entityTypesKeys = {
  all: ['entityTypes'] as const,
  lists: () => [...entityTypesKeys.all, 'list'] as const,
  details: () => [...entityTypesKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityTypesKeys.details(), id] as const,
};

// Hook to get all entity types
export const useGetEntityTypes = () => {
  return useQuery({
    queryKey: entityTypesKeys.lists(),
    queryFn: async () => {
      const { data, error } = await api.GET('/entity-types');
      if (error) throw error;
      return data;
    },
  });
};

// Hook to get a single entity type by ID
export const useGetEntityType = (id: string) => {
  return useQuery({
    queryKey: entityTypesKeys.detail(id),
    queryFn: async () => {
      // The current API spec does not have a direct endpoint to get a single entity type.
      // As a workaround, we fetch the entire list and find the item by its ID.
      // This is acceptable for a small number of entity types.
      const { data, error } = await api.GET('/entity-types');
      if (error) throw error;
      const entityType = data?.find((et) => et.id === id);
      if (!entityType) {
        throw new Error('Entity type not found');
      }
      return entityType;
    },
    enabled: !!id, // Only run the query if the ID is available
  });
};

// Hook to get a single entity type by Key
export const useGetEntityTypeByKey = (key: string) => {
  return useQuery({
    queryKey: [...entityTypesKeys.lists(), 'by-key', key],
    queryFn: async () => {
      const { data, error } = await api.GET('/entity-types');
      if (error) throw error;
      const entityType = data?.find((et) => et.key === key);
      if (!entityType) {
        throw new Error(`Entity type with key "${key}" not found`);
      }
      return entityType;
    },
    enabled: !!key,
  });
};

// Hook to create an entity type
export const useCreateEntityType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entityType: EntityTypeCreate) => {
      const { data, error } = await api.POST('/entity-types', {
        body: entityType,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // When a new entity type is created, invalidate the list query to refetch it.
      queryClient.invalidateQueries({ queryKey: entityTypesKeys.lists() });
    },
  });
};

// Hook to update an entity type
export const useUpdateEntityType = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      entityType,
    }: {
      id: string;
      entityType: EntityTypeUpdate;
    }) => {
      const { data, error } = await api.PATCH('/entity-types/{entityTypeId}', {
        params: { path: { entityTypeId: id } },
        body: entityType,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // After an update, invalidate both the list and the specific detail query.
      queryClient.invalidateQueries({ queryKey: entityTypesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: entityTypesKeys.detail(data.id) });
    },
  });
};