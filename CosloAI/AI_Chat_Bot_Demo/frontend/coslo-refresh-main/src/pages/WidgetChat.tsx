import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BotInfo, fetchBotInfo } from '@/api/client';
import Chat from '@/components/Chat';

const WidgetChat = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetchBotInfo(slug)
      .then((data) => setBot(data))
      .catch((err) => {
        console.error(err);
        setError(err.message || t('widgetChat.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (!slug) return <div className="p-4 text-sm text-muted-foreground">{t('widgetChat.noSlug')}</div>;
  if (loading) return <div className="p-4 text-sm text-muted-foreground">{t('widgetChat.loading')}</div>;
  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>;
  if (!bot) return <div className="p-4 text-sm text-muted-foreground">{t('widgetChat.notFound')}</div>;

  return (
    <div className="widget-page">
      <Chat slug={bot.slug} botName={bot.name} showPoweredBy variant="widget" />
    </div>
  );
};

export default WidgetChat;
