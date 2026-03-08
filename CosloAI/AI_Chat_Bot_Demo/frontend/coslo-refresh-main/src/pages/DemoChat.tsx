import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BotInfo, fetchBotInfo } from '@/api/client';
import Chat from '@/components/Chat';
import { Bot } from 'lucide-react';

const DemoChat = () => {
  const { slug } = useParams<{ slug: string }>();
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetchBotInfo(slug)
      .then((data) => setBot(data))
      .catch((err) => {
        console.error(err);
        setError(err.message || t('demoBot.defaultError'));
      })
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (!slug) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        {t('demoBot.noSlug')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        {t('demoBot.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h2 className="font-display text-xl font-semibold text-foreground mb-2">{t('demoBot.errorTitle')}</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h2 className="font-display text-xl font-semibold text-foreground mb-2">{t('demoBot.notFoundTitle')}</h2>
        <p className="text-muted-foreground">{t('demoBot.notFoundBody')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display font-semibold text-foreground text-sm">{bot.name}</h1>
          {bot.description && <p className="text-xs text-muted-foreground">{bot.description}</p>}
        </div>
      </header>
      <Chat slug={bot.slug} botName={bot.name} />
    </div>
  );
};

export default DemoChat;
