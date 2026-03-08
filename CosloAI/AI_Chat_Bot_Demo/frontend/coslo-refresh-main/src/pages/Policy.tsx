import { Trans, useTranslation } from 'react-i18next';

const LAST_UPDATED = '2026-01-26';
const PROVIDER_NAME = 'Andrei Cosmin Marica';
const PROVIDER_ADDRESS = 'Via Petrazzo 18, Messina (ME), 98142, Italia';
const CONTACT_EMAIL = 'assistenza@coslo.it';
const PROVIDER_IVA = 'IT03858840832';

type SectionKey =
  | 'whoWeAre'
  | 'appliesTo'
  | 'dataWeProcess'
  | 'howWeUse'
  | 'shopifyData'
  | 'aiProcessing'
  | 'tenantSeparation'
  | 'messagingChannels'
  | 'automationEscalation'
  | 'googleCalendar'
  | 'thirdParties'
  | 'retention'
  | 'deletion'
  | 'security'
  | 'transfers'
  | 'children'
  | 'rights'
  | 'changes'
  | 'questions';

const Policy = () => {
  const { t } = useTranslation();

  const sections: SectionKey[] = [
    'whoWeAre',
    'appliesTo',
    'dataWeProcess',
    'howWeUse',
    'shopifyData',
    'aiProcessing',
    'tenantSeparation',
    'messagingChannels',
    'automationEscalation',
    'googleCalendar',
    'thirdParties',
    'retention',
    'deletion',
    'security',
    'transfers',
    'children',
    'rights',
    'changes',
    'questions',
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

  return (
    <div className="bg-background">
      <section className="relative overflow-hidden py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="relative container mx-auto px-4 max-w-4xl">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
              {t('policy.hero.kicker')}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('policy.hero.title')}
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t('policy.hero.intro')}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t('policy.hero.lastUpdatedLabel')}:
              </span>{' '}
              {LAST_UPDATED}
            </p>
          </div>

          <div className="space-y-10">
            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                {t('policy.sections.whoWeAre.title')}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">{t('policy.sections.whoWeAre.serviceLabel')}:</strong>{' '}
                {t('policy.sections.whoWeAre.serviceValue')}
                <br />
                <strong className="text-foreground">{t('policy.sections.whoWeAre.providerLabel')}:</strong>{' '}
                {PROVIDER_NAME + (' (P.IVA: ' + PROVIDER_IVA + ')')}
                <br />
                <strong className="text-foreground">{t('policy.sections.whoWeAre.addressLabel')}:</strong>{' '}
                {PROVIDER_ADDRESS}
                <br />
                <strong className="text-foreground">{t('policy.sections.whoWeAre.emailLabel')}:</strong>{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </section>

            {sections.filter(k => k !== 'whoWeAre').map(k => (
              <section key={k} className="rounded-2xl border border-border bg-background/70 p-6">
                <h2 className="font-display text-lg font-semibold text-foreground mb-3">
                  {t(`policy.sections.${k}.title`)}
                </h2>

                {(() => {
                  const paragraphs = t(`policy.sections.${k}.paragraphs`, {
                    returnObjects: true,
                  }) as unknown;

                  if (!Array.isArray(paragraphs)) return null;

                  return paragraphs.map((_, idx) => {
                    const transKey = `policy.sections.${k}.paragraphs.${idx}`;
                    const needsTrans =
                      t(`policy.sections.${k}.useTrans`, { defaultValue: 'false' }) === 'true';

                    if (!needsTrans) {
                      return (
                        <p key={idx} className="text-sm text-muted-foreground leading-relaxed mb-3">
                          {t(transKey)}
                        </p>
                      );
                    }

                    return (
                      <p key={idx} className="text-sm text-muted-foreground leading-relaxed mb-3">
                        <Trans
                          i18nKey={transKey}
                          values={{ email: CONTACT_EMAIL }}
                          components={{
                            a: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline" />,
                            strong: <strong className="text-foreground" />,
                          }}
                        />
                      </p>
                    );
                  });
                })()}

                {renderList(`policy.sections.${k}.list`)}
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Policy;
