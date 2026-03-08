import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export const CookieBanner = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('coslo_cookie_consent');
    if (!consent) setVisible(true);
  }, []);

  const handle = (accepted: boolean) => {
    localStorage.setItem('coslo_cookie_consent', accepted ? 'accepted' : 'rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="mx-auto max-w-4xl glass rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">{t('cookie.message')}</p>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => handle(false)}>
            {t('cookie.reject')}
          </Button>
          <Button size="sm" onClick={() => handle(true)}>
            {t('cookie.accept')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
