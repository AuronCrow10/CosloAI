import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BotKnowledge from "@/pages/app/BotKnowledge";
import * as botsApi from "@/api/bots";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock("@/api/bots", async () => {
  const actual = await vi.importActual<typeof import("@/api/bots")>("@/api/bots");
  return {
    ...actual,
    getBotById: vi.fn(),
    updateBot: vi.fn(),
    crawlBotDomain: vi.fn(),
    getBotCrawlEstimateStatus: vi.fn(),
    uploadBotDocuments: vi.fn(),
    getBotCrawlStatus: vi.fn(),
    estimateBotDocuments: vi.fn(),
    getBotCrawlHistory: vi.fn(),
    deactivateBotKnowledgeJob: vi.fn()
  };
});

const baseBot = {
  id: "bot-1",
  userId: "user-1",
  slug: "test-bot",
  name: "Test Bot",
  systemPrompt: "prompt",
  knowledgeSource: "RAG",
  knowledgeClientId: "client-1",
  domain: "https://example.com",
  useDomainCrawler: true,
  usePdfCrawler: true,
  channelWeb: true,
  channelWhatsapp: false,
  channelInstagram: false,
  channelMessenger: false,
  useCalendar: false,
  status: "ACTIVE",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  autoEvaluateConversations: false,
  leadWhatsappMessages200: false,
  leadWhatsappMessages500: false,
  leadWhatsappMessages1000: false
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(botsApi.getBotCrawlHistory).mockResolvedValue({
    page: 1,
    totalPages: 1,
    totalItems: 0,
    jobs: []
  } as any);
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/bots/bot-1/knowledge"]}>
      <Routes>
        <Route path="/app/bots/:id/knowledge" element={<BotKnowledge />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BotKnowledge retrieval profile", () => {
  it("defaults to balanced when missing", async () => {
    vi.mocked(botsApi.getBotById).mockResolvedValue({
      ...baseBot,
      knowledgeRetrievalProfile: undefined
    } as any);

    renderPage();

    const select = await screen.findByLabelText(
      "botKnowledge.fields.retrievalProfile"
    );
    expect(select).toHaveValue("balanced");
  });

  it("saves selected profile", async () => {
    vi.mocked(botsApi.getBotById).mockResolvedValue({
      ...baseBot,
      knowledgeRetrievalProfile: "balanced"
    } as any);
    vi.mocked(botsApi.updateBot).mockResolvedValue({
      ...baseBot,
      knowledgeRetrievalProfile: "precise"
    } as any);

    renderPage();

    const select = await screen.findByLabelText(
      "botKnowledge.fields.retrievalProfile"
    );
    fireEvent.change(select, { target: { value: "precise" } });

    fireEvent.click(
      screen.getByRole("button", {
        name: "botKnowledge.actions.saveKnowledgeSettings"
      })
    );

    await waitFor(() => {
      expect(botsApi.updateBot).toHaveBeenCalled();
    });

    const [, payload] = vi.mocked(botsApi.updateBot).mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({
        knowledgeRetrievalProfile: "precise"
      })
    );
  });
});
