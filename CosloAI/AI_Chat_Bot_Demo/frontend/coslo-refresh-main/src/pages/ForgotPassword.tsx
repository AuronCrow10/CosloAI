import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';
import { forgotPasswordApi, resetPasswordApi } from '@/api/auth';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordErrors = useMemo(() => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('minLength');
    if (!/[A-Z]/.test(password)) errors.push('uppercase');
    if (!/[a-z]/.test(password)) errors.push('lowercase');
    if (!/[0-9]/.test(password)) errors.push('digit');
    if (!/[^A-Za-z0-9]/.test(password)) errors.push('special');
    return errors;
  }, [password]);

  const passwordsMatch = password === confirmPassword || confirmPassword === '';

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await forgotPasswordApi(email.trim());
      setSuccess(res.message || t('forgotPassword.success.requested'));
      setStep('reset');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t('forgotPassword.errors.requestFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!passwordsMatch) {
      setError(t('forgotPassword.errors.mismatch'));
      return;
    }

    if (passwordErrors.length > 0) {
      setError(t('forgotPassword.errors.requirements'));
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordApi(email.trim(), code.trim(), password);
      setSuccess(res.message || t('forgotPassword.success.reset'));
      setPassword('');
      setConfirmPassword('');
      setCode('');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t('forgotPassword.errors.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 grid gap-12 lg:grid-cols-2 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <KeyRound className="h-4 w-4" />
            {t('forgotPassword.kicker')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
            {t('forgotPassword.title')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {step === 'request'
              ? t('forgotPassword.subtitle.request')
              : t('forgotPassword.subtitle.reset')}
          </p>
          <ul className="space-y-3 text-muted-foreground">
            <li>&middot; {t('forgotPassword.bullets.b1')}</li>
            <li>&middot; {t('forgotPassword.bullets.b2')}</li>
            <li>&middot; {t('forgotPassword.bullets.b3')}
            </li>
          </ul>
        </div>

        <div className="glass rounded-2xl p-8 shadow-xl animate-fade-in">
          <div className="text-center mb-8">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              {t('forgotPassword.title')}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {step === 'request'
                ? t('forgotPassword.subtitle.request')
                : t('forgotPassword.subtitle.reset')}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">
              {success}
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <Label htmlFor="email">{t('forgotPassword.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? t('forgotPassword.actions.sending')
                  : t('forgotPassword.actions.sendCode')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('forgotPassword.backToLogin')}{' '}
                <Link to="/login" className="text-primary hover:underline">
                  {t('login.pageTitle')}
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <Label htmlFor="emailReset">{t('forgotPassword.emailLabel')}</Label>
                <Input
                  id="emailReset"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="code">{t('forgotPassword.codeLabel')}</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={6}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="newPassword">{t('forgotPassword.newPassword')}</Label>
                <Input
                  id="newPassword"
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
                  <li className={passwordErrors.includes('minLength') ? 'text-destructive' : 'text-success'}>
                    {t('register.pwRules.minLength')}
                  </li>
                  <li className={passwordErrors.includes('uppercase') ? 'text-destructive' : 'text-success'}>
                    {t('register.pwRules.uppercase')}
                  </li>
                  <li className={passwordErrors.includes('lowercase') ? 'text-destructive' : 'text-success'}>
                    {t('register.pwRules.lowercase')}
                  </li>
                  <li className={passwordErrors.includes('digit') ? 'text-destructive' : 'text-success'}>
                    {t('register.pwRules.digit')}
                  </li>
                  <li className={passwordErrors.includes('special') ? 'text-destructive' : 'text-success'}>
                    {t('register.pwRules.special')}
                  </li>
                </ul>
              </div>

              <div>
                <Label htmlFor="confirmPassword">
                  {t('forgotPassword.confirmPassword')}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1"
                />
                {!passwordsMatch && (
                  <p className="mt-2 text-xs text-destructive">
                    {t('register.errorPasswordMismatch')}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? t('forgotPassword.actions.updating')
                  : t('forgotPassword.actions.resetPassword')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('forgotPassword.backToLogin')}{' '}
                <Link to="/login" className="text-primary hover:underline">
                  {t('login.pageTitle')}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;
