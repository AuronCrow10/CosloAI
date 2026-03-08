import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import {
  LayoutDashboard, Bot, CreditCard, User, LogOut, Menu, X,
  Users, Calendar, Mail, DollarSign, Cpu, Plug, Package, Share2, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles?: string[];
  adminOnly?: boolean;
}

const mainNav: NavItem[] = [
  { label: 'sidebar.dashboard', icon: LayoutDashboard, path: '/app/dashboard' },
  { label: 'sidebar.bots', icon: Bot, path: '/app/bots' },
  { label: 'sidebar.billing', icon: CreditCard, path: '/app/billing' },
  { label: 'sidebar.referrals', icon: Share2, path: '/app/referrals', roles: ['ADMIN', 'REFERRER'] },
];

const adminNav: NavItem[] = [
  { label: 'sidebar.users', icon: Users, path: '/app/admin/users' },
  { label: 'sidebar.bots', icon: Bot, path: '/app/admin/bots' },
  { label: 'sidebar.conversations', icon: MessageSquare, path: '/app/admin/conversations' },
  { label: 'sidebar.bookings', icon: Calendar, path: '/app/admin/bookings' },
  { label: 'sidebar.emails', icon: Mail, path: '/app/admin/emails' },
  { label: 'sidebar.payments', icon: DollarSign, path: '/app/admin/payments' },
  { label: 'sidebar.openai', icon: Cpu, path: '/app/admin/openai-usage' },
  { label: 'sidebar.integrations', icon: Plug, path: '/app/admin/integrations' },
  { label: 'sidebar.plans', icon: Package, path: '/app/admin/plans' },
  { label: 'sidebar.referrals', icon: Share2, path: '/app/admin/referrals' },
];

const teamMemberPaths = ['/app/bots'];

const AppLayout = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const filteredMain = mainNav.filter(item => {
    if (user?.role === 'TEAM_MEMBER') return teamMemberPaths.some(p => item.path.startsWith(p));
    if (item.roles) return item.roles.includes(user?.role || '');
    return true;
  });

  const showAdmin = user?.role === 'ADMIN';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <Link to="/app" className="flex items-center gap-2 font-display text-lg font-bold text-sidebar-foreground">
          <Bot className="h-5 w-5 text-sidebar-primary" />
          {t('brand')}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredMain.map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(item.path)
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {t(item.label)}
          </Link>
        ))}

        {showAdmin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {t('sidebar.admin')}
              </span>
            </div>
            {adminNav.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.path)
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {t(item.label)}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link
          to="/app/account"
          onClick={() => setSidebarOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive('/app/account')
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <User className="h-4 w-4" />
          {t('sidebar.account')}
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-accent/50 transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border shrink-0 fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border h-14 flex items-center px-4 gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <span className="hidden sm:block text-sm font-medium text-foreground">{user?.name}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
