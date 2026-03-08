import { authFetchJson } from './authorizedClient';

export type BotStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELED';

export type KnowledgeSource = 'RAG' | 'SHOPIFY';

export const KNOWLEDGE_RETRIEVAL_PROFILES = [
  'balanced',
  'precise',
  'broad',
] as const;

export type KnowledgeRetrievalProfile =
  (typeof KNOWLEDGE_RETRIEVAL_PROFILES)[number];

export function normalizeKnowledgeRetrievalProfile(
  value?: string | null
): KnowledgeRetrievalProfile {
  if (!value) return 'balanced';
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'balanced' ||
    normalized === 'precise' ||
    normalized === 'broad'
  ) {
    return normalized;
  }
  return 'balanced';
}

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface BookingTimeWindow {
  start: string;
  end: string;
  maxSimultaneousBookings?: number | null;
}

export type BookingWeeklySchedule = Partial<Record<Weekday, BookingTimeWindow[]>>;

export interface BookingService {
  key?: string;
  name: string;
  aliases?: string[];
  calendarId: string;
  durationMinutes: number;
  maxSimultaneousBookings?: number | null;
  weeklySchedule?: BookingWeeklySchedule | null;
}

export interface Bot {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  knowledgeSource?: KnowledgeSource;
  knowledgeRetrievalProfile?: KnowledgeRetrievalProfile;
  knowledgeClientId?: string | null;
  domain?: string | null;
  useDomainCrawler: boolean;
  usePdfCrawler: boolean;
  channelWeb: boolean;
  channelWhatsapp: boolean;
  channelInstagram: boolean;
  channelMessenger: boolean;
  useCalendar: boolean;
  status: BotStatus;
  createdAt: string;
  updatedAt: string;
  calendarId?: string | null;
  timeZone?: string | null;
  defaultDurationMinutes?: number | null;
  autoEvaluateConversations: boolean;
  bookingMinLeadHours?: number | null;
  bookingMaxAdvanceDays?: number | null;
  bookingMaxSimultaneousBookings?: number | null;
  bookingReminderWindowHours?: number | null;
  bookingReminderMinLeadHours?: number | null;
  bookingConfirmationEmailEnabled?: boolean;
  bookingReminderEmailEnabled?: boolean;
  bookingConfirmationSubjectTemplate?: string | null;
  bookingReminderSubjectTemplate?: string | null;
  bookingCancellationSubjectTemplate?: string | null;
  bookingConfirmationBodyTextTemplate?: string | null;
  bookingReminderBodyTextTemplate?: string | null;
  bookingCancellationBodyTextTemplate?: string | null;
  bookingConfirmationBodyHtmlTemplate?: string | null;
  bookingReminderBodyHtmlTemplate?: string | null;
  bookingCancellationBodyHtmlTemplate?: string | null;
  bookingRequiredFields?: string[] | null;
  bookingWeeklySchedule?: BookingWeeklySchedule | null;
  bookingServices?: BookingService[] | null;
  leadWhatsappMessages200: boolean;
  leadWhatsappMessages500: boolean;
  leadWhatsappMessages1000: boolean;
  knowledgeLastCrawlJobId?: string | null;
  knowledgeLastCrawlDomain?: string | null;
  knowledgeLastCrawlStartedAt?: string | null;
  knowledgeLastCrawlFinishedAt?: string | null;

  revenueAIEnabled?: boolean;
  revenueAIMode?: 'AUTO' | 'SOFT' | 'CLOSER';
  revenueAIOfferEveryXMessages?: number;
  revenueAIMaxOffersPerSession?: number;
  revenueAICooldownMinutes?: number;
  revenueAIDedupeHours?: number;
  revenueAIAttributionWindowHours?: number;
  revenueAIGuardrailsEnabled?: boolean;
  revenueAIUpsellDeltaMinPct?: number;
  revenueAIUpsellDeltaMaxPct?: number;
  revenueAIMaxRecommendations?: number;
  revenueAIAggressiveness?: number;
  revenueAICategoryComplementMap?: any;
}

export type ChannelType = 'WEB' | 'WHATSAPP' | 'FACEBOOK' | 'INSTAGRAM';

