import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reports.api';

export function useReportsCatalog() {
  return useQuery({
    queryKey: ['reports', 'catalog'],
    queryFn: () => reportsApi.list(),
  });
}
