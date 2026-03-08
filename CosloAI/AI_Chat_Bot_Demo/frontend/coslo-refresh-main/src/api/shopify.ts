import { authFetchJson } from './authorizedClient';

export interface ShopifyShopSummary {
  id: string;
  shopDomain: string;
  isActive: boolean;
  installedAt: string;
  uninstalledAt?: string | null;
  scopes: string;
  shopCurrency?: string | null;
  lastProductsSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  variantCount: number;
}

export interface ShopifyShopListResponse {
  items: ShopifyShopSummary[];
}

export type ShopifyShopLookupStatus =
  | 'not_found'
  | 'inactive'
  | 'available'
  | 'linked_to_you'
  | 'linked_to_other';

export interface ShopifyShopLookupResponse {
  status: ShopifyShopLookupStatus;
  shopDomain: string;
  botId?: string;
}

export async function fetchShopifyShops(botId: string): Promise<ShopifyShopListResponse> {
  const params = new URLSearchParams({ botId });
  return authFetchJson<ShopifyShopListResponse>(`/shopify/shops?${params.toString()}`);
}

export async function lookupShopifyShop(shopDomain: string): Promise<ShopifyShopLookupResponse> {
  const params = new URLSearchParams({ shop: shopDomain });
  return authFetchJson<ShopifyShopLookupResponse>(`/shopify/shops/lookup?${params.toString()}`);
}

export async function linkShopifyShop(
  shopDomain: string,
  botId: string | null
): Promise<ShopifyShopSummary> {
  return authFetchJson<ShopifyShopSummary>(`/shopify/shops/${encodeURIComponent(shopDomain)}/link`, {
    method: 'PATCH',
    body: JSON.stringify({ botId }),
  });
}

export async function syncShopifyProducts(
  shopDomain: string
): Promise<{ ok?: boolean; synced?: number; deleted?: number; updated?: number }> {
  return authFetchJson<{ ok?: boolean; synced?: number; deleted?: number; updated?: number }>(
    `/shopify/${encodeURIComponent(shopDomain)}/sync/products`,
    {
      method: 'POST',
    }
  );
}

export async function fetchWidgetConfig(
  shopDomain: string
): Promise<{ botId: string; botSlug: string; botName: string } | null> {
  return authFetchJson<{ botId: string; botSlug: string; botName: string } | null>(
    `/shopify/widget-config?shop=${encodeURIComponent(shopDomain)}`
  );
}

export type ShopCatalogSchema = {
  shopDomain: string;
  updatedAt: string;
  productTypes: Array<{ name: string; count: number }>;
  attributes: Array<{
    name: string;
    source: string;
    coverage: number;
    cardinality: number;
    topValues: string[];
    filterable: boolean;
  }>;
  typeToAttributes: Record<string, string[]>;
};

export type ShopCatalogContext = {
  shopDomain: string;
  updatedAt: string;
  summary: string;
  categories: string[];
  useCases: string[];
  audiences: string[];
  notableAttributes: string[];
  pricePositioning: "budget" | "mid" | "premium" | "mixed" | "unknown";
  priceRange?: { min?: number; max?: number; currency?: string | null };
  signals: {
    productTypes: string[];
    tags: string[];
    optionNames: string[];
  };
  sampleSize: number;
};

export async function fetchCatalogSchema(
  shopDomain: string
): Promise<ShopCatalogSchema | null> {
  const params = new URLSearchParams({ shopDomain });
  const res = await authFetchJson<{ schema: ShopCatalogSchema | null }>(
    `/shopify/catalog-schema?${params.toString()}`
  );
  return res.schema ?? null;
}

export async function rebuildCatalogSchema(
  shopDomain: string
): Promise<ShopCatalogSchema | null> {
  const res = await authFetchJson<{ schema: ShopCatalogSchema | null }>(
    `/shopify/catalog-schema/rebuild`,
    {
      method: 'POST',
      body: JSON.stringify({ shopDomain }),
    }
  );
    return res.schema ?? null;
  }

export async function fetchCatalogContext(
  shopDomain: string
): Promise<ShopCatalogContext | null> {
  const params = new URLSearchParams({ shopDomain });
  const res = await authFetchJson<{ context: ShopCatalogContext | null }>(
    `/shopify/catalog-context?${params.toString()}`
  );
  return res.context ?? null;
}

export async function rebuildCatalogContext(
  shopDomain: string
): Promise<ShopCatalogContext | null> {
  const res = await authFetchJson<{ context: ShopCatalogContext | null }>(
    `/shopify/catalog-context/rebuild`,
    {
      method: 'POST',
      body: JSON.stringify({ shopDomain }),
    }
  );
  return res.context ?? null;
}

export async function updateCatalogContext(
  shopDomain: string,
  patch: Partial<ShopCatalogContext>
): Promise<ShopCatalogContext | null> {
  const params = new URLSearchParams({ shopDomain });
  const res = await authFetchJson<{ context: ShopCatalogContext | null }>(
    `/shopify/catalog-context?${params.toString()}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
  return res.context ?? null;
}
