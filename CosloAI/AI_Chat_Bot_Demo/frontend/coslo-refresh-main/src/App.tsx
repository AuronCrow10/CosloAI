import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import PublicLayout from "@/layouts/PublicLayout";
import AppLayout from "@/layouts/AppLayout";
import { RequireAuth, RequireRole } from "@/components/RequireAuth";
import LandingPage from "@/pages/LandingPage";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import Policy from "@/pages/Policy";
import Terms from "@/pages/Terms";
import DemoChat from "@/pages/DemoChat";
import WidgetChat from "@/pages/WidgetChat";
import Dashboard from "@/pages/app/Dashboard";
import DashboardHealth from "@/pages/app/DashboardHealth";
import DashboardConversion from "@/pages/app/DashboardConversion";
import Bots from "@/pages/app/Bots";
import BotNew from "@/pages/app/BotNew";
import BotDetail from "@/pages/app/BotDetail";
import BotChannels from "@/pages/app/BotChannels";
import BotConversations from "@/pages/app/BotConversations";
import BotKnowledge from "@/pages/app/BotKnowledge";
import BotKnowledgeJob from "@/pages/app/BotKnowledgeJob";
import BotFeatures from "@/pages/app/BotFeatures";
import BotPlan from "@/pages/app/BotPlan";
import BotShopify from "@/pages/app/BotShopify";
import BotRevenueAI from "@/pages/app/BotRevenueAI";
import BotSettings from "@/pages/app/BotSettings";
import BotWhatsappTemplates from "@/pages/app/BotWhatsappTemplates";
import Billing from "@/pages/app/Billing";
import Account from "@/pages/app/Account";
import ConversationDetail from "@/pages/app/ConversationDetail";
import Referrals from "@/pages/app/Referrals";
import AdminUsers from "@/pages/app/admin/AdminUsers";
import AdminBots from "@/pages/app/admin/AdminBots";
import AdminBookings from "@/pages/app/admin/AdminBookings";
import AdminEmails from "@/pages/app/admin/AdminEmails";
import AdminPayments from "@/pages/app/admin/AdminPayments";
import AdminOpenAIUsage from "@/pages/app/admin/AdminOpenAIUsage";
import AdminIntegrations from "@/pages/app/admin/AdminIntegrations";
import AdminPlans from "@/pages/app/admin/AdminPlans";
import AdminReferrals from "@/pages/app/admin/AdminReferrals";
import AdminPartnerDetail from "@/pages/app/admin/AdminPartnerDetail";
import AdminConversations from "@/pages/app/admin/AdminConversations";
import OnboardingBotNew from "@/pages/onboarding/OnboardingBotNew";
import OnboardingAssistantType from "@/pages/onboarding/OnboardingAssistantType";
import OnboardingShopify from "@/pages/onboarding/OnboardingShopify";
import OnboardingChannels from "@/pages/onboarding/OnboardingChannels";
import OnboardingBooking from "@/pages/onboarding/OnboardingBooking";
import OnboardingLeadAds from "@/pages/onboarding/OnboardingLeadAds";
import OnboardingPlan from "@/pages/onboarding/OnboardingPlan";
import OnboardingKnowledge from "@/pages/onboarding/OnboardingKnowledge";
import OnboardingComplete from "@/pages/onboarding/OnboardingComplete";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/policy" element={<Policy />} />
              <Route path="/terms" element={<Terms />} />
            </Route>

            <Route path="/demo/:slug" element={<DemoChat />} />
            <Route path="/widget/:slug" element={<WidgetChat />} />

            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/app/dashboard" element={<Dashboard />} />
              <Route path="/app/dashboard/health" element={<DashboardHealth />} />
              <Route path="/app/dashboard/conversion" element={<DashboardConversion />} />
              <Route path="/app/bots" element={<Bots />} />
              <Route path="/app/bots/new" element={<BotNew />} />
              <Route path="/app/bots/:id" element={<BotDetail />} />
              <Route path="/app/bots/:id/channels" element={<BotChannels />} />
              <Route path="/app/bots/:id/conversations" element={<BotConversations />} />
              <Route path="/app/bots/:id/knowledge" element={<BotKnowledge />} />
              <Route path="/app/bots/:id/knowledge/jobs/:jobId" element={<BotKnowledgeJob />} />
              <Route path="/app/bots/:id/features" element={<BotFeatures />} />
              <Route path="/app/bots/:id/plan" element={<BotPlan />} />
              <Route path="/app/bots/:id/shopify" element={<BotShopify />} />
              <Route path="/app/bots/:id/revenue-ai" element={<BotRevenueAI />} />
              <Route path="/app/bots/:id/settings" element={<BotSettings />} />
              <Route path="/app/bots/:id/whatsapp-templates" element={<BotWhatsappTemplates />} />
              <Route path="/app/billing" element={<Billing />} />
              <Route path="/app/account" element={<Account />} />
              <Route path="/app/conversations/:id" element={<ConversationDetail />} />
              <Route path="/app/referrals" element={<RequireRole roles={['ADMIN', 'REFERRER']}><Referrals /></RequireRole>} />
              <Route path="/app/admin/users" element={<RequireRole roles={['ADMIN']}><AdminUsers /></RequireRole>} />
              <Route path="/app/admin/referrals" element={<RequireRole roles={['ADMIN']}><AdminReferrals /></RequireRole>} />
              <Route path="/app/admin/referrals/partners/:id" element={<RequireRole roles={['ADMIN']}><AdminPartnerDetail /></RequireRole>} />
              <Route path="/app/admin/bots" element={<RequireRole roles={['ADMIN']}><AdminBots /></RequireRole>} />
              <Route path="/app/admin/bookings" element={<RequireRole roles={['ADMIN']}><AdminBookings /></RequireRole>} />
              <Route path="/app/admin/emails" element={<RequireRole roles={['ADMIN']}><AdminEmails /></RequireRole>} />
              <Route path="/app/admin/payments" element={<RequireRole roles={['ADMIN']}><AdminPayments /></RequireRole>} />
              <Route path="/app/admin/openai-usage" element={<RequireRole roles={['ADMIN']}><AdminOpenAIUsage /></RequireRole>} />
              <Route path="/app/admin/integrations" element={<RequireRole roles={['ADMIN']}><AdminIntegrations /></RequireRole>} />
              <Route path="/app/admin/plans" element={<RequireRole roles={['ADMIN']}><AdminPlans /></RequireRole>} />
              <Route path="/app/admin/conversations" element={<RequireRole roles={['ADMIN']}><AdminConversations /></RequireRole>} />
            </Route>

            <Route element={<RequireAuth><PublicLayout /></RequireAuth>}>
              <Route path="/onboarding/bots/new" element={<OnboardingBotNew />} />
              <Route path="/onboarding/bots/:id/type" element={<OnboardingAssistantType />} />
              <Route path="/onboarding/bots/:id/shopify" element={<OnboardingShopify />} />
              <Route path="/onboarding/bots/:id/channels" element={<OnboardingChannels />} />
              <Route path="/onboarding/bots/:id/booking" element={<OnboardingBooking />} />
              <Route path="/onboarding/bots/:id/lead-ads" element={<OnboardingLeadAds />} />
              <Route path="/onboarding/bots/:id/plan" element={<OnboardingPlan />} />
              <Route path="/onboarding/bots/:id/knowledge" element={<OnboardingKnowledge />} />
              <Route path="/onboarding/bots/:id/complete" element={<OnboardingComplete />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
