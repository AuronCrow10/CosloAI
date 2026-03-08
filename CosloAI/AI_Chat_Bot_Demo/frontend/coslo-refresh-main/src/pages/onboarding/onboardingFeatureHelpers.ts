// src/pages/onboarding/onboardingFeatureHelpers.ts
import {
  BotChannel,
  ChannelType,
  UpdateBotPayload
} from "@/api/bots";

export const ALWAYS_ON_FEATURES: Pick<
  UpdateBotPayload,
  | "channelWeb"
  | "leadWhatsappMessages200"
  | "leadWhatsappMessages500"
  | "leadWhatsappMessages1000"
> = {
  channelWeb: true,
  leadWhatsappMessages200: true,
  leadWhatsappMessages500: false,
  leadWhatsappMessages1000: false
};

export function mapChannelsToFeatureFlags(
  channels: BotChannel[]
): Pick<
  UpdateBotPayload,
  "channelWhatsapp" | "channelMessenger" | "channelInstagram"
> {
  const has = (type: ChannelType) =>
    channels.some((c) => c.type === type);
  return {
    channelWhatsapp: has("WHATSAPP"),
    channelMessenger: has("FACEBOOK"),
    channelInstagram: has("INSTAGRAM")
  };
}

export type LeadTier = "none" | "200" | "500" | "1000";

export function mapLeadTierToFeatureFlags(
  tier: LeadTier
): Pick<
  UpdateBotPayload,
  | "leadWhatsappMessages200"
  | "leadWhatsappMessages500"
  | "leadWhatsappMessages1000"
> {
  return {
    leadWhatsappMessages200: tier === "200",
    leadWhatsappMessages500: tier === "500",
    leadWhatsappMessages1000: tier === "1000"
  };
}
