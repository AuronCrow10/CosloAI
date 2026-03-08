import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Plus, Globe, MessageCircle, Phone, Instagram, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, deleteBot, fetchBots } from "@/api/bots";

const channelIcons: Record<string, React.ElementType> = {
  web: Globe,
  whatsapp: Phone,
  messenger: MessageCircle,
  instagram: Instagram,
};

const statusClasses: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success",
  DRAFT: "bg-warning/10 text-warning",
  PENDING_PAYMENT: "bg-warning/10 text-warning",
  SUSPENDED: "bg-muted text-muted-foreground",
  CANCELED: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "bots.statusActive",
  DRAFT: "bots.statusDraft",
  PENDING_PAYMENT: "bots.statusPendingPayment",
  SUSPENDED: "bots.statusSuspended",
  CANCELED: "bots.statusCanceled",
};

const Bots = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isTeamMember = user?.role === "TEAM_MEMBER";

  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchBots()
      .then((data) => setBots(data))
      .catch((err: any) => {
        console.error(err);
        setError(err?.message || t("botsList.errors.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  const channelList = (bot: Bot) =>
    [
      bot.channelWeb && t("botsList.channels.web"),
      bot.channelWhatsapp && t("botsList.channels.whatsapp"),
      bot.channelMessenger && t("botsList.channels.messenger"),
      bot.channelInstagram && t("botsList.channels.instagram"),
    ]
      .filter(Boolean)
      .join(", ");

  const botChannels = (bot: Bot) => ({
    web: bot.channelWeb,
    whatsapp: bot.channelWhatsapp,
    messenger: bot.channelMessenger,
    instagram: bot.channelInstagram,
  });

  const handleDeleteBot = async (bot: Bot) => {
    const slugInput = window.prompt(
      t("botsList.confirm.typeSlug", { slug: bot.slug })
    );
    if (!slugInput) return;

    if (slugInput !== bot.slug) {
      window.alert(t("botsList.confirm.slugMismatch"));
      return;
    }

    const ok = window.confirm(
      t("botsList.confirm.deleteBot", { name: bot.name })
    );
    if (!ok) return;

    try {
      await deleteBot(bot.id, bot.slug);
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botsList.errors.deleteFailed"));
    }
  };

  const sortedBots = useMemo(
    () => [...bots].sort((a, b) => a.name.localeCompare(b.name)),
    [bots]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t("botsList.title")}
        </h1>
        {!isTeamMember && (
          <Link to="/onboarding/bots/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("botsList.actions.create")}
            </Button>
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t("botsList.loading")}</p>}
      {!loading && error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {!loading && !error && sortedBots.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("botsList.empty")}</p>
      )}

      {!loading && !error && sortedBots.length > 0 && (
        <>
          <div className="hidden md:block rounded-2xl bg-card border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("botsList.table.name")}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("botsList.table.slug")}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("botsList.table.status")}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("botsList.table.domain")}
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("botsList.table.channels")}
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("botsList.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedBots.map((bot) => {
                  const channels = botChannels(bot);
                  const statusKey = statusLabels[bot.status] || "bots.statusActive";
                  return (
                    <tr
                      key={bot.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-foreground">{bot.name}</p>
                          {bot.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {bot.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {bot.slug}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex px-2.5 py-1 rounded-full text-xs font-medium",
                            statusClasses[bot.status] || "bg-muted text-muted-foreground"
                          )}
                        >
                          {t(statusKey)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {bot.domain || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {channelList(bot) || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={
                              isTeamMember
                                ? `/app/bots/${bot.id}/conversations`
                                : `/app/bots/${bot.id}`
                            }
                          >
                            <Button size="sm" variant="outline">
                              {t("botsList.actions.openBot")}
                            </Button>
                          </Link>
                          {!isTeamMember && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteBot(bot)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("botsList.actions.deleteBot")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {sortedBots.map((bot) => {
              const channels = botChannels(bot);
              const statusKey = statusLabels[bot.status] || "bots.statusActive";
              return (
                <div
                  key={bot.id}
                  className="rounded-2xl bg-card border border-border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{bot.name}</p>
                      <p className="text-xs text-muted-foreground">{bot.slug}</p>
                    </div>
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium",
                        statusClasses[bot.status] || "bg-muted text-muted-foreground"
                      )}
                    >
                      {t(statusKey)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("botsList.table.domain")}: {bot.domain || "-"}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {Object.entries(channels).map(([key, enabled]) => {
                      if (!enabled) return null;
                      const Icon = channelIcons[key] || Globe;
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {t(`botsList.channels.${key}`)}
                        </span>
                      );
                    })}
                    {!channels.web &&
                      !channels.whatsapp &&
                      !channels.messenger &&
                      !channels.instagram && (
                        <span className="text-muted-foreground">-</span>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={
                        isTeamMember
                          ? `/app/bots/${bot.id}/conversations`
                          : `/app/bots/${bot.id}`
                      }
                      className="flex-1"
                    >
                      <Button className="w-full" variant="outline" size="sm">
                        {t("botsList.actions.openBot")}
                      </Button>
                    </Link>
                    {!isTeamMember && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteBot(bot)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Bots;
