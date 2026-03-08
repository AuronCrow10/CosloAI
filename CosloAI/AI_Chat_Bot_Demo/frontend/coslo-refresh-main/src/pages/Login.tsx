import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, ShieldCheck } from 'lucide-react';
import { fetchBots } from '@/api/bots';
import { getStoredUser } from '@/api/auth';
import { lookupShopifyShop } from '@/api/shopify';
import {
  buildShopifySearch,
  clearShopifyOriginShop,
  getShopFromSearch,
  getShopifyOriginShop,
  setShopifyOriginShop,
} from '@/utils/shopifyOnboarding';

declare global {
  interface Window {
    google?: any;
  }
}

type LoginStage = 'credentials' | 'mfa';

const Login = () => {
  const { t } = useTranslation();
  const { login, loginWithGoogle, loginWithMfaTotp, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/app/bots';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [stage, setStage] = useState<LoginStage>('credentials');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const shopParam = getShopFromSearch(location.search);

  useEffect(() => {
    if (shopParam) {
      setShopifyOriginShop(shopParam);
    }
  }, [shopParam]);

  const redirectAfterLogin = async () => {
    try {
      const storedUser = getStoredUser();
      if (storedUser?.role === 'TEAM_MEMBER') {
        navigate('/app/bots', { replace: true });
        return;
      }

      const shopOrigin = shopParam || getShopifyOriginShop();
      if (shopOrigin) {
        try {
          const lookup = await lookupShopifyShop(shopOrigin);

          if (lookup.status === 'linked_to_you' && lookup.botId) {
            clearShopifyOriginShop();
            navigate(`/app/bots/${encodeURIComponent(lookup.botId)}`, { replace: true });
            return;
          }

          if (lookup.status === 'available') {
            setShopifyOriginShop(shopOrigin);
            navigate(`/onboarding/bots/new${buildShopifySearch(shopOrigin)}`, {
              replace: true,
            });
            return;
          }

          if (lookup.status === 'linked_to_other') {
            clearShopifyOriginShop();
            window.alert(
              t(
                'shopifyOnboarding.errors.linkedToOther',
                'This Shopify store is already linked to another Coslo account. Please unlink it first.'
              )
            );
          } else if (lookup.status === 'inactive') {
            clearShopifyOriginShop();
            window.alert(
              t(
                'shopifyOnboarding.errors.inactiveShop',
                'This Shopify store is inactive. Please reinstall the app and try again.'
              )
            );
          }
        } catch (err) {
          console.error('Shopify lookup failed, falling back to default flow', err);
        }
      }

      const bots = await fetchBots();
      if (!bots || bots.length === 0) {
        navigate('/onboarding/bots/new', { replace: true });
      } else {
        navigate('/app/bots', { replace: true });
      }
    } catch (err) {
      console.error('Failed to fetch bots after login, falling back to /app/bots', err);
      navigate('/app/bots', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMfaError(null);
    try {
      const result = await login(email, password);
      if (result.kind === 'success') {
        await redirectAfterLogin();
      } else {
        setMfaToken(result.mfaToken);
        setStage('mfa');
        setMfaCode('');
      }
    } catch (err: any) {
      setError(err.message || t('login.loginError'));
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;

    setMfaError(null);

    try {
      await loginWithMfaTotp(mfaToken, mfaCode.trim());
      await redirectAfterLogin();
    } catch (err: any) {
      setMfaError(err.message || t('login.mfaError'));
      setMfaCode('');
    }
  };

  const handleBackToCredentials = () => {
    setStage('credentials');
    setMfaToken(null);
    setMfaCode('');
    setMfaError(null);
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not set; Google login disabled.');
      return;
    }
    if (!window.google || !googleButtonRef.current) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: any) => {
        const idToken = response.credential;
        if (!idToken) return;
        try {
          setError(null);
          setMfaError(null);
          const result = await loginWithGoogle(idToken);
          if (result.kind === 'success') {
            await redirectAfterLogin();
          } else {
            setMfaToken(result.mfaToken);
            setStage('mfa');
            setMfaCode('');
          }
        } catch (err: any) {
          console.error(err);
          setError(err.message || t('login.googleError'));
        }
      },
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
    });
  }, [from, loginWithGoogle, t]);

  useEffect(() => {
    if (!user || isLoading) return;
    redirectAfterLogin().catch((err) => {
      console.error('Auto-redirect after existing session failed', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  return (
    <section className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 grid gap-12 lg:grid-cols-2 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            {t('login.kicker')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
            {t('login.pageTitle')}
          </h1>
          <p className="text-muted-foreground text-lg">{t('login.subtitle')}</p>
          <ul className="space-y-3 text-muted-foreground">
            <li>&middot; {t('login.bullets.b1')}</li>
            <li>&middot; {t('login.bullets.b2')}</li>
            <li>&middot; {t('login.bullets.b3')}</li>
          </ul>
        </div>

        <div className="glass rounded-2xl p-8 shadow-xl animate-fade-in">
          {stage === 'credentials' ? (
            <>
              <div className="text-center mb-8">
                <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">{t('login.cardTitle')}</h2>
                <p className="text-muted-foreground text-sm mt-1">{t('login.subtitle')}</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">{t('login.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">{t('login.password')}</Label>
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                      {t('login.forgotPassword')}
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('login.submitting') : t('login.submit')}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">{t('login.divider')}</span>
                </div>
              </div>

              <div className="flex justify-center">
                <div ref={googleButtonRef} />
              </div>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                {t('auth.legalNotice.p1')}{' '}
                <Link to="/terms" className="text-primary hover:underline">
                  {t('auth.legalNotice.terms')}
                </Link>{' '}
                {t('auth.legalNotice.and')}{' '}
                <Link to="/policy" className="text-primary hover:underline">
                  {t('auth.legalNotice.privacy')}
                </Link>
                .
              </p>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t('login.noAccount')}{' '}
                <Link to="/register" className="text-primary font-medium hover:underline">
                  {t('login.register')}
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">{t('login.mfaTitle')}</h2>
                <p className="text-muted-foreground text-sm mt-1">{t('login.mfaSubtitle')}</p>
              </div>

              {mfaError && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {mfaError}
                </div>
              )}

              <form onSubmit={handleMfa} className="space-y-4">
                <div>
                  <Label htmlFor="mfaCode">{t('login.mfaCodeLabel')}</Label>
                  <Input
                    id="mfaCode"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="000000"
                    className="mt-1 text-center text-2xl tracking-widest"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('login.mfaSubmitting') : t('login.mfaSubmit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleBackToCredentials}
                  disabled={isLoading}
                >
                  {t('login.backToCredentials')}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">{t('login.mfaHelp')}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Login;
