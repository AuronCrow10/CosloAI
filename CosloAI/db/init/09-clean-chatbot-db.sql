\connect chatbot

-- =========================
-- REFERRALS
-- =========================
DELETE FROM "ReferralClick";
DELETE FROM "ReferralCommission";
DELETE FROM "ReferralAttribution";
DELETE FROM "ReferralPayoutPeriod";
DELETE FROM "ReferralCode";
DELETE FROM "ReferralPartner";

-- =========================
-- BOOKING / EMAIL USAGE / META LEADS
-- =========================
DELETE FROM "BookingService";
DELETE FROM "Booking";
DELETE FROM "EmailUsage";
DELETE FROM "MetaLeadAutomation";
DELETE FROM "MetaLead";

-- =========================
-- CONVERSATIONS & MESSAGES
-- =========================
DELETE FROM "Message";
DELETE FROM "ConversationEval";
DELETE FROM "Conversation";

-- =========================
-- BOT-RELATED SESSIONS / CHANNELS / USAGE / PAYMENTS / SUBSCRIPTIONS
-- =========================
DELETE FROM "BotChannel";
DELETE FROM "MetaConnectSession";
DELETE FROM "WhatsappConnectSession";
DELETE FROM "GoogleCalendarConnectSession";
DELETE FROM "GoogleCalendarConnection";
DELETE FROM "OpenAIUsage";
DELETE FROM "PlanUsageAlert";
DELETE FROM "Payment";
DELETE FROM "Subscription";

-- =========================
-- USER TOKENS / MFA
-- =========================
DELETE FROM "MfaBackupCode";
DELETE FROM "RefreshToken";
DELETE FROM "EmailVerificationToken";
DELETE FROM "PasswordResetToken";
DELETE FROM "MobileDevice";

-- =========================
-- SHOPIFY
-- =========================
DO $$
BEGIN
  IF to_regclass('public."ShopifyVariant"') IS NOT NULL THEN
    EXECUTE 'DELETE FROM "ShopifyVariant"';
  END IF;
  IF to_regclass('public."ShopifyProduct"') IS NOT NULL THEN
    EXECUTE 'DELETE FROM "ShopifyProduct"';
  END IF;
  IF to_regclass('public."ShopifyPolicy"') IS NOT NULL THEN
    EXECUTE 'DELETE FROM "ShopifyPolicy"';
  END IF;
  IF to_regclass('public."ShopifyDataEvent"') IS NOT NULL THEN
    EXECUTE 'DELETE FROM "ShopifyDataEvent"';
  END IF;
  IF to_regclass('public."ShopifyShop"') IS NOT NULL THEN
    EXECUTE 'DELETE FROM "ShopifyShop"';
  END IF;
END $$;

-- =========================
-- MAIN ENTITIES
-- =========================
DELETE FROM "Bot";
DELETE FROM "UsagePlan";
DELETE FROM "FeaturePrice";
DELETE FROM "User";
