const ORIGIN_SHOP_KEY = 'shopify_origin_shop';
const ONBOARDING_BOT_KEY = 'shopify_onboarding_bot_id';
const ONBOARDING_SHOP_KEY = 'shopify_onboarding_shop';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function normalizeShop(shop: string): string {
  return shop.trim().toLowerCase();
}

export function setShopifyOriginShop(shop: string): void {
  if (!canUseStorage()) return;
  const normalized = normalizeShop(shop);
  if (!normalized) return;
  window.localStorage.setItem(ORIGIN_SHOP_KEY, normalized);
}

export function getShopifyOriginShop(): string | null {
  if (!canUseStorage()) return null;
  const value = window.localStorage.getItem(ORIGIN_SHOP_KEY);
  return value ? normalizeShop(value) : null;
}

export function clearShopifyOriginShop(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ORIGIN_SHOP_KEY);
}

export function startShopifyOnboarding(botId: string, shop: string): void {
  if (!canUseStorage()) return;
  const normalized = normalizeShop(shop);
  if (!botId || !normalized) return;
  window.localStorage.setItem(ONBOARDING_BOT_KEY, botId);
  window.localStorage.setItem(ONBOARDING_SHOP_KEY, normalized);
}

export function getShopifyOnboarding(): { botId: string; shopDomain: string } | null {
  if (!canUseStorage()) return null;
  const botId = window.localStorage.getItem(ONBOARDING_BOT_KEY);
  const shopDomain = window.localStorage.getItem(ONBOARDING_SHOP_KEY);
  if (!botId || !shopDomain) return null;
  return { botId, shopDomain: normalizeShop(shopDomain) };
}

export function clearShopifyOnboarding(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(ONBOARDING_BOT_KEY);
  window.localStorage.removeItem(ONBOARDING_SHOP_KEY);
}

export function isShopifyOnboardingBot(botId?: string | null): boolean {
  if (!botId) return false;
  const onboarding = getShopifyOnboarding();
  return onboarding?.botId === botId;
}

export function getShopFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const shop = params.get('shop');
  return shop ? normalizeShop(shop) : null;
}

export function hasShopifyFlowParam(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('shopify') === '1';
}

export function buildShopifySearch(shop?: string | null): string {
  const params = new URLSearchParams();
  params.set('shopify', '1');
  if (shop) {
    params.set('shop', normalizeShop(shop));
  }
  return `?${params.toString()}`;
}

export function hydrateShopifyOnboardingFromSearch(
  botId: string | undefined | null,
  search: string
): void {
  if (!botId) return;
  const shop = getShopFromSearch(search);
  if (!shop) return;
  if (!hasShopifyFlowParam(search)) return;
  startShopifyOnboarding(botId, shop);
}
