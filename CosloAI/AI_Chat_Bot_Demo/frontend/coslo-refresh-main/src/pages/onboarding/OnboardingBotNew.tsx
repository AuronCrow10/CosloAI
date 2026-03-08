import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Bot } from 'lucide-react';
import { createBot, type CreateBotPayload, type Bot as BotType } from '@/api/bots';
import OnboardingLayout from './OnboardingLayout';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const OnboardingBotNew = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const validateSlug = (value: string, mode: 'typing' | 'submit'): string | null => {
    const trimmed = value.trim();
    if (!trimmed) {
      return mode === 'submit' ? t('botCreate.errors.slugRequired') : null;
    }
    if (value !== trimmed || /\s/.test(trimmed)) {
      return t('botCreate.errors.slugNoSpaces');
    }
    if (/[A-Z]/.test(trimmed)) {
      return t('botCreate.errors.slugLowercase');
    }
    if (!SLUG_PATTERN.test(trimmed)) {
      return t('botCreate.errors.slugAllowedChars');
    }
    return null;
  };

  const handleChange = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      if (field === 'slug') {
        setSlugError(validateSlug(value, 'typing'));
      }
    };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);
    const nextSlugError = validateSlug(form.slug, 'submit');
    if (nextSlugError) {
      setSlugError(nextSlugError);
      setError(nextSlugError);
      return;
    }

    setSlugError(null);
    setIsSubmitting(true);

    try {
      const payload: CreateBotPayload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
        channelWeb: true,
        knowledgeSource: 'RAG',
        useDomainCrawler: true,
        usePdfCrawler: true,
      };

      const bot: BotType = await createBot(payload);
      navigate(`/onboarding/bots/${encodeURIComponent(bot.id)}/type`);
    } catch (err: any) {
      console.error(err);
      const rawMessage = String(err?.message || '').trim();
      const lower = rawMessage.toLowerCase();

      if (lower.includes('slug already in use')) {
        const message = t('botCreate.errors.slugTaken');
        setSlugError(message);
        setError(message);
      } else if (lower === 'invalid' || lower.includes('invalid')) {
        const message = validateSlug(form.slug, 'submit') || t('botCreate.errors.slugAllowedChars');
        setSlugError(message);
        setError(message);
      } else {
        setError(rawMessage || t('botCreate.errors.createFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <OnboardingLayout
      currentStep="bot"
      flow="assistantType"
      layout="full"
      title={t('botCreate.onboarding.title')}
      subtitle={t('botCreate.onboarding.subtitle')}
    >
      <div className="rounded-2xl bg-card border border-border p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('botCreate.onboarding.intro')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="botName">{t('botCreate.fields.name')}</Label>
            <Input
              id="botName"
              value={form.name}
              onChange={handleChange('name')}
              required
              placeholder={t('botCreate.onboarding.namePlaceholder')}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="botSlug">{t('botCreate.fields.slug')}</Label>
            <Input
              id="botSlug"
              value={form.slug}
              onChange={handleChange('slug')}
              required
              placeholder={t('botCreate.onboarding.slugPlaceholder')}
              className={`mt-1 ${slugError ? 'border-destructive focus-visible:ring-destructive/40' : ''}`}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t('botCreate.fields.slugHelp')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('botCreate.onboarding.slugRules')}
            </p>
            {slugError && (
              <p className="text-xs text-destructive mt-1">
                {slugError}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="botDescription">
              {t('botCreate.fields.description')}
            </Label>
            <Textarea
              id="botDescription"
              value={form.description}
              onChange={handleChange('description')}
              rows={2}
              placeholder={t('botCreate.onboarding.descriptionPlaceholder')}
              className="mt-1"
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || !form.name.trim() || !form.slug.trim() || !!slugError}
            >
              {isSubmitting
                ? t('botCreate.actions.creating')
                : t('botCreate.actions.create')}
            </Button>
          </div>
        </form>
      </div>
    </OnboardingLayout>
  );
};

export default OnboardingBotNew;
