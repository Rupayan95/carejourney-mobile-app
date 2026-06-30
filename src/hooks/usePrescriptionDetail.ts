import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function usePrescriptionDetail(id: string) {
  return useQuery({
    queryKey: ['prescription-detail', id],
    queryFn: async () => {
      const res = await api.get(`/prescriptions/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
