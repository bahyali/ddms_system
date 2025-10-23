import { useQuery } from '@tanstack/react-query';
import api from '~/lib/api';
import type { components } from '@ddms/sdk';

type FieldIndexJob = components['schemas']['FieldIndexJob'];

const indexesKeys = {
  all: ['fieldIndexes'] as const,
};

export const useGetFieldIndexes = () => {
  return useQuery({
    queryKey: indexesKeys.all,
    queryFn: async () => {
      const { data, error } = await api.GET('/indexes');
      if (error) {
        throw error;
      }
      return (data ?? []) as FieldIndexJob[];
    },
  });
};