export interface BotChannel {
  id: string;
  botId: string;
  type: ChannelType;
  externalId: string;
  accessToken: string;
  meta?: any;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationEvalSummary {
  score: number;
  label?: string | null;
  isAuto: boolean;
  createdAt: string;
}

export type ConversationMode = 'AI' | 'HUMAN';

export interface Conversation {
  id: string;
  botId: string;
  channel: ChannelType;
  externalUserId: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  mode: ConversationMode;
  latestEval?: ConversationEvalSummary | null;
}

export interface PaginatedConversations {
  items: Conversation[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'HUMAN';

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  channelMessageId?: string | null;
  createdAt: string;
}

export interface CheckoutResponse {
  checkoutUrl: string;
}

export type FeatureCode =
  | 'DOMAIN_CRAWLER'
  | 'PDF_CRAWLER'
  | 'CHANNEL_WEB'
  | 'WHATSAPP'
  | 'MESSENGER'
  | 'INSTAGRAM'
  | 'CALENDAR'
  | 'LEAD_WHATSAPP_200'
  | 'LEAD_WHATSAPP_500'
  | 'LEAD_WHATSAPP_1000';

export interface BotPricingLineItem {
  code: FeatureCode;
  label: string;
  monthlyAmountCents: number;
  monthlyAmountFormatted: string;
  currency: string;
}

export interface BotPricingPreview {
  lineItems: BotPricingLineItem[];
  totalAmountCents: number;
  totalAmountFormatted: string;
  currency: string;
}

export interface BotPricingPreviewPayload {
  useDomainCrawler?: boolean;
  usePdfCrawler?: boolean;
  channelWeb?: boolean;
  channelWhatsapp?: boolean;
  channelMessenger?: boolean;
  channelInstagram?: boolean;
  useCalendar?: boolean;
  leadWhatsappMessages200?: boolean;
  leadWhatsappMessages500?: boolean;
  leadWhatsappMessages1000?: boolean;
}

export interface UsagePlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  monthlyTokens?: number | null;
  monthlyAmountCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchBots(): Promise<Bot[]> {
  return authFetchJson<Bot[]>('/bots');
}

export interface CreateBotPayload {
  name: string;
  slug: string;
  description?: string;
  systemPrompt?: string;
  knowledgeSource?: KnowledgeSource;
  knowledgeRetrievalProfile?: KnowledgeRetrievalProfile;
  domain?: string;
  useDomainCrawler?: boolean;
  usePdfCrawler?: boolean;
  channelWeb?: boolean;
  channelWhatsapp?: boolean;
  channelInstagram?: boolean;
  channelMessenger?: boolean;
  useCalendar?: boolean;
  calendarId?: string | null;
  timeZone?: string | null;
  defaultDurationMinutes?: number | null;
  autoEvaluateConversations?: boolean;
  bookingMinLeadHours?: number | null;
  bookingMaxAdvanceDays?: number | null;
  bookingMaxSimultaneousBookings?: number | null;
  bookingReminderWindowHours?: number | null;
  bookingReminderMinLeadHours?: number | null;
  bookingConfirmationEmailEnabled?: boolean;
  bookingReminderEmailEnabled?: boolean;
  bookingConfirmationSubjectTemplate?: string | null;
  bookingReminderSubjectTemplate?: string | null;
  bookingCancellationSubjectTemplate?: string | null;
  bookingConfirmationBodyTextTemplate?: string | null;
  bookingReminderBodyTextTemplate?: string | null;
  bookingCancellationBodyTextTemplate?: string | null;
  bookingConfirmationBodyHtmlTemplate?: string | null;
  bookingReminderBodyHtmlTemplate?: string | null;
  bookingCancellationBodyHtmlTemplate?: string | null;
  leadWhatsappMessages200?: boolean | null;
  leadWhatsappMessages500?: boolean | null;
  leadWhatsappMessages1000?: boolean | null;
  bookingRequiredFields?: string[];
  bookingWeeklySchedule?: BookingWeeklySchedule | null;
  bookingServices?: BookingService[];

