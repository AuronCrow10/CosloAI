import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bot, ArrowRight } from "lucide-react";
import { createBot, CreateBotPayload, Bot as BotType } from "@/api/bots";

const BotNew = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: CreateBotPayload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
      };
      const bot: BotType = await createBot(payload);
      navigate(`/app/bots/${bot.id}/features`);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || t("botCreate.errors.createFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t("botCreate.title")}
        </h1>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-2xl bg-card border border-border p-6 space-y-5"
      >
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{t("botCreate.subtitle")}</p>
        <div>
          <Label htmlFor="name">{t("botCreate.fields.name")}</Label>
          <Input
            id="name"
            value={form.name}
            onChange={handleChange("name")}
            placeholder={t("botCreate.fields.namePlaceholder")}
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="slug">{t("botCreate.fields.slug")}</Label>
          <Input
            id="slug"
            value={form.slug}
            onChange={handleChange("slug")}
            placeholder={t("botCreate.fields.slugPlaceholder")}
            required
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("botCreate.fields.slugHelp")}
          </p>
        </div>
        <div>
          <Label htmlFor="desc">{t("botCreate.fields.description")}</Label>
          <Textarea
            id="desc"
            value={form.description}
            onChange={handleChange("description")}
            placeholder={t("botCreate.fields.descriptionPlaceholder")}
            className="mt-1"
            rows={3}
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !form.name.trim() || !form.slug.trim()}
        >
          {loading ? t("botCreate.actions.creating") : t("botCreate.actions.create")}{" "}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default BotNew;
