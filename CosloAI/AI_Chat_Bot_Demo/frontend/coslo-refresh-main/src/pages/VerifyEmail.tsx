import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { verifyEmailApi } from '@/api/auth';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage(t('verifyEmail.missingToken'));
        return;
      }

      setStatus('loading');
      try {
        const res = await verifyEmailApi(token);
        setStatus(res.success ? 'success' : 'error');
        setMessage(
          res.message ||
            (res.success ? t('verifyEmail.successDefault') : t('verifyEmail.invalidOrExpired'))
        );
      } catch (err: any) {
        console.error(err);
        setStatus('error');
        setMessage(err.message || t('verifyEmail.genericError'));
      }
    };
    verify();
  }, [token, t]);

  return (
    <section className="min-h-screen bg-background py-16">
      <div className="container mx-auto px-4 flex items-center justify-center">
        <div className="w-full max-w-md glass rounded-2xl p-8 animate-fade-in text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin mb-4" />
              <h1 className="font-display text-2xl font-bold text-foreground">
                {t('verifyEmail.loading')}
              </h1>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                {t('verifyEmail.title')}
              </h1>
              <p className="text-muted-foreground mb-6">
                {message || t('verifyEmail.successDefault')}
              </p>
              <Link to="/login">
                <Button className="w-full">{t('verifyEmail.loginLink')}</Button>
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                {t('verifyEmail.title')}
              </h1>
              <p className="text-muted-foreground mb-6">
                {message || t('verifyEmail.invalidOrExpired')}
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  {t('verifyEmail.loginLink')}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default VerifyEmail;