  revenueAIEnabled?: boolean;
  revenueAIMode?: 'AUTO' | 'SOFT' | 'CLOSER';
  revenueAIOfferEveryXMessages?: number;
  revenueAIMaxOffersPerSession?: number;
  revenueAICooldownMinutes?: number;
  revenueAIDedupeHours?: number;
  revenueAIAttributionWindowHours?: number;
  revenueAIGuardrailsEnabled?: boolean;
  revenueAIUpsellDeltaMinPct?: number;
  revenueAIUpsellDeltaMaxPct?: number;
  revenueAIMaxRecommendations?: number;
  revenueAIAggressiveness?: number;
  revenueAICategoryComplementMap?: any;
}

export async function createBot(payload: CreateBotPayload): Promise<Bot> {
  return authFetchJson<Bot>('/bots', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateBotPayload {
  name?: string;
  description?: string;
  systemPrompt?: string;
  domain?: string | null;
  knowledgeSource?: KnowledgeSource;
  knowledgeRetrievalProfile?: KnowledgeRetrievalProfile;
  useDomainCrawler?: boolean;
  usePdfCrawler?: boolean;
  channelWeb?: boolean;
  channelWhatsapp?: boolean;
  channelInstagram?: boolean;
  channelMessenger?: boolean;
  useCalendar?: boolean;
  status?: BotStatus;
  calendarId?: string | null;
  timeZone?: string | null;
  defaultDurationMinutes?: number | null;
  autoEvaluateConversations?: boolean;
  bookingMinLeadHours?: number | null;
  bookingMaxAdvanceDays?: number | null;
  bookingMaxSimultaneousBookings?: number | null;
  bookingReminderWindowHours?: number | null;
  bookingReminderMinLeadHours?: number | null;
  bookingConfirmationEmailEnabled?: boolean;
  bookingReminderEmailEnabled?: boolean;
  bookingConfirmationSubjectTemplate?: string | null;
  bookingReminderSubjectTemplate?: string | null;
  bookingCancellationSubjectTemplate?: string | null;
  bookingConfirmationBodyTextTemplate?: string | null;
  bookingReminderBodyTextTemplate?: string | null;
  bookingCancellationBodyTextTemplate?: string | null;
  bookingConfirmationBodyHtmlTemplate?: string | null;
  bookingReminderBodyHtmlTemplate?: string | null;
  bookingCancellationBodyHtmlTemplate?: string | null;
  bookingRequiredFields?: string[];
  bookingWeeklySchedule?: BookingWeeklySchedule | null;
  bookingServices?: BookingService[];
  leadWhatsappMessages200?: boolean;
  leadWhatsappMessages500?: boolean;
  leadWhatsappMessages1000?: boolean;

  revenueAIEnabled?: boolean;
  revenueAIMode?: 'AUTO' | 'SOFT' | 'CLOSER';
  revenueAIOfferEveryXMessages?: number;
  revenueAIMaxOffersPerSession?: number;
  revenueAICooldownMinutes?: number;
  revenueAIDedupeHours?: number;
  revenueAIAttributionWindowHours?: number;
  revenueAIGuardrailsEnabled?: boolean;
  revenueAIUpsellDeltaMinPct?: number;
  revenueAIUpsellDeltaMaxPct?: number;
  revenueAIMaxRecommendations?: number;
  revenueAIAggressiveness?: number;
  revenueAICategoryComplementMap?: any;
}

export async function updateBot(id: string, payload: UpdateBotPayload): Promise<Bot> {
  return authFetchJson<Bot>(`/bots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteBot(id: string, slug: string): Promise<void> {
  await authFetchJson<unknown>(`/bots/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ slug }),
  });
}

export async function getBotById(id: string): Promise<Bot> {
  return authFetchJson<Bot>(`/bots/${encodeURIComponent(id)}`);
}

export async function startBotCheckout(
  id: string,
  payload: { usagePlanId: string }
): Promise<CheckoutResponse> {
  return authFetchJson<CheckoutResponse>(`/bots/${encodeURIComponent(id)}/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function activateFreePlan(
  id: string,
  payload: { usagePlanId: string }
): Promise<{ ok: true }> {
  return authFetchJson<{ ok: true }>(`/bots/${encodeURIComponent(id)}/activate-free`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getBotPricingPreview(
  id: string,
  payload?: BotPricingPreviewPayload
): Promise<BotPricingPreview> {
  return authFetchJson<BotPricingPreview>(`/bots/${encodeURIComponent(id)}/pricing-preview`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

export async function cancelBotSubscription(id: string): Promise<Bot> {
  return authFetchJson<Bot>(`/bots/${encodeURIComponent(id)}/cancel-subscription`, {
    method: 'POST',
  });
}

export async function changeBotUsagePlan(
  id: string,
  payload: { usagePlanId: string }
): Promise<{ ok: boolean; subscription?: any; unchanged?: boolean }> {
  return authFetchJson<{ ok: boolean; subscription?: any; unchanged?: boolean }>(
    `/bots/${encodeURIComponent(id)}/change-plan`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchUsagePlans(): Promise<UsagePlan[]> {
  return authFetchJson<UsagePlan[]>('/usage-plans');
}

export type KnowledgeJobType = 'domain' | 'docs';
export type KnowledgeJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface KnowledgeCrawlJob {
  id: string;
  clientId: string;
  status: KnowledgeJobStatus;
  isActive: boolean;
  jobType: KnowledgeJobType;
  origin: string;
  domain: string;
  startUrl: string;
  pagesVisited: number;
  pagesStored: number;
  chunksStored: number;
  totalPagesEstimated: number | null;
  percent: number | null;
  errorMessage: string | null;
  tokensUsed: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface KnowledgeCrawlJobResponse {
  job: KnowledgeCrawlJob;
}

export interface KnowledgeCrawlHistoryResponse {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  jobs: KnowledgeCrawlJob[];
}

export interface KnowledgeChunk {
  id: string;
  url: string;
  chunkIndex: number;
  text: string;
  createdAt: string;
}

export type CrawlEstimateResponse = {
  status: 'estimate';
  canProceed: boolean;
  error?: string;
  estimate?: any;
  estimateId?: string | null;
  limit?: number | null;
  usedTokens?: number;
  remainingTokens?: number | null;
  requiredTokens?: number;
};

export type CrawlEstimatePendingResponse = {
  status: 'estimate_pending';
  estimateId?: string | null;
};

export type CrawlStartResponse = {
  status: string;
  knowledgeClientId: string;
  domain: string;
  jobId: string;
  estimate?: any;
  estimateId?: string | null;
};

export async function crawlBotDomain(
  botId: string,
  domainOverride?: string,
  options?: { confirm?: boolean; estimateId?: string | null }
): Promise<CrawlEstimateResponse | CrawlStartResponse> {
  const body: any = {};
  if (domainOverride) body.domain = domainOverride;
  if (options?.confirm) body.confirm = true;
  if (options?.estimateId) body.estimateId = options.estimateId;

  return authFetchJson<CrawlEstimateResponse | CrawlEstimatePendingResponse | CrawlStartResponse>(
    `/bots/${encodeURIComponent(botId)}/knowledge/crawl-domain`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

export async function uploadBotDocuments(
  botId: string,
  files: FileList | File[]
): Promise<{ status: string; knowledgeClientId: string; files: string[]; knowledge?: any }> {
  const formData = new FormData();
  Array.from(files as FileList | File[]).forEach((file) => {
    formData.append('files', file);
  });

  return authFetchJson<{
    status: string;
    knowledgeClientId: string;
    files: string[];
    knowledge?: any;
  }>(`/bots/${encodeURIComponent(botId)}/knowledge/upload-docs`, {
    method: 'POST',
    body: formData,
  });
}

export async function estimateBotCrawl(botId: string, domainOverride?: string): Promise<any> {
  const body = domainOverride ? { domain: domainOverride } : {};
  return authFetchJson<any>(`/bots/${encodeURIComponent(botId)}/knowledge/estimate-crawl`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getBotCrawlEstimateStatus(
  botId: string,
  estimateId: string
): Promise<CrawlEstimateResponse | { status: 'running' | 'failed'; error?: string }> {
  return authFetchJson<CrawlEstimateResponse | { status: 'running' | 'failed'; error?: string }>(
    `/bots/${encodeURIComponent(botId)}/knowledge/estimate-crawl-status?estimateId=${encodeURIComponent(
      estimateId
    )}`
  );
}

export async function getBotCrawlStatus(
  botId: string,
  jobId: string
): Promise<KnowledgeCrawlJobResponse> {
  return authFetchJson<KnowledgeCrawlJobResponse>(
    `/bots/${encodeURIComponent(botId)}/knowledge/crawl-status?jobId=${encodeURIComponent(jobId)}`
  );
}

export async function getBotCrawlHistory(
  botId: string,
  page: number
): Promise<KnowledgeCrawlHistoryResponse> {
  return authFetchJson<KnowledgeCrawlHistoryResponse>(
    `/bots/${encodeURIComponent(botId)}/knowledge/crawl-history?page=${encodeURIComponent(String(page))}`
  );
}

export async function deactivateBotKnowledgeJob(
  botId: string,
  jobId: string
): Promise<{ status: string; jobId: string; jobType: string; deactivated: number }> {
  return authFetchJson<{ status: string; jobId: string; jobType: string; deactivated: number }>(
    `/bots/${encodeURIComponent(botId)}/knowledge/deactivate-job`,
    {
      method: 'POST',
      body: JSON.stringify({ jobId }),
    }
  );
}

export async function getBotJobChunks(
  botId: string,
  jobId: string
): Promise<{ jobId: string; jobType: string; chunks: KnowledgeChunk[] }> {
  const q = new URLSearchParams({ jobId });
  return authFetchJson<{ jobId: string; jobType: string; chunks: KnowledgeChunk[] }>(
    `/bots/${encodeURIComponent(botId)}/knowledge/chunks?${q.toString()}`
  );
}

export async function updateBotJobChunk(
  botId: string,
  chunkId: string,
  text: string
): Promise<{ chunk: KnowledgeChunk }> {
  return authFetchJson<{ chunk: KnowledgeChunk }>(
    `/bots/${encodeURIComponent(botId)}/knowledge/chunks/${encodeURIComponent(chunkId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    }
  );
}

export async function deleteBotJobChunk(
  botId: string,
  chunkId: string
): Promise<{ status: string; chunkId: string }> {
  return authFetchJson<{ status: string; chunkId: string }>(
    `/bots/${encodeURIComponent(botId)}/knowledge/chunks/${encodeURIComponent(chunkId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function estimateBotDocuments(
  botId: string,
  files: FileList | File[]
): Promise<any> {
  const formData = new FormData();
  Array.from(files as FileList | File[]).forEach((file) => {
    formData.append('files', file);
  });

  return authFetchJson<any>(`/bots/${encodeURIComponent(botId)}/knowledge/estimate-docs`, {
    method: 'POST',
    body: formData,
  });
}

export async function fetchChannels(botId: string): Promise<BotChannel[]> {
  return authFetchJson<BotChannel[]>(`/bots/${encodeURIComponent(botId)}/channels`);
}

export interface CreateChannelPayload {
  type: ChannelType;
  externalId: string;
  accessToken: string;
  meta?: any;
}

export async function createChannel(
  botId: string,
  payload: CreateChannelPayload
): Promise<BotChannel> {
  return authFetchJson<BotChannel>(`/bots/${encodeURIComponent(botId)}/channels`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateChannelPayload {
  externalId?: string;
  accessToken?: string;
  meta?: any;
}

export async function updateChannel(
  botId: string,
  channelId: string,
  payload: UpdateChannelPayload
): Promise<BotChannel> {
  return authFetchJson<BotChannel>(
    `/bots/${encodeURIComponent(botId)}/channels/${encodeURIComponent(channelId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteChannel(botId: string, channelId: string): Promise<void> {
  await authFetchJson<unknown>(
    `/bots/${encodeURIComponent(botId)}/channels/${encodeURIComponent(channelId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function fetchBotConversations(
  botId: string,
  page = 1
): Promise<PaginatedConversations> {
  const query = `?page=${encodeURIComponent(String(page))}`;
  return authFetchJson<PaginatedConversations>(`/conversations/bots/${encodeURIComponent(botId)}${query}`);
}

export async function fetchConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  return authFetchJson<ConversationMessage[]>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`
  );
}

export async function setConversationMode(
  conversationId: string,
  mode: ConversationMode
): Promise<{ ok: boolean; mode: ConversationMode }> {
  return authFetchJson<{ ok: boolean; mode: ConversationMode }>(
    `/conversations/${encodeURIComponent(conversationId)}/mode`,
    {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }
  );
}

export interface ConversationDetails {
  id: string;
  botId: string;
  channel: ChannelType;
  externalUserId: string;
  createdAt: string;
  lastMessageAt: string;
  mode: ConversationMode;
  lastUserMessageAt?: string | null;
  revenueAI?: {
    mode: "AUTO" | "SOFT" | "CLOSER";
    assignedStyle: "SOFT" | "CLOSER";
    overrideStyle: "SOFT" | "CLOSER" | null;
    overrideExpiresAt: string | null;
    overrideScope: "SESSION" | "CONVERSATION" | null;
    effectiveStyle: "SOFT" | "CLOSER";
  };
  business: {
    title: string;
    subtitle?: string | null;
  };
  user: {
    identifier: string;
    displayName?: string | null;
  };
}

export async function fetchConversationDetails(
  conversationId: string
): Promise<ConversationDetails> {
  return authFetchJson<ConversationDetails>(
    `/conversations/${encodeURIComponent(conversationId)}/details`
  );
}

export async function setConversationRevenueAIStyle(
  conversationId: string,
  style: "AUTO" | "SOFT" | "CLOSER",
  expiresInHours?: number
): Promise<{ ok: boolean; style: string; expiresAt: string | null; scope: string }> {
  return authFetchJson<{ ok: boolean; style: string; expiresAt: string | null; scope: string }>(
    `/conversations/${encodeURIComponent(conversationId)}/revenue-ai-style`,
    {
      method: "POST",
      body: JSON.stringify({ style, expiresInHours })
    }
  );
}

export async function sendTestConversationMessage(
  conversationId: string,
  text: string
): Promise<{ ok: boolean }> {
  return authFetchJson<{ ok: boolean }>(
    `/conversations/${encodeURIComponent(conversationId)}/test-send`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    }
  );
}

export async function sendManualConversationMessage(
  conversationId: string,
  text: string
): Promise<{ ok: boolean }> {
  return authFetchJson<{ ok: boolean }>(
    `/conversations/${encodeURIComponent(conversationId)}/send`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    }
  );
}

export interface ConversationEvalResponse {
  score: number;
  label?: string | null;
  details?: string | null;
  isAuto: boolean;
  createdAt: string;
}

export interface BulkConversationEvalItem {
  conversationId: string;
  ok: boolean;
  error?: string | null;
  result?: ConversationEvalResponse;
}

export async function evaluateConversationApi(
  conversationId: string
): Promise<ConversationEvalResponse> {
  return authFetchJson<ConversationEvalResponse>(
    `/conversations/${encodeURIComponent(conversationId)}/eval`,
    {
      method: 'POST',
    }
  );
}

export async function bulkEvaluateConversationsApi(
  conversationIds: string[]
): Promise<BulkConversationEvalItem[]> {
  const res = await authFetchJson<{ items: BulkConversationEvalItem[] }>('/conversations/eval-bulk', {
    method: 'POST',
    body: JSON.stringify({ conversationIds }),
  });
  return res.items || [];
}

export interface MetaPageSummary {
  id: string;
  name: string;
  instagramBusinessId?: string | null;
  isBusinessManaged?: boolean;
  businessName?: string | null;
}

export interface MetaSessionResponse {
  id: string;
  botId: string;
  channelType: ChannelType;
  pages: MetaPageSummary[];
  createdAt: string;
}

export async function getMetaConnectUrl(
  botId: string,
  type: 'FACEBOOK' | 'INSTAGRAM',
  returnPath?: string
): Promise<{ url: string }> {
  const params = new URLSearchParams();
  params.set('type', type);
  if (returnPath) {
    params.set('returnPath', returnPath);
  }

  return authFetchJson<{ url: string }>(
    `/bots/meta/${encodeURIComponent(botId)}/connect?${params.toString()}`
  );
}

export async function getMetaSession(sessionId: string): Promise<MetaSessionResponse> {
  return authFetchJson<MetaSessionResponse>(`/meta/sessions/${encodeURIComponent(sessionId)}`);
}

export async function attachMetaSession(sessionId: string, pageId: string): Promise<BotChannel> {
  return authFetchJson<BotChannel>(`/meta/sessions/${encodeURIComponent(sessionId)}/attach`, {
    method: 'POST',
    body: JSON.stringify({ pageId }),
  });
}

export interface WhatsappNumberSummary {
  id: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
}

export interface WhatsappConnectSessionResponse {
  sessionId: string;
  numbers: WhatsappNumberSummary[];
}

export async function completeWhatsappEmbeddedSignup(
  botId: string,
  payload: { code: string; redirectUri?: string }
): Promise<WhatsappConnectSessionResponse> {
  return authFetchJson<WhatsappConnectSessionResponse>(
    `/bots/${encodeURIComponent(botId)}/whatsapp/embedded/complete`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function attachWhatsappSession(
  sessionId: string,
  phoneId: string,
  pin?: string
): Promise<BotChannel> {
  const body: { phoneId: string; pin?: string } = { phoneId };
  const trimmedPin = pin?.trim();
  if (trimmedPin) {
    body.pin = trimmedPin;
  }

  return authFetchJson<BotChannel>(`/whatsapp/sessions/${encodeURIComponent(sessionId)}/attach`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type WhatsappTemplateStatus = 'APPROVED' | 'REJECTED' | 'PENDING' | 'INACTIVE' | 'PAUSED';

export interface WhatsappTemplateComponentButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface WhatsappTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT';
  text?: string;
  example?: {
    body_text?: string[];
    header_text?: string[];
  };
  buttons?: WhatsappTemplateComponentButton[];
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: WhatsappTemplateStatus;
  components: WhatsappTemplateComponent[];
  rejectionReason?: string | null;
  qualityScore?: string | null;
  lastUpdatedAt?: string | null;
}

export interface WhatsappTemplateListResponse {
  items: WhatsappTemplate[];
  paging?: {
    nextCursor?: string | null;
    previousCursor?: string | null;
  };
}

export interface WhatsappTemplateFilter {
  search?: string;
  status?: WhatsappTemplateStatus | 'ALL';
  category?: string | 'ALL';
  language?: string;
  cursor?: string;
  limit?: number;
}

export interface WhatsappTemplateUpsertPayload {
  name: string;
  category: string;
  language: string;
  components: WhatsappTemplateComponent[];
}

export async function fetchWhatsappTemplates(
  botId: string,
  filter?: WhatsappTemplateFilter
): Promise<WhatsappTemplateListResponse> {
  const params = new URLSearchParams();

  if (filter?.search) params.set('search', filter.search);
  if (filter?.status && filter.status !== 'ALL') {
    params.set('status', filter.status);
  }
  if (filter?.category && filter.category !== 'ALL') {
    params.set('category', filter.category);
  }
  if (filter?.language) params.set('language', filter.language);
  if (filter?.cursor) params.set('cursor', filter.cursor);
  if (filter?.limit) params.set('limit', String(filter.limit));

  const qs = params.toString();
  const url = `/bots/${encodeURIComponent(botId)}/whatsapp/templates` + (qs ? `?${qs}` : '');

  return authFetchJson<WhatsappTemplateListResponse>(url);
}

export async function createWhatsappTemplate(
  botId: string,
  payload: WhatsappTemplateUpsertPayload
): Promise<{ ok: boolean }> {
  return authFetchJson<{ ok: boolean }>(`/bots/${encodeURIComponent(botId)}/whatsapp/templates`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateWhatsappTemplate(
  botId: string,
  templateId: string,
  payload: WhatsappTemplateUpsertPayload
): Promise<{ ok: boolean }> {
  return authFetchJson<{ ok: boolean }>(
    `/bots/${encodeURIComponent(botId)}/whatsapp/templates/${encodeURIComponent(templateId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

export type MetaLeadStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export interface MetaLead {
  id: string;
  createdAt: string;
  pageId: string;
  leadgenId: string;
  formId?: string | null;
  phone?: string | null;
  whatsappStatus: MetaLeadStatus;
  whatsappError?: string | null;
}

export interface MetaLeadAutomationSettings {
  phoneFieldName: string;
  consentFieldName?: string | null;
  requiresWhatsappOptIn: boolean;
  templateName?: string | null;
  templateLanguage?: string | null;
}

export async function fetchMetaLeadAutomation(
  botId: string
): Promise<MetaLeadAutomationSettings | null> {
  return authFetchJson<MetaLeadAutomationSettings | null>(
    `/bots/${encodeURIComponent(botId)}/meta-leads/automation`
  );
}

export async function upsertMetaLeadAutomation(
  botId: string,
  payload: MetaLeadAutomationSettings
): Promise<MetaLeadAutomationSettings> {
  return authFetchJson<MetaLeadAutomationSettings>(
    `/bots/${encodeURIComponent(botId)}/meta-leads/automation`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchMetaLeads(
  botId: string,
  params?: { limit?: number }
): Promise<{ items: MetaLead[] }> {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) {
    searchParams.set('limit', String(params.limit));
  }
  const qs = searchParams.toString();
  const url = `/bots/${encodeURIComponent(botId)}/meta-leads` + (qs ? `?${qs}` : '');
  return authFetchJson<{ items: MetaLead[] }>(url);
}
