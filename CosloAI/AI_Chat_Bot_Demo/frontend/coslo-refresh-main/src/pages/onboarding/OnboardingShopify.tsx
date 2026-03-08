import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import OnboardingStepper from '@/components/OnboardingStepper';
import { ShoppingBag } from 'lucide-react';
import { getBotById, updateBot } from '@/api/bots';
import {
  fetchShopifyShops,
  linkShopifyShop,
  syncShopifyProducts,
  type ShopifyShopSummary,
} from '@/api/shopify';
import { API_BASE_URL } from '@/api/client';
import {
  buildShopifySearch,
  getShopFromSearch,
  getShopifyOnboarding,
  startShopifyOnboarding,
} from '@/utils/shopifyOnboarding';

const SHOP_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

const OnboardingShopify = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [shops, setShops] = useState<ShopifyShopSummary[]>([]);
  const [shopDomain, setShopDomain] = useState<string>('');
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [autoLinkAttempted, setAutoLinkAttempted] = useState(false);

  const onboarding = getShopifyOnboarding();
  const shopFromQuery = getShopFromSearch(location.search);
  const resolvedShop = useMemo(
    () => shopFromQuery || onboarding?.shopDomain || '',
    [shopFromQuery, onboarding?.shopDomain]
  );

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    getBotById(id)
      .then(async (b) => {
        if (resolvedShop) {
          startShopifyOnboarding(id, resolvedShop);
          setShopDomain(resolvedShop);
        }

        if (b.knowledgeSource !== 'SHOPIFY' || b.useDomainCrawler || b.usePdfCrawler) {
          try {
            await updateBot(id, {
              knowledgeSource: 'SHOPIFY',
              useDomainCrawler: false,
              usePdfCrawler: false,
            });
          } catch (err) {
            console.error('Failed to update bot knowledge source', err);
          }
        }
      })
      .catch((err: any) => {
        console.error(err);
        setError(
          err?.message ||
            t('shopifyOnboarding.errors.loadBot')
        );
      })
      .finally(() => setLoading(false));
  }, [id, resolvedShop, t]);

  const loadShopify = async () => {
    if (!id) return;
    setShopifyLoading(true);
    try {
      const resp = await fetchShopifyShops(id);
      const items = resp.items || [];
      setShops(items);
      const active = items.find((s) => s.isActive) || items[0];
      if (active?.shopDomain && !shopDomain) {
        setShopDomain(active.shopDomain);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setShopifyLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    loadShopify().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const activeShop = shops.find((s) => s.isActive) || shops[0] || null;
  const shopifyConnected = !!activeShop?.shopDomain;
  const shopifyHasSync = !!activeShop?.lastProductsSyncAt;

  useEffect(() => {
    if (!id || !resolvedShop) return;
    if (autoLinkAttempted) return;
    if (shopifyConnected && activeShop?.shopDomain) {
      setAutoLinkAttempted(true);
      return;
    }
    if (!shopDomain) {
      setShopDomain(resolvedShop);
    }
    setAutoLinkAttempted(true);
    handleLinkShop(resolvedShop).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, resolvedShop, shopifyConnected, activeShop?.shopDomain, autoLinkAttempted]);

  const handleLinkShop = async (overrideShop: string) => {
    if (!id) return;
    const trimmed = (overrideShop || shopDomain).trim().toLowerCase();
    if (!SHOP_DOMAIN_REGEX.test(trimmed)) {
      setError(
        t('shopifyPage.errors.invalidShop')
      );
      return;
    }

    setLinking(true);
    setError(null);
    setBlockedByOther(false);

    try {
      await linkShopifyShop(trimmed, id);
      await loadShopify();
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('already linked')) {
        setBlockedByOther(true);
        setError(
          t('shopifyOnboarding.errors.linkedToOther')
        );
      } else {
        setError(err?.message || t('shopifyPage.errors.linkFailed'));
      }
    } finally {
      setLinking(false);
    }
  };

  const handleInstallShopify = () => {
    if (!id) return;
    const trimmed = shopDomain.trim().toLowerCase();
    if (!SHOP_DOMAIN_REGEX.test(trimmed)) {
      setError(
        t('shopifyPage.errors.invalidShop')
      );
      return;
    }

    const returnTo = `${window.location.pathname}${window.location.search}`;
    const installUrl =
      `${API_BASE_URL}/shopify/install?shop=${encodeURIComponent(trimmed)}` +
      `&botId=${encodeURIComponent(id)}` +
      `&returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = installUrl;
  };

  const handleSyncShopify = async () => {
    if (!activeShop) return;
    setSyncing(true);
    setError(null);
    try {
      await syncShopifyProducts(activeShop.shopDomain);
      await loadShopify();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t('shopifyPage.errors.syncFailed'));
    } finally {
      setSyncing(false);
    }
  };

  const handleContinue = () => {
    if (!id) return;
    const shopQuery = buildShopifySearch(shopDomain || resolvedShop || '');
    navigate(`/onboarding/bots/${encodeURIComponent(id)}/channels${shopQuery}`);
  };

  const statusLabel = shopifyLoading
    ? t('shopifyPage.loading')
    : shopifyConnected
      ? t('shopifyPage.status.active')
      : t('shopifyPage.status.inactive');

  const shopifySteps = [
    { label: t('onboardingLayout.steps.bot'), path: '/onboarding/bots/new' },
    { label: t('onboardingLayout.steps.shopify'), path: '/onboarding/bots/:id/shopify' },
    { label: t('onboardingLayout.steps.channels'), path: '/onboarding/bots/:id/channels' },
    { label: t('onboardingLayout.steps.booking'), path: '/onboarding/bots/:id/booking' },
    { label: t('onboardingLayout.steps.leadAds'), path: '/onboarding/bots/:id/lead-ads' },
    { label: t('onboardingLayout.steps.plan'), path: '/onboarding/bots/:id/plan' },
    { label: t('onboardingLayout.steps.knowledge'), path: '/onboarding/bots/:id/knowledge' },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      <OnboardingStepper steps={shopifySteps} botId={id} />

      <div className="mt-8 rounded-2xl bg-card border border-border p-8 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-primary">
              <ShoppingBag className="h-4 w-4" />
              <span>{t('shopifyOnboarding.title')}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('shopifyPage.connect.title')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('shopifyOnboarding.subtitle')}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              shopifyConnected ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-foreground'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <>
            {error && (
              <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  {t('shopifyPage.connect.shopDomain')}
                </label>
                <Input
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder={t('shopifyPage.connect.shopPlaceholder')}
                  disabled={!!resolvedShop}
                  className="mt-1"
                />
              </div>

              {!shopifyConnected && (
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => handleLinkShop()} disabled={linking || blockedByOther}>
                    {linking
                      ? t('shopifyPage.actions.redirecting')
                      : t('shopifyOnboarding.actions.link')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleInstallShopify}
                    disabled={linking || blockedByOther}
                  >
                    {t('shopifyPage.actions.install')}
                  </Button>
                </div>
              )}
            </div>

            {activeShop && (
              <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <span>{t('shopifyPage.summary.connectedShop')}</span>
                  <span className="text-foreground font-medium">{activeShop.shopDomain}</span>
                </div>
                <div className="flex justify-between gap-4 mt-2">
                  <span>{t('shopifyPage.summary.catalog')}</span>
                  <span className="text-foreground">
                    {t('shopifyPage.summary.products')}: {activeShop.productCount}{' '}<span aria-hidden="true">&middot;</span>{' '}{t('shopifyPage.summary.variants')}: {activeShop.variantCount}
                  </span>
                </div>
                <div className="flex justify-between gap-4 mt-2">
                  <span>{t('shopifyPage.summary.lastSync')}</span>
                  <span className="text-foreground">
                    {activeShop.lastProductsSyncAt
                      ? new Date(activeShop.lastProductsSyncAt).toLocaleString()
                      : t('shopifyPage.summary.neverSynced')}
                  </span>
                </div>
              </div>
            )}

            {shopifyConnected && (
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={handleSyncShopify} disabled={!activeShop || syncing}>
                  {syncing
                    ? t('shopifyPage.actions.syncing')
                    : t('shopifyPage.actions.sync')}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-border">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                {t('common.back')}
              </Button>
              <Button type="button" onClick={handleContinue} disabled={!shopifyHasSync || blockedByOther}>
                {t('shopifyOnboarding.actions.continue')}
              </Button>
            </div>

            {!shopifyHasSync && (
              <p className="text-xs text-muted-foreground">
                {t('shopifyOnboarding.syncHint')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingShopify;
