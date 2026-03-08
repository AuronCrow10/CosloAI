import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface OnboardingStepperProps {
  steps: { label: string; path: string }[];
  botId?: string;
}

const OnboardingStepper = ({ steps, botId }: OnboardingStepperProps) => {
  const location = useLocation();
  const currentIdx = steps.findIndex(s => {
    const path = s.path.replace(':id', botId || '');
    return location.pathname.includes(path.split('/').pop() || '');
  });

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.label} className="flex items-center gap-2">
            <div className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
              done ? 'bg-success text-success-foreground' :
              active ? 'bg-primary text-primary-foreground' :
              'bg-muted text-muted-foreground'
            )}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn('text-sm hidden sm:block', active ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {step.label}
            </span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
};

export default OnboardingStepper;
