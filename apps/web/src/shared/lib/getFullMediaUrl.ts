import { apiClient } from './api/client';

/**
 * يحوّل مسار تخزين نسبي (زي "/storage/tenants/...") لرابط كامل قابل للاستخدام
 * مباشرة في <img src>. الروابط الراجعة من الباك إند بتبقى نسبية دايماً (يشتغل
 * صح خلف أي دومين/بورت production)، لكن في التطوير المحلي الفرونت (5173)
 * والباك إند (3001) على بورتات مختلفة، فمحتاجين نبني الرابط الكامل يدوياً.
 */
export function getFullMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  // apiClient.defaults.baseURL بيبقى شكله ".../api/v1" — نشيل الجزء ده عشان نوصل لجذر السيرفر
  const apiBase = apiClient.defaults.baseURL ?? '';
  const serverRoot = apiBase.replace(/\/api\/v1\/?$/, '');
  return `${serverRoot}${path}`;
}
