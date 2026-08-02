import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api/client';

interface TenantCapabilities {
  hasMultipleSubjects: boolean;
  hasMultipleTeachers: boolean;
}

/**
 * Hook مشترك: هل المركز ده أصلاً بيدرّس أكتر من مادة، أو عنده أكتر من مدرس.
 * يُستخدم لإخفاء فلاتر/أعمدة "المادة"/"المدرس" في أي شاشة، لو مفيش تنوع فعلي يستاهل عرضه.
 * (نفس القرار بالظبط اللي طبّقناه في تقرير "قائمة الحصص" على مستوى الباك إند)
 */
export function useTenantCapabilities() {
  return useQuery({
    queryKey: ['tenant-capabilities'],
    queryFn: async (): Promise<TenantCapabilities> => {
      const res = await apiClient.get('/settings/capabilities');
      return res.data.data;
    },
    staleTime: 1000 * 60 * 10, // 10 دقايق — البيانات دي نادراً ما تتغيّر خلال الجلسة
  });
}
