import { Trans, useTranslation } from 'react-i18next';

const LAST_UPDATED = '2026-01-26';
const PROVIDER_NAME = 'Andrei Cosmin Marica';
const PROVIDER_ADDRESS = 'Via Petrazzo 18, Messina (ME), 98142, Italia';
const SUPPORT_EMAIL = 'assistenza@coslo.it';
const PROVIDER_IVA = 'IT03858840832';

type SectionKey =
  | 'provider'
  | 'definitions'
  | 'scope'
  | 'shopifyApp'
  | 'account'
  | 'plansPayments'
  | 'permittedUseCompliance'
  | 'privacyMultiTenant'
  | 'aiLimitations'
  | 'thirdParties'
  | 'availabilitySupport'
  | 'ip'
  | 'termination'
  | 'warranty'
  | 'liability'
  | 'indemnity'
  | 'changes'
  | 'lawForum'
  | 'contacts';

const Terms = () => {
  const { t } = useTranslation();

  const sections: SectionKey[] = [
    'provider',
    'definitions',
    'scope',
    'shopifyApp',
    'account',
    'plansPayments',
    'permittedUseCompliance',
    'privacyMultiTenant',
    'aiLimitations',
    'thirdParties',
    'availabilitySupport',
    'ip',
    'termination',
    'warranty',
    'liability',
    'indemnity',
    'changes',
    'lawForum',
    'contacts',
  ];

  const renderList = (key: string) => {
    const items = t(key, { returnObjects: true }) as unknown;
    if (!Array.isArray(items)) return null;

    return (
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
        {items.map((txt, idx) => (
          <li key={idx}>{String(txt)}</li>
        ))}
      </ul>
    );
  };

  const renderParagraphs = (sectionKey: SectionKey) => {
    const base = `terms.sections.${sectionKey}`;
    const paragraphs = t(`${base}.paragraphs`, { returnObjects: true }) as unknown;

    if (!Array.isArray(paragraphs)) return null;

    const useTrans = t(`${base}.useTrans`, { defaultValue: 'false' }) === 'true';

    return paragraphs.map((_, idx) => {
      const pKey = `${base}.paragraphs.${idx}`;

      if (!useTrans) {
        return (
          <p key={idx} className="text-sm text-muted-foreground leading-relaxed mb-3">
            {t(pKey)}
          </p>
        );
      }

      return (
        <p key={idx} className="text-sm text-muted-foreground leading-relaxed mb-3">
          <Trans
            i18nKey={pKey}
            values={{
              lastUpdated: LAST_UPDATED,
              providerName: PROVIDER_NAME,
              providerAddress: PROVIDER_ADDRESS,
              email: SUPPORT_EMAIL,
            }}
            components={{
              a: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline" />,
              strong: <strong className="text-foreground" />,
            }}
          />
        </p>
      );
    });
  };

  return (
    <div className="bg-background">
      <section className="relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="relative container mx-auto px-4 max-w-4xl">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              {t('terms.hero.kicker')}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('terms.hero.title')}
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t('terms.hero.intro')}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t('terms.hero.lastUpdatedLabel')}:
              </span>{' '}
              {LAST_UPDATED}
            </p>
          </div>

          <div className="space-y-10">
            {sections.map(k => (
              <section key={k} className="rounded-2xl border border-border bg-card/60 p-6">
                <h2 className="font-display text-lg font-semibold text-foreground mb-3">
                  {t(`terms.sections.${k}.title`)}
                </h2>

                {k === 'provider' ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">{t('terms.sections.provider.labels.provider')}:</strong>{' '}
                    {PROVIDER_NAME + (' (P.IVA: ' + PROVIDER_IVA + ')')}
                    <br />
                    <strong className="text-foreground">{t('terms.sections.provider.labels.address')}:</strong>{' '}
                    {PROVIDER_ADDRESS}
                    <br />
                    <strong className="text-foreground">{t('terms.sections.provider.labels.contact')}:</strong>{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                      {SUPPORT_EMAIL}
                    </a>
                  </p>
                ) : (
                  renderParagraphs(k)
                )}

                {renderList(`terms.sections.${k}.list`)}
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Terms;
