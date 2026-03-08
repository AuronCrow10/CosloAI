import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, ShieldCheck } from 'lucide-react';
import { fetchBots } from '@/api/bots';
import { lookupInviteEmail } from '@/api/auth';
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

type PasswordRule = 'minLength' | 'uppercase' | 'lowercase' | 'digit' | 'special';

const Register = () => {
  const { t } = useTranslation();
  const { register, loginWithGoogle, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const passwordErrors = useMemo(() => {
    const errors: PasswordRule[] = [];
    if (password.length < 8) errors.push('minLength');
    if (!/[A-Z]/.test(password)) errors.push('uppercase');
    if (!/[a-z]/.test(password)) errors.push('lowercase');
    if (!/[0-9]/.test(password)) errors.push('digit');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('special');
    return errors;
  }, [password]);

  const passwordsMatch = password === confirmPassword || confirmPassword === '';

  const shopParam = getShopFromSearch(location.search);
  const inviteToken = new URLSearchParams(location.search).get('invite');

  useEffect(() => {
    if (shopParam) {
      setShopifyOriginShop(shopParam);
    }
  }, [shopParam]);

  useEffect(() => {
    if (!inviteToken) return;
    lookupInviteEmail(inviteToken)
      .then((res) => {
        if (res?.email) setEmail(res.email);
      })
      .catch((err) => {
        console.warn('Invite lookup failed', err);
      });
  }, [inviteToken]);

  const redirectAfterLogin = async () => {
    try {
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
      console.error('Failed to fetch bots after register/login, falling back to /app/bots', err);
      navigate('/app/bots', { replace: true });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError(t('register.errorPasswordMismatch'));
      return;
    }

    if (passwordErrors.length > 0) {
      setError(t('register.errorPasswordRequirements'));
      return;
    }

    try {
      await register(email, password, inviteToken);
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || t('register.errorGeneric'));
    }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('VITE_GOOGLE_CLIENT_ID is not set; Google auth disabled.');
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
          setSuccess(false);

          const result = await loginWithGoogle(idToken);

          if (result && (result as any).kind && (result as any).kind !== 'success') {
            setError(t('register.googleErrorMfaNotSupported'));
            return;
          }

          await redirectAfterLogin();
        } catch (err: any) {
          console.error(err);
          setError(err.message || t('register.googleError'));
        }
      },
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
    });
  }, [loginWithGoogle, t]);

  useEffect(() => {
    if (!user || isLoading) return;
    redirectAfterLogin().catch((err) => {
      console.error('Auto-redirect after existing session failed', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  const hasError = (rule: PasswordRule) => passwordErrors.includes(rule);

  return (
    <section className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 grid gap-12 lg:grid-cols-2 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            {t('register.kicker')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
            {t('register.pageTitle')}
          </h1>
          <p className="text-muted-foreground text-lg">{t('register.subtitle')}</p>
          <ul className="space-y-3 text-muted-foreground">
            <li>&middot; {t('register.bullets.b1')}</li>
            <li>&middot; {t('register.bullets.b2')}</li>
            <li>&middot; {t('register.bullets.b3')}</li>
          </ul>
        </div>

        <div className="glass rounded-2xl p-8 shadow-xl animate-fade-in">
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">{t('register.cardTitle')}</h2>
            <p className="text-muted-foreground text-sm mt-1">{t('register.subtitle')}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">
              {t('register.success')}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('register.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={!!inviteToken}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">{t('register.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-4">
              <p className="text-xs font-semibold text-foreground mb-3">{t('register.pwTitle')}</p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className={hasError('minLength') ? 'text-destructive' : 'text-success'}>
                  {t('register.pwRules.minLength')}
                </li>
                <li className={hasError('uppercase') ? 'text-destructive' : 'text-success'}>
                  {t('register.pwRules.uppercase')}
                </li>
                <li className={hasError('lowercase') ? 'text-destructive' : 'text-success'}>
                  {t('register.pwRules.lowercase')}
                </li>
                <li className={hasError('digit') ? 'text-destructive' : 'text-success'}>
                  {t('register.pwRules.digit')}
                </li>
                <li className={hasError('special') ? 'text-destructive' : 'text-success'}>
                  {t('register.pwRules.special')}
                </li>
              </ul>
            </div>

            <div>
              <Label htmlFor="confirmPassword">{t('register.passwordConfirm')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
              />
              {!passwordsMatch && (
                <p className="mt-2 text-xs text-destructive">{t('register.errorPasswordMismatch')}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('register.submitting') : t('register.submit')}
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
            {t('register.alreadyAccount')}{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t('register.login')}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Register;
