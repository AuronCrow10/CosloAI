export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const apiClient = async <T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' });
  return handleJsonResponse<T>(res);
};

// Stub helpers for demo
export const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CLIENT' | 'REFERRER' | 'TEAM_MEMBER';
  avatar?: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export interface Bot {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'draft';
  domain?: string;
  channels: string[];
  conversationCount: number;
  createdAt: string;
}

export const MOCK_USER: User = {
  id: '1',
  email: 'demo@coslo.ai',
  name: 'Demo User',
  role: 'ADMIN',
  emailVerified: true,
  mfaEnabled: false,
};

export const MOCK_BOTS: Bot[] = [
  { id: '1', name: 'Support Bot', status: 'active', domain: 'example.com', channels: ['web', 'whatsapp'], conversationCount: 342, createdAt: '2025-01-15' },
  { id: '2', name: 'Sales Assistant', status: 'active', domain: 'shop.example.com', channels: ['web', 'messenger', 'instagram'], conversationCount: 128, createdAt: '2025-02-01' },
  { id: '3', name: 'Booking Bot', status: 'draft', channels: ['web'], conversationCount: 0, createdAt: '2025-02-08' },
];

export async function handleJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Invalid JSON response from server');
  }

  if (!response.ok) {
    let errMsg = `Request failed with status ${response.status}`;

    if (data && typeof data === 'object' && 'error' in data) {
      const err = (data as any).error;

      if (typeof err === 'string') {
        errMsg = err;
      } else if (err && typeof err === 'object') {
        const formErrors = Array.isArray(err.formErrors) ? err.formErrors : [];
        const fieldErrorsObj = err.fieldErrors || {};
        const fieldErrorStrings = Object.values(fieldErrorsObj)
          .flat()
          .filter(Boolean) as string[];
        const allErrors = [...formErrors, ...fieldErrorStrings];
        if (allErrors.length > 0) {
          errMsg = allErrors.join('\n');
        }
      }
    }

    throw new Error(errMsg);
  }

  return data as T;
}

// ---- DEMO-SPECIFIC APIs (keep behavior) ----

export interface BotInfo {
  slug: string;
  name: string;
  description?: string;
}

export interface ChatResponse {
  conversationId: string | null;
  reply: string;
  suggestion?: RevenueAISuggestion | null;
  clerk?: ClerkPayload | null;
}

export type RevenueAISuggestion = {
  eventId: string;
  offerType: "UPSELL" | "CROSS_SELL" | "NEXT_BEST";
  stage: "EXPLORATION" | "EVALUATION" | "CART" | "CHECKOUT";
  style: "SOFT" | "CLOSER";
  reason: string;
  botId?: string;
  conversationId?: string;
  product: {
    productId: string;
    variantId: string | null;
    title: string;
    imageUrl: string | null;
    price: string | null;
    compareAtPrice: string | null;
    currency: string | null;
    productUrl: string | null;
    addToCartUrl: string | null;
    checkoutUrl: string | null;
  };
  cta: {
    addToCart: string;
    checkout: string;
  };
};

export type ClerkShortlistItem = {
  productId: string;
  title: string;
  priceMin: string | null;
  priceMax: string | null;
  currency: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  addToCartUrl: string | null;
  variantId: string | null;
  attrSummary: Array<{ label: string; value: string }>;
};

export type ClerkPayload =
  | { type: "shortlist"; items: ClerkShortlistItem[] }
  | { type: "details"; item: ClerkShortlistItem; checkoutUrl?: string | null };

export async function fetchBotInfo(slug: string): Promise<BotInfo> {
  const res = await fetch(`${API_BASE_URL}/bots/live/${encodeURIComponent(slug)}`, {
    credentials: 'include',
  });
  return handleJsonResponse<BotInfo>(res);
}

export async function sendChatMessage(
  slug: string,
  body: { message: string; conversationId?: string | null },
  options?: { sessionId?: string | null }
): Promise<ChatResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.sessionId) {
    headers['x-session-id'] = options.sessionId;
  }
  const res = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(slug)}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return handleJsonResponse<ChatResponse>(res);
}
