import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import cosloHero from '@/assets/coslo-hero.png';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Zap,
} from 'lucide-react';

const LandingPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const botSlug = searchParams.get('bot');

  if (botSlug) return <Navigate to={`/demo/${botSlug}`} replace />;

  const painPoints = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;
  const howSteps = ['s1', 's2', 's3'] as const;
  const assistantCards = [
    {
      key: 'services',
      icon: CalendarDays,
      accent: 'primary',
      bullets: ['b1', 'b2', 'b3', 'b4', 'b5'] as const,
    },
    {
      key: 'shopify',
      icon: ShoppingBag,
      accent: 'accent',
      bullets: ['b1', 'b2', 'b3', 'b4', 'b5'] as const,
    },
  ] as const;
  const sharedItems = ['i1', 'i2', 'i3', 'i4', 'i5'] as const;
  const useCaseCards = ['c1', 'c2', 'c3', 'c4'] as const;
  const demoSteps = ['s1', 's2', 's3', 's4', 's5'] as const;
  const benefitCards = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const;
  const analyticsKpis = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'] as const;
  const pricingPlans = [
    { key: 'free', featured: false },
    { key: 'starter', featured: false },
    { key: 'growth', featured: true },
    { key: 'scale', featured: false },
  ] as const;
  const faqItems = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'] as const;

  return (
    <div className="bg-background text-foreground scroll-smooth">
      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
        <div className="absolute top-16 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-10 right-1/4 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="animate-fade-in">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                {t('landing.hero.eyebrow')}
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t('landing.hero.title')}{' '}
                <span className="gradient-text">{t('landing.hero.titleHighlight')}</span>
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                {t('landing.hero.subtitle')}
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link to="/register">
                  <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">
                    {t('landing.hero.ctaPrimary')} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/demo/example">
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                    {t('landing.hero.ctaSecondary')}
                  </Button>
                </Link>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">{t('landing.hero.note')}</p>
            </div>
            <div className="relative animate-fade-in-delay">
              <div className="absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl" />
              <div className="relative rounded-3xl border border-border bg-card/90 p-6 shadow-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-background/80 px-4 py-2 text-xs font-semibold text-foreground">
                    {t('landing.hero.visual.tabs.services')}
                  </span>
                  <span className="rounded-full border border-border bg-background/80 px-4 py-2 text-xs font-semibold text-foreground">
                    {t('landing.hero.visual.tabs.shopify')}
                  </span>
                  <div className="ml-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {t('landing.hero.visual.services.label')}
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {t('landing.hero.visual.services.user')}
                      </div>
                      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
                        {t('landing.hero.visual.services.assistant')}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {t('landing.hero.visual.services.outcome')}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {t('landing.hero.visual.shopify.label')}
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {t('landing.hero.visual.shopify.user')}
                      </div>
                      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-foreground">
                        {t('landing.hero.visual.shopify.assistant')}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                        {t('landing.hero.visual.shopify.outcome')}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/80 px-4 py-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{t('landing.hero.visual.platform.title')}</span>
                  <span className="text-muted-foreground/50">&middot; </span>
                  {(['whatsapp', 'instagram', 'messenger', 'web'] as const).map(channel => (
                    <span key={channel} className="rounded-full border border-border px-2.5 py-1">
                      {t(`landing.hero.visual.platform.channels.${channel}`)}
                    </span>
                  ))}
                  <span className="text-muted-foreground/50">&middot; </span>
                  <span>{t('landing.hero.visual.platform.handoff')}</span>
                  <span className="text-muted-foreground/50">&middot; </span>
                  <span>{t('landing.hero.visual.platform.analytics')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card/40 py-10">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              {t('landing.heroChooser.title')}
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(['services', 'shopify'] as const).map(item => (
              <a
                key={item}
                href={item === 'services' ? '#servizi' : '#shopify'}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-6 py-4 transition hover:border-primary/40"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t(`landing.heroChooser.${item}.title`)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`landing.heroChooser.${item}.subtitle`)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-primary" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              {t('landing.painPoints.title')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('landing.painPoints.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {painPoints.map(point => (
              <div key={point} className="h-full rounded-2xl border border-border bg-background/80 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Zap className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm text-foreground">{t(`landing.painPoints.items.${point}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-background py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              {t('landing.howItWorks.title')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('landing.howItWorks.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {howSteps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  {`0${index + 1}`}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {t(`landing.howItWorks.steps.${step}.title`)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`landing.howItWorks.steps.${step}.text`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Assistants */}
      <section id="assistanti" className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              {t('landing.assistants.title')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('landing.assistants.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {assistantCards.map(card => (
              <div
                key={card.key}
                id={card.key === 'services' ? 'servizi' : 'shopify'}
                className="scroll-mt-24 rounded-3xl border border-border bg-background/90 p-8 shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    card.accent === 'primary'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-accent/10 text-accent'
                  }`}>
                    <card.icon className="h-3.5 w-3.5" />
                    {t(`landing.assistants.${card.key}.tag`)}
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    card.accent === 'primary' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                  }`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-foreground">
                  {t(`landing.assistants.${card.key}.title`)}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t(`landing.assistants.${card.key}.description`)}
                </p>
                <ul className="mt-5 space-y-3">
                  {card.bullets.map(bullet => (
                    <li key={bullet} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                      {t(`landing.assistants.${card.key}.bullets.${bullet}`)}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Link
                    to="/register"
                    className={`inline-flex items-center gap-2 text-sm font-semibold ${
                      card.accent === 'primary' ? 'text-primary' : 'text-accent'
                    }`}
                  >
                    {t(`landing.assistants.${card.key}.cta`)} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shared platform */}
      <section className="bg-background py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
                {t('landing.sharedPlatform.title')}
              </h2>
              <p className="mt-4 text-muted-foreground">{t('landing.sharedPlatform.subtitle')}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {(['web', 'whatsapp', 'instagram', 'messenger'] as const).map(channel => (
                  <span key={channel} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground">
                    {t(`landing.sharedPlatform.channels.${channel}`)}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {sharedItems.map(item => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm text-foreground">{t(`landing.sharedPlatform.items.${item}`)}</p>
                </div>
              ))}
              <div className="rounded-3xl border border-border bg-card/90 p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t('landing.sharedPlatform.visual.title')}
                  </p>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {t('landing.sharedPlatform.visual.badge')}
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        {t('landing.sharedPlatform.visual.layer1.title')}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('landing.sharedPlatform.visual.layer1.text')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="flex items-center gap-3">
                      <Bot className="h-4 w-4 text-accent" />
                      <p className="text-sm font-semibold text-foreground">
                        {t('landing.sharedPlatform.visual.layer2.title')}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('landing.sharedPlatform.visual.layer2.text')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        {t('landing.sharedPlatform.visual.layer3.title')}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('landing.sharedPlatform.visual.layer3.text')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              {t('landing.useCases.title')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('landing.useCases.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {useCaseCards.map(card => (
              <div key={card} className="rounded-2xl border border-border bg-background/80 p-6">
                <h3 className="text-lg font-semibold text-foreground">{t(`landing.useCases.cards.${card}.title`)}</h3>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t('landing.useCases.labels.scenario')}
                  </p>
                  <p className="mt-2 text-foreground">{t(`landing.useCases.cards.${card}.scenario`)}</p>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t('landing.useCases.labels.outcome')}
                  </p>
                  <p className="mt-2 text-foreground">{t(`landing.useCases.cards.${card}.outcome`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo flow */}
      <section className="bg-background py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              {t('landing.demoFlow.title')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('landing.demoFlow.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="space-y-6">
                {demoSteps.map(step => (
                  <div key={step} className="flex gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
                      {t(`landing.demoFlow.steps.${step}.step`)}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {t(`landing.demoFlow.steps.${step}.title`)}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(`landing.demoFlow.steps.${step}.text`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-2xl border border-border bg-background/80 p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{t('landing.demoFlow.analytics.title')}</p>
                <p className="mt-2 text-sm text-foreground">{t('landing.demoFlow.analytics.text')}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {(['k1', 'k2'] as const).map(kpi => (
                    <div key={kpi} className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs text-muted-foreground">{t(`landing.demoFlow.analytics.${kpi}.label`)}</p>
                      <p className="text-base font-semibold text-foreground">{t(`landing.demoFlow.analytics.${kpi}.value`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <img src={cosloHero} alt={t('landing.demoFlow.visual.alt')} className="h-12 w-12 rounded-full bg-background p-1" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('brand')}</p>
                    <p className="text-xs text-muted-foreground">{t('landing.demoFlow.visual.subtitle')}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="ml-auto w-4/5 rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
                    {t('landing.demoFlow.visual.userMessage')}
                  </div>
                  <div className="w-4/5 rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-foreground">
                    {t('landing.demoFlow.visual.botMessage')}
                  </div>
                  <div className="ml-auto w-3/5 rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
                    {t('landing.demoFlow.visual.userMessageTwo')}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('landing.demoFlow.result.title')}</p>
                    <p className="text-xs text-muted-foreground">{t('landing.demoFlow.result.subtitle')}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3 text-sm text-foreground">
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-3 py-2">
                    <span>{t('landing.demoFlow.result.line1')}</span>
                    <span className="font-semibold text-primary">{t('landing.demoFlow.result.line1Value')}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background/70 px-3 py-2">
                    <span>{t('landing.demoFlow.result.line2')}</span>
                    <span className="font-semibold text-accent">{t('landing.demoFlow.result.line2Value')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              {t('landing.benefits.title')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('landing.benefits.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {benefitCards.map(card => (
              <div key={card} className="rounded-2xl border border-border bg-background/80 p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{t(`landing.benefits.cards.${card}.title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`landing.benefits.cards.${card}.text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Analytics */}
      <section className="bg-background py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              {t('landing.analytics.title')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('landing.analytics.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analyticsKpis.map(kpi => (
              <div key={kpi} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{t(`landing.analytics.kpis.${kpi}`)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">{t('landing.analytics.note')}</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground lg:text-4xl">
              {t('landing.pricing.title')}
            </h2>
            <p className="mt-4 text-muted-foreground">{t('landing.pricing.subtitle')}</p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-4">
            {pricingPlans.map(plan => (
              <div
                key={plan.key}
                className={`rounded-3xl border bg-background/90 p-6 shadow-sm ${
                  plan.featured ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{t(`landing.pricing.plans.${plan.key}.name`)}</h3>
                  {plan.featured ? (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      {t('landing.pricing.plans.growth.badge')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{t(`landing.pricing.plans.${plan.key}.description`)}</p>
                <div className="mt-6 flex items-end gap-2">
                  <span className="text-3xl font-bold text-foreground">{t(`landing.pricing.plans.${plan.key}.price`)}</span>
                  <span className="text-sm text-muted-foreground">{t(`landing.pricing.plans.${plan.key}.period`)}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {(['f1', 'f2', 'f3', 'f4'] as const).map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                      {t(`landing.pricing.plans.${plan.key}.features.${feature}`)}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="mt-6 block">
                  <Button
                    size="lg"
                    className={`h-11 w-full text-base ${plan.featured ? '' : 'bg-primary/90'}`}
                  >
                    {t(`landing.pricing.plans.${plan.key}.cta`)}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <div className="rounded-2xl border border-border bg-background/80 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{t('landing.pricing.helper.title')}</h3>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {t('landing.pricing.helper.badge')}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{t('landing.pricing.helper.text')}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {(['i1', 'i2', 'i3'] as const).map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{t(`landing.pricing.helper.items.${item}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                {t('landing.pricing.helper.note')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-background py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-center font-display text-3xl font-bold text-foreground lg:text-4xl">
            {t('landing.faq.title')}
          </h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {faqItems.map(item => (
              <div key={item} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-base font-semibold text-foreground">{t(`landing.faq.items.${item}.q`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`landing.faq.items.${item}.a`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-primary py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent/80" />
        <div className="relative container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-primary-foreground lg:text-4xl">
            {t('landing.finalCta.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
            {t('landing.finalCta.subtitle')}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="h-12 px-8 text-base font-semibold">
                {t('landing.finalCta.primary')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/demo/example">
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-primary-foreground/40 px-8 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10"
              >
                {t('landing.finalCta.secondary')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4 sm:hidden">
        <div className="rounded-2xl border border-border bg-card/90 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <Link to="/register" className="flex-1">
              <Button size="lg" className="h-11 w-full text-base">
                {t('landing.finalCta.primary')}
              </Button>
            </Link>
            <Link to="/demo/example" className="flex-1">
              <Button size="lg" variant="outline" className="h-11 w-full text-base">
                {t('landing.finalCta.secondary')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-foreground py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
            <div>
              <div className="flex items-center gap-2 font-display text-lg font-bold text-background">
                <Bot className="h-5 w-5" />
                {t('brand')}
              </div>
              <p className="mt-2 max-w-xs text-sm text-background/70">{t('landing.footer.description')}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-background/50">
                {t('landing.footer.legal')}
              </h4>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    to="/policy"
                    className="text-sm text-background/70 transition-colors hover:text-background"
                  >
                    {t('landing.footer.privacy')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="text-sm text-background/70 transition-colors hover:text-background"
                  >
                    {t('landing.footer.terms')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-background/10 pt-6 text-center">
            <p className="text-sm text-background/50">
              {t('landing.footer.copyright', { year: new Date().getFullYear() })}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
