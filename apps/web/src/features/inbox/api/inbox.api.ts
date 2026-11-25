import { apiClient } from '@/shared/lib/api/client';

export interface InboxStudent {
  id: string;
  fullName: string;
  studentCode: string | null;
  isActive: boolean;
  relation: 'parent' | 'student';
}

export interface InboxConversation {
  phone: string;
  students: InboxStudent[];
  lastAt: string;
  lastDirection: 'in' | 'out';
  lastPreview: string;
  unread: number;
}

export interface InboxMedia {
  type: 'audio' | 'image' | 'video' | 'document' | 'sticker' | 'unsupported' | string;
  mime: string | null;
  seconds: number | null;
  size: number | null;
  status: 'stored' | 'too_large' | 'failed' | 'unsupported' | string | null;
}

export type InboxThreadItem =
  | {
      kind: 'message';
      id: string;
      direction: 'in' | 'out';
      source: 'parent' | 'app' | 'phone';
      body: string;
      media: InboxMedia | null;
      status: 'pending' | 'sent' | 'failed';
      error: string | null;
      at: string;
    }
  | {
      kind: 'notification';
      id: string;
      templateKey: string | null;
      body: string;
      status: string;
      at: string;
    };

export interface InboxThread {
  phone: string;
  students: InboxStudent[];
  items: InboxThreadItem[];
  hasMore: boolean;
  connected: boolean;
}

export const inboxApi = {
  conversations: async (params: { search?: string; unreadOnly?: boolean; limit?: number }) => {
    const res = await apiClient.get('/inbox/conversations', { params });
    return res.data as { data: InboxConversation[]; total: number; connected: boolean };
  },
  thread: async (phone: string, params?: { before?: string; limit?: number }): Promise<InboxThread> => {
    const res = await apiClient.get(`/inbox/conversations/${encodeURIComponent(phone)}/messages`, { params });
    return res.data.data;
  },
  markRead: async (phone: string) => {
    await apiClient.put(`/inbox/conversations/${encodeURIComponent(phone)}/read`);
  },
  reply: async (phone: string, body: string): Promise<InboxThreadItem> => {
    const res = await apiClient.post(`/inbox/conversations/${encodeURIComponent(phone)}/messages`, { body });
    return res.data.data;
  },
  retry: async (id: string): Promise<InboxThreadItem> => {
    const res = await apiClient.post(`/inbox/messages/${id}/retry`);
    return res.data.data;
  },
  /** الملف بيتجاب بالتوكن (مش رابط عام) ويتحوّل لـ object URL */
  media: async (id: string): Promise<Blob> => {
    const res = await apiClient.get(`/inbox/messages/${id}/media`, { responseType: 'blob' });
    return res.data;
  },
};

/** 201012345678 ← 01012345678 للعرض */
export function displayPhone(phone: string): string {
  return phone.startsWith('20') && phone.length === 12 ? `0${phone.slice(2)}` : phone;
}
