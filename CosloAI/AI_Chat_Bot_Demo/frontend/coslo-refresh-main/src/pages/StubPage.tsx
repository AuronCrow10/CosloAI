import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

interface StubPageProps {
  title: string;
  fullScreen?: boolean;
}

const StubPage = ({ title, fullScreen }: StubPageProps) => {
  const { t } = useTranslation();

  const content = (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center animate-fade-in">
      <Construction className="h-12 w-12 text-muted-foreground/50" />
      <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground max-w-md">{t('common.comingSoon')}</p>
    </div>
  );

  if (fullScreen) {
    return <div className="min-h-screen flex items-center justify-center bg-background">{content}</div>;
  }

  return content;
};

export default StubPage;
