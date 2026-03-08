import { useEffect, useRef, useState, type KeyboardEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Send, ShoppingCart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  API_BASE_URL,
  sendChatMessage,
  type ChatResponse,
  type RevenueAISuggestion,
  type ClerkPayload,
  type ClerkShortlistItem,
} from '@/api/client';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  suggestion?: RevenueAISuggestion | null;
  clerk?: ClerkPayload | null;
};

interface ChatProps {
  slug: string;
  botName: string;
  lang?: string;
  showPoweredBy?: boolean;
  variant?: 'default' | 'widget';
}

const STRINGS = {
  en: {
    empty: (botName: string) => `You're chatting with ${botName}. Ask anything about their website.`,
    placeholder: (botName: string) => `Ask ${botName} a question...`,
    sending: 'Sending...',
    send: 'Send',
    you: 'You',
    error: 'Sorry, there was an error sending your message. Please try again.',
  },
  it: {
    empty: (botName: string) => `Stai parlando con ${botName}. Chiedimi qualsiasi cosa sul loro sito.`,
    placeholder: (botName: string) => `Fai una domanda a ${botName}...`,
    sending: 'Invio...',
    send: 'Invia',
    you: 'Tu',
    error: "Si è verificato un errore nell'invio del messaggio. Per favore riprova.",
  },
} as const;

type LocaleKey = keyof typeof STRINGS;

const Chat = ({ slug, botName, lang, showPoweredBy, variant = 'default' }: ChatProps) => {
  const { i18n } = useTranslation();
  let resolvedLang = (lang || 'en').toLowerCase();
  if (!lang && typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang');
      if (urlLang) resolvedLang = urlLang.toLowerCase();
    } catch {
      // ignore URL parsing errors
    }
  }

  const locale = STRINGS[resolvedLang as LocaleKey] ?? STRINGS.en;
  const tFixed = i18n.getFixedT(resolvedLang);
  const isWidgetVariant = variant === 'widget';

  const buttonLabels = {
    view:
      resolvedLang === 'it'
        ? 'Vedi prodotto'
        : resolvedLang === 'es'
          ? 'Ver producto'
          : 'View product',
    add:
      resolvedLang === 'it'
        ? 'Aggiungi al carrello'
        : resolvedLang === 'es'
          ? 'Agregar al carrito'
          : 'Add to cart',
    cart: resolvedLang === 'it' ? 'Vedi carrello' : resolvedLang === 'es' ? 'Ver carrito' : 'View cart',
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const conversationStorageKey = `coslo_conversation_id:${slug}`;
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [widgetContext, setWidgetContext] = useState<{
    shopDomain: string;
    botId: string;
    widgetToken: string;
  } | null>(null);

  const getWidgetContext = () => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const shopDomain = params.get('shop');
    const botId = params.get('botId');
    const widgetToken = params.get('wt');
    if (!shopDomain || !botId || !widgetToken) return null;
    return { shopDomain, botId, widgetToken };
  };

  useEffect(() => {
    const ctx = getWidgetContext();
    if (ctx) {
      setWidgetContext(ctx);
      return;
    }

    if (!slug) return;
    fetch(`${API_BASE_URL}/shopify/widget-context?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.shopDomain && data.botId && data.widgetToken) {
          setWidgetContext({
            shopDomain: data.shopDomain,
            botId: data.botId,
            widgetToken: data.widgetToken,
          });
        }
      })
      .catch(() => {
        // ignore lookup failures
      });
  }, [slug]);

  useEffect(() => {
    if (typeof window === 'undefined' || !slug) {
      setConversationId(null);
      return;
    }
    try {
      const stored = window.sessionStorage.getItem(conversationStorageKey);
      setConversationId(stored || null);
    } catch {
      setConversationId(null);
    }
  }, [slug, conversationStorageKey]);

  const getOrCreateSessionId = () => {
    if (typeof window === 'undefined') return null;
    const key = 'coslo_widget_session_id';
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem(key, next);
    return next;
  };

  const trackShopifyEvent = async (
    eventType: 'view_product' | 'add_to_cart',
    payload: {
      productId?: string | null;
      variantId?: string | null;
      meta?: any;
    }
  ) => {
    const ctx = widgetContext || getWidgetContext();
    if (!ctx) return;
    const sessionId = getOrCreateSessionId();
    try {
      await fetch(`${API_BASE_URL}/shopify/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shopDomain: ctx.shopDomain,
          botId: ctx.botId,
          token: ctx.widgetToken,
          eventType,
          sessionId,
          conversationId,
          productId: payload.productId ?? undefined,
          variantId: payload.variantId ?? undefined,
          meta: payload.meta ?? undefined,
        }),
        keepalive: true,
      });
    } catch {
      // ignore tracking failures
    }
  };

  const trackRevenueAIAction = async (
    action: 'CLICK' | 'ADD_TO_CART' | 'CHECKOUT',
    suggestion: RevenueAISuggestion,
    meta?: any
  ) => {
    const ctx = widgetContext || getWidgetContext();
    const fallbackBotId = suggestion.botId || ctx?.botId || null;
    const fallbackConversationId = suggestion.conversationId || conversationId || null;
    if (!fallbackBotId || !fallbackConversationId) return;
    const sessionId = getOrCreateSessionId();
    const clientEventId = crypto.randomUUID();
    const clientTs = Date.now();
    try {
      await fetch(`${API_BASE_URL}/revenue-ai/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventId: suggestion.eventId,
          botId: fallbackBotId,
          conversationId: fallbackConversationId,
          action,
          sessionId,
          clientEventId,
          clientTs,
          meta: meta ?? undefined,
          suggestedProductId: suggestion.product.productId,
          offerType: suggestion.offerType,
          stage: suggestion.stage,
          style: suggestion.style,
        }),
        keepalive: true,
      });
    } catch {
      // ignore tracking failures
    }
  };

  const parseImageSegments = (text: string) => {
    const regex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi;
    const segments: Array<{
      caption: string;
      imageUrl: string;
      rawText: string;
      productUrl: string | null;
      addToCartUrl: string | null;
    }> = [];

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index).trim();
      const localBlock = before.split(/\n\s*\n/).filter(Boolean).pop() || before;
      const altText = (match[1] || '').trim();
      const imageUrl = match[2];
      const cleanBefore = stripMarkdownLinks(stripActionLines(localBlock));
      const captionSource = altText || cleanBefore;
      const captionLines = captionSource
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const caption =
        captionLines.length > 0
          ? captionLines[captionLines.length - 1]
          : tFixed('chat.productFallback');

      const segTail = before
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(-6)
        .join('\n');
      const segUrls = extractShopifyUrls(segTail);
      segments.push({
        caption,
        imageUrl,
        rawText: cleanBefore,
        productUrl: segUrls.productUrl,
        addToCartUrl: segUrls.addToCartUrl,
      });

      lastIndex = regex.lastIndex;
    }

    const remainder = text.slice(lastIndex).trim();
    return { segments, remainder };
  };

  const stripMarkdownLinks = (text: string) =>
    text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1');

  const stripActionLines = (text: string) => {
    const lines = text.split('\n');
    const cleaned = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^\[.+\]\(https?:\/\/[^)]+\)$/.test(trimmed)) return false;
      if (/^https?:\/\/\S+$/.test(trimmed)) return false;
      if (
        /^(view product|add to cart|vedi prodotto|aggiungi al carrello|ver producto|agregar al carrito)$/i.test(
          trimmed
        )
      ) {
        return false;
      }
      return true;
    });
    return cleaned.join('\n');
  };

  const stripUrls = (text: string) =>
    text.replace(/https?:\/\/\S+/gi, '').replace(/\s{2,}/g, ' ').trim();

  const stripImageMarkdown = (text: string) =>
    text.replace(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/gi, '').replace(/\s{2,}/g, ' ').trim();

  const extractShopifyUrls = (text: string) => {
    const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
    let addToCartUrl: string | null = null;
    let cartUrl: string | null = null;
    let productUrl: string | null = null;
    let productCount = 0;
    let addToCartCount = 0;

    for (const raw of urls) {
      const cleaned = raw.replace(/[.,!?]$/, '');
      if (cleaned.includes('/cart/add')) {
        addToCartUrl = cleaned;
        addToCartCount += 1;
      } else if (cleaned.includes('/cart')) {
        cartUrl = cleaned;
      } else if (cleaned.includes('/products/')) {
        productUrl = cleaned;
        productCount += 1;
      }
    }

    return { addToCartUrl, cartUrl, productUrl, productCount, addToCartCount };
  };

  const extractProductHandle = (productUrl?: string | null) => {
    if (!productUrl) return null;
    try {
      const url = new URL(productUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('products');
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    } catch {
      // ignore
    }
    return null;
  };

  const handleAddToCart = async (addToCartUrl: string) => {
    const ctx = widgetContext || getWidgetContext();
    const sessionId = getOrCreateSessionId();
    let fallbackVariantId: string | null = null;
    try {
      const parsed = new URL(addToCartUrl);
      fallbackVariantId = parsed.searchParams.get('id');
      if (parsed.origin === window.location.origin) {
        const variantId = parsed.searchParams.get('id');
        const quantity = Number(parsed.searchParams.get('quantity') || '1');

        if (variantId) {
          await trackShopifyEvent('add_to_cart', {
            variantId,
            meta: { method: 'ajax_cart' },
          });
          const res = await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              id: variantId,
              quantity,
              properties:
                ctx && sessionId
                  ? {
                      coslo_session_id: sessionId,
                      coslo_bot_id: ctx.botId,
                      coslo_conversation_id: conversationId || '',
                    }
                  : undefined,
            }),
          });

          if (res.ok) {
            const systemMessage: ChatMessage = {
              id: `system-${Date.now()}`,
              role: 'system',
              content: tFixed('chat.addedToCart'),
            };
            setMessages((prev) => [...prev, systemMessage]);
            return;
          }
        }
      }
    } catch {
      // fall back to opening the cart URL
    }

    try {
      await trackShopifyEvent('add_to_cart', {
        variantId: fallbackVariantId,
        meta: { method: 'link' },
      });
    } catch {
      // ignore
    }

    let openUrl = addToCartUrl;
    if (ctx && sessionId) {
      try {
        const parsed = new URL(addToCartUrl);
        parsed.searchParams.set('properties[coslo_session_id]', sessionId);
        parsed.searchParams.set('properties[coslo_bot_id]', ctx.botId);
        if (conversationId) {
          parsed.searchParams.set('properties[coslo_conversation_id]', conversationId);
        }
        openUrl = parsed.toString();
      } catch {
        // ignore
      }
    }

    window.open(openUrl, '_blank', 'noopener,noreferrer');
  };

  const formatPrice = (price: string | null, currency?: string | null) => {
    if (!price) return null;
    const value = Number(price);
    if (!Number.isFinite(value)) return price;
    const currencyCode = currency || 'EUR';
    try {
      return new Intl.NumberFormat(resolvedLang === 'it' ? 'it-IT' : 'en-GB', {
        style: 'currency',
        currency: currencyCode,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currencyCode}`;
    }
  };

  const formatPriceRange = (item: ClerkShortlistItem) => {
    if (!item.priceMin && !item.priceMax) return null;
    const min = item.priceMin ? formatPrice(item.priceMin, item.currency) : null;
    const max = item.priceMax ? formatPrice(item.priceMax, item.currency) : null;
    if (min && max && min !== max) return `${min} - ${max}`;
    return min || max;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setError(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const sessionId = getOrCreateSessionId();
      const response: ChatResponse = await sendChatMessage(
        slug,
        {
          message: trimmed,
          conversationId,
        },
        {
          sessionId,
        }
      );

      if (response.conversationId && response.conversationId !== conversationId) {
        setConversationId(response.conversationId);
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(conversationStorageKey, response.conversationId);
          } catch {
            // ignore storage failures
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        suggestion: response.suggestion ?? null,
        clerk: response.clerk ?? null,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || tFixed('chat.sendFailed'));
      const systemMessage: ChatMessage = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: locale.error,
      };
      setMessages((prev) => [...prev, systemMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isWidgetVariant) {
    return (
      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>{locale.empty(botName)}</p>
            </div>
          )}

          {messages.map((msg) => {
            const parsed = msg.role === 'assistant' ? parseImageSegments(msg.content) : null;
            const imageSegments = parsed?.segments || [];
            const displayText =
              msg.role === 'assistant'
                ? stripUrls(stripMarkdownLinks(stripActionLines(stripImageMarkdown(msg.content))))
                    .replace(
                      /\b(view product|add to cart|vedi prodotto|aggiungi al carrello|ver producto|agregar al carrito)\b/gi,
                      ''
                    )
                    .replace(/\s{2,}/g, ' ')
                    .trim()
                : msg.content;
            const actions = msg.role === 'assistant' ? extractShopifyUrls(msg.content) : null;

            return (
              <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
                <div className="chat-message-bubble">
                  {msg.role !== 'system' && (
                    <div className="chat-message-role">{msg.role === 'user' ? locale.you : botName}</div>
                  )}
                  <div className="chat-message-content">{displayText}</div>

                  {msg.role === 'assistant' && msg.clerk?.type === 'shortlist' && (
                    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                      {msg.clerk.items.map((item, idx) => (
                        <div
                          key={`${msg.id}-shortlist-${idx}`}
                          style={{
                            margin: 0,
                            padding: 10,
                            borderRadius: 12,
                            border: '1px solid rgba(148, 163, 184, 0.35)',
                            background: 'rgba(15, 23, 42, 0.55)',
                            display: 'grid',
                            gap: 8,
                            maxWidth: 460,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                style={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 10,
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                                loading="lazy"
                              />
                            )}
                            <div style={{ display: 'grid', gap: 4 }}>
                              <strong>{item.title}</strong>
                              {formatPriceRange(item) && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                  {formatPriceRange(item)}
                                </div>
                              )}
                            </div>
                          </div>
                          {item.attrSummary.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {item.attrSummary.map((attr, attrIdx) => (
                                <li key={`${msg.id}-attr-${idx}-${attrIdx}`}>
                                  <strong style={{ color: 'inherit' }}>{attr.label}:</strong> {attr.value}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {item.productUrl && (
                              <button
                                type="button"
                                className="chat-send-button"
                                onClick={() => {
                                  const handle = extractProductHandle(item.productUrl);
                                  trackShopifyEvent('view_product', {
                                    productId: handle,
                                    meta: { productUrl: item.productUrl },
                                  });
                                  window.open(item.productUrl!, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                {buttonLabels.view}
                              </button>
                            )}
                            {item.addToCartUrl && (
                              <button
                                type="button"
                                className="chat-send-button"
                                onClick={() => handleAddToCart(item.addToCartUrl!)}
                              >
                                {buttonLabels.add}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === 'assistant' && msg.clerk?.type === 'details' && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 12,
                        border: '1px solid rgba(148, 163, 184, 0.35)',
                        background: 'rgba(15, 23, 42, 0.55)',
                        maxWidth: 460,
                        display: 'grid',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        {msg.clerk.item.imageUrl && (
                          <img
                            src={msg.clerk.item.imageUrl}
                            alt={msg.clerk.item.title}
                            style={{
                              width: 72,
                              height: 72,
                              borderRadius: 10,
                              objectFit: 'cover',
                              display: 'block',
                            }}
                            loading="lazy"
                          />
                        )}
                        <div style={{ display: 'grid', gap: 4 }}>
                          <strong>{msg.clerk.item.title}</strong>
                          {formatPriceRange(msg.clerk.item) && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              {formatPriceRange(msg.clerk.item)}
                            </div>
                          )}
                        </div>
                      </div>
                      {msg.clerk.item.attrSummary.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {msg.clerk.item.attrSummary.map((attr, attrIdx) => (
                            <li key={`${msg.id}-details-attr-${attrIdx}`}>
                              <strong style={{ color: 'inherit' }}>{attr.label}:</strong> {attr.value}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {msg.clerk.item.productUrl && (
                          <button
                            type="button"
                            className="chat-send-button"
                            onClick={() => {
                              const handle = extractProductHandle(msg.clerk.item.productUrl);
                              trackShopifyEvent('view_product', {
                                productId: handle,
                                meta: { productUrl: msg.clerk.item.productUrl },
                              });
                              window.open(msg.clerk.item.productUrl!, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            {buttonLabels.view}
                          </button>
                        )}
                        {msg.clerk.item.addToCartUrl && (
                          <button
                            type="button"
                            className="chat-send-button"
                            onClick={() => handleAddToCart(msg.clerk.item.addToCartUrl!)}
                          >
                            {buttonLabels.add}
                          </button>
                        )}
                        {msg.clerk.checkoutUrl && (
                          <button
                            type="button"
                            className="chat-send-button"
                            onClick={() => window.open(msg.clerk.checkoutUrl!, '_blank', 'noopener,noreferrer')}
                          >
                            {buttonLabels.cart}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {imageSegments.length > 0 && (
                    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                      {imageSegments.map((seg, idx) => (
                        <figure
                          key={`${msg.id}-img-${idx}`}
                          style={{
                            margin: 0,
                            padding: 8,
                            borderRadius: 12,
                            border: '1px solid rgba(148, 163, 184, 0.35)',
                            background: 'rgba(15, 23, 42, 0.55)',
                            display: 'grid',
                            gap: 6,
                            maxWidth: 380,
                          }}
                        >
                          <img
                            src={seg.imageUrl}
                            alt={seg.caption}
                            style={{ width: '100%', borderRadius: 10, display: 'block' }}
                            loading="lazy"
                          />
                          <figcaption style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {seg.caption}
                          </figcaption>
                          {(seg.productUrl || seg.addToCartUrl) && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                              {seg.productUrl && (
                                <button
                                  type="button"
                                  className="chat-send-button"
                                  onClick={() => {
                                    const handle = extractProductHandle(seg.productUrl);
                                    trackShopifyEvent('view_product', {
                                      productId: handle,
                                      meta: { productUrl: seg.productUrl },
                                    });
                                    window.open(seg.productUrl!, '_blank', 'noopener,noreferrer');
                                  }}
                                >
                                  {buttonLabels.view}
                                </button>
                              )}
                              {seg.addToCartUrl && (
                                <button
                                  type="button"
                                  className="chat-send-button"
                                  onClick={() => handleAddToCart(seg.addToCartUrl!)}
                                >
                                  {buttonLabels.add}
                                </button>
                              )}
                            </div>
                          )}
                        </figure>
                      ))}
                    </div>
                  )}

                  {actions &&
                    imageSegments.length === 0 &&
                    (actions.addToCartUrl || actions.cartUrl || actions.productUrl) && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {actions.productUrl && actions.productCount <= 1 && (
                          <button
                            type="button"
                            className="chat-send-button"
                            onClick={() => {
                              const handle = extractProductHandle(actions.productUrl);
                              trackShopifyEvent('view_product', {
                                productId: handle,
                                meta: { productUrl: actions.productUrl },
                              });
                              window.open(actions.productUrl!, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            {buttonLabels.view}
                          </button>
                        )}
                        {actions.addToCartUrl && actions.addToCartCount <= 1 && (
                          <button
                            type="button"
                            className="chat-send-button"
                            onClick={() => handleAddToCart(actions.addToCartUrl!)}
                          >
                            {buttonLabels.add}
                          </button>
                        )}
                        {actions.cartUrl && (
                          <button
                            type="button"
                            className="chat-send-button"
                            onClick={() => window.open(actions.cartUrl!, '_blank', 'noopener,noreferrer')}
                          >
                            {buttonLabels.cart}
                          </button>
                        )}
                      </div>
                    )}

                  {msg.role === 'assistant' && msg.suggestion && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 12,
                        border: '1px solid rgba(148, 163, 184, 0.35)',
                        background: 'rgba(15, 23, 42, 0.55)',
                        maxWidth: 420,
                        display: 'grid',
                        gap: 8,
                      }}
                    >
                      {msg.suggestion.product.imageUrl && (
                        <img
                          src={msg.suggestion.product.imageUrl}
                          alt={msg.suggestion.product.title}
                          style={{ width: '100%', borderRadius: 10, display: 'block' }}
                          loading="lazy"
                        />
                      )}
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>{msg.suggestion.product.title}</strong>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {msg.suggestion.reason}
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                          {formatPrice(msg.suggestion.product.price, msg.suggestion.product.currency)}
                          {msg.suggestion.product.compareAtPrice && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                              {formatPrice(
                                msg.suggestion.product.compareAtPrice,
                                msg.suggestion.product.currency
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {msg.suggestion.product.addToCartUrl && (
                          <button
                            type="button"
                            className="chat-send-button"
                            onClick={async () => {
                              await trackRevenueAIAction('ADD_TO_CART', msg.suggestion, { cta: 'add_to_cart' });
                              await handleAddToCart(msg.suggestion.product.addToCartUrl!);
                            }}
                          >
                            {msg.suggestion.cta.addToCart}
                          </button>
                        )}
                        {msg.suggestion.product.productUrl && (
                          <button
                            type="button"
                            className="chat-send-button"
                            onClick={async () => {
                              const handle = extractProductHandle(msg.suggestion.product.productUrl);
                              trackShopifyEvent('view_product', {
                                productId: handle,
                                meta: {
                                  productUrl: msg.suggestion.product.productUrl,
                                  source: 'revenue_ai',
                                },
                              });
                              await trackRevenueAIAction('CLICK', msg.suggestion, { cta: 'view_product' });
                              window.open(msg.suggestion.product.productUrl!, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            {msg.suggestion.cta.checkout}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          {error && <div className="chat-error">{error}</div>}
          <textarea
            className="chat-input"
            placeholder={locale.placeholder(botName)}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            maxLength={2000}
          />
          <button className="chat-send-button" onClick={handleSend} disabled={isSending || !input.trim()}>
            {isSending ? locale.sending : locale.send}
          </button>
          {showPoweredBy && (
            <div className="chat-powered-by">
              <a href="https://coslo.it" target="_blank" rel="noopener noreferrer">
                {tFixed('chat.poweredBy')}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full min-h-[70vh]', isWidgetVariant && 'widget-chat-root')}>
      <div className={cn('flex-1 overflow-y-auto px-4 py-6 space-y-4', isWidgetVariant && 'widget-chat-messages')}>
        {messages.length === 0 && (
          <div
            className={cn(
              'rounded-2xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground',
              isWidgetVariant && 'widget-chat-empty'
            )}
          >
            {locale.empty(botName)}
          </div>
        )}

        {messages.map((msg) => {
          const parsed = msg.role === 'assistant' ? parseImageSegments(msg.content) : null;
          const imageSegments = parsed?.segments || [];
          const displayText =
            msg.role === 'assistant'
              ? stripUrls(stripMarkdownLinks(stripActionLines(stripImageMarkdown(msg.content))))
                  .replace(
                    /\b(view product|add to cart|vedi prodotto|aggiungi al carrello|ver producto|agregar al carrito)\b/gi,
                    ''
                  )
                  .replace(/\s{2,}/g, ' ')
                  .trim()
              : msg.content;
          const actions = msg.role === 'assistant' ? extractShopifyUrls(msg.content) : null;

          return (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
                isWidgetVariant && 'widget-chat-message'
              )}
            >
              {msg.role !== 'user' && !isWidgetVariant && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[75%] space-y-3',
                  msg.role === 'user' && 'order-first',
                  isWidgetVariant && 'widget-chat-stack'
                )}
              >
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : msg.role === 'system'
                        ? 'bg-warning/10 text-warning-foreground border border-warning/20'
                        : 'bg-card border border-border rounded-bl-md',
                    isWidgetVariant && 'widget-chat-bubble',
                    isWidgetVariant && msg.role === 'user' && 'widget-chat-bubble-user',
                    isWidgetVariant && msg.role === 'assistant' && 'widget-chat-bubble-assistant',
                    isWidgetVariant && msg.role === 'system' && 'widget-chat-bubble-system'
                  )}
                >
                  {isWidgetVariant && msg.role !== 'system' && (
                    <div className="widget-chat-role">{msg.role === 'user' ? locale.you : botName}</div>
                  )}
                  {displayText}
                </div>

                {msg.role === 'assistant' && msg.clerk?.type === 'shortlist' && (
                  <div className="grid gap-3">
                    {msg.clerk.items.map((item, idx) => (
                      <div
                        key={`${msg.id}-shortlist-${idx}`}
                        className="rounded-2xl border border-border bg-card p-4 grid gap-3 max-w-[480px]"
                      >
                        <div className="flex items-start gap-3">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="h-16 w-16 rounded-xl object-cover"
                              loading="lazy"
                            />
                          )}
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-foreground">{item.title}</div>
                            {formatPriceRange(item) && (
                              <div className="text-xs text-muted-foreground">{formatPriceRange(item)}</div>
                            )}
                          </div>
                        </div>
                        {item.attrSummary.length > 0 && (
                          <ul className="text-xs text-muted-foreground">
                            {item.attrSummary.map((attr, attrIdx) => (
                              <li key={`${msg.id}-attr-${idx}-${attrIdx}`}>
                                <span className="font-medium text-foreground/80">{attr.label}:</span>{' '}
                                {attr.value}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className={cn('flex gap-2 flex-wrap', isWidgetVariant && 'widget-chat-actions')}>
                          {item.productUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const handle = extractProductHandle(item.productUrl);
                                trackShopifyEvent('view_product', {
                                  productId: handle,
                                  meta: { productUrl: item.productUrl },
                                });
                                window.open(item.productUrl!, '_blank', 'noopener,noreferrer');
                              }}
                            >
                              <ExternalLink className="mr-1 h-3 w-3" />
                              {buttonLabels.view}
                            </Button>
                          )}
                          {item.addToCartUrl && (
                            <Button size="sm" onClick={() => handleAddToCart(item.addToCartUrl!)}>
                              <ShoppingCart className="mr-1 h-3 w-3" />
                              {buttonLabels.add}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {msg.role === 'assistant' && msg.clerk?.type === 'details' && (
                  <div className="rounded-2xl border border-border bg-card p-4 grid gap-3 max-w-[480px]">
                    <div className="flex items-start gap-3">
                      {msg.clerk.item.imageUrl && (
                        <img
                          src={msg.clerk.item.imageUrl}
                          alt={msg.clerk.item.title}
                          className="h-20 w-20 rounded-xl object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground">{msg.clerk.item.title}</div>
                        {formatPriceRange(msg.clerk.item) && (
                          <div className="text-xs text-muted-foreground">
                            {formatPriceRange(msg.clerk.item)}
                          </div>
                        )}
                      </div>
                    </div>
                    {msg.clerk.item.attrSummary.length > 0 && (
                      <ul className="text-xs text-muted-foreground">
                        {msg.clerk.item.attrSummary.map((attr, attrIdx) => (
                          <li key={`${msg.id}-details-attr-${attrIdx}`}>
                            <span className="font-medium text-foreground/80">{attr.label}:</span>{' '}
                            {attr.value}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className={cn('flex gap-2 flex-wrap', isWidgetVariant && 'widget-chat-actions')}>
                      {msg.clerk.item.productUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const handle = extractProductHandle(msg.clerk.item.productUrl);
                            trackShopifyEvent('view_product', {
                              productId: handle,
                              meta: { productUrl: msg.clerk.item.productUrl },
                            });
                            window.open(msg.clerk.item.productUrl!, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          {buttonLabels.view}
                        </Button>
                      )}
                      {msg.clerk.item.addToCartUrl && (
                        <Button size="sm" onClick={() => handleAddToCart(msg.clerk.item.addToCartUrl!)}>
                          <ShoppingCart className="mr-1 h-3 w-3" />
                          {buttonLabels.add}
                        </Button>
                      )}
                      {msg.clerk.checkoutUrl && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={msg.clerk.checkoutUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 h-3 w-3" />
                            {buttonLabels.cart}
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {imageSegments.length > 0 && (
                  <div className="grid gap-3">
                    {imageSegments.map((seg, idx) => (
                      <figure
                        key={`${msg.id}-img-${idx}`}
                        className="rounded-2xl border border-border bg-card p-3 grid gap-3 max-w-[420px]"
                      >
                        <img
                          src={seg.imageUrl}
                          alt={seg.caption}
                          className="w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                        <figcaption className="text-xs text-muted-foreground">{seg.caption}</figcaption>
                        {(seg.productUrl || seg.addToCartUrl) && (
                          <div className={cn('flex gap-2 flex-wrap', isWidgetVariant && 'widget-chat-actions')}>
                            {seg.productUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const handle = extractProductHandle(seg.productUrl);
                                  trackShopifyEvent('view_product', {
                                    productId: handle,
                                    meta: { productUrl: seg.productUrl },
                                  });
                                  window.open(seg.productUrl!, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                {buttonLabels.view}
                              </Button>
                            )}
                            {seg.addToCartUrl && (
                              <Button size="sm" onClick={() => handleAddToCart(seg.addToCartUrl!)}>
                                <ShoppingCart className="h-3 w-3 mr-1" />
                                {buttonLabels.add}
                              </Button>
                            )}
                          </div>
                        )}
                      </figure>
                    ))}
                  </div>
                )}

                {actions &&
                  imageSegments.length === 0 &&
                  (actions.addToCartUrl || actions.cartUrl || actions.productUrl) && (
                    <div className={cn('flex gap-2 flex-wrap', isWidgetVariant && 'widget-chat-actions')}>
                      {actions.productUrl && actions.productCount <= 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const handle = extractProductHandle(actions.productUrl);
                            trackShopifyEvent('view_product', {
                              productId: handle,
                              meta: { productUrl: actions.productUrl },
                            });
                            window.open(actions.productUrl!, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {buttonLabels.view}
                        </Button>
                      )}
                      {actions.addToCartUrl && actions.addToCartCount <= 1 && (
                        <Button size="sm" onClick={() => handleAddToCart(actions.addToCartUrl!)}>
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          {buttonLabels.add}
                        </Button>
                      )}
                      {actions.cartUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(actions.cartUrl!, '_blank', 'noopener,noreferrer')}
                        >
                          {buttonLabels.cart}
                        </Button>
                      )}
                    </div>
                  )}

                {msg.role === 'assistant' && msg.suggestion && (
                  <div className="rounded-2xl border border-border bg-card p-4 max-w-[420px] grid gap-3">
                    <div className="flex items-start gap-3">
                      {msg.suggestion.product.imageUrl && (
                        <img
                          src={msg.suggestion.product.imageUrl}
                          alt={msg.suggestion.product.title}
                          className="h-16 w-16 rounded-xl object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="grid gap-1">
                        <div className="text-sm font-medium">{msg.suggestion.product.title}</div>
                        <div className="text-xs text-muted-foreground">{msg.suggestion.reason}</div>
                        <div className="text-sm">
                          {formatPrice(msg.suggestion.product.price, msg.suggestion.product.currency)}
                          {msg.suggestion.product.compareAtPrice && (
                            <span className="text-xs text-muted-foreground line-through ml-2">
                              {formatPrice(msg.suggestion.product.compareAtPrice, msg.suggestion.product.currency)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={cn('flex gap-2 flex-wrap', isWidgetVariant && 'widget-chat-actions')}>
                      {msg.suggestion.product.addToCartUrl && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            await trackRevenueAIAction('ADD_TO_CART', msg.suggestion, { cta: 'add_to_cart' });
                            await handleAddToCart(msg.suggestion.product.addToCartUrl!);
                          }}
                        >
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          {msg.suggestion.cta.addToCart}
                        </Button>
                      )}
                      {msg.suggestion.product.productUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const handle = extractProductHandle(msg.suggestion.product.productUrl);
                            trackShopifyEvent('view_product', {
                              productId: handle,
                              meta: {
                                productUrl: msg.suggestion.product.productUrl,
                                source: 'revenue_ai',
                              },
                            });
                            await trackRevenueAIAction('CLICK', msg.suggestion, { cta: 'view_product' });
                            window.open(msg.suggestion.product.productUrl!, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          {msg.suggestion.cta.checkout}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className={cn('border-t border-border bg-card p-4 space-y-3', isWidgetVariant && 'widget-chat-input-container')}>
        {error && <div className="text-sm text-destructive">{error}</div>}
        {isWidgetVariant ? (
          <>
            <textarea
              className="widget-chat-input"
              placeholder={locale.placeholder(botName)}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              maxLength={2000}
            />
            <button
              type="button"
              className="widget-chat-send"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
            >
              {isSending ? locale.sending : locale.send}
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 items-center"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={locale.placeholder(botName)}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isSending || !input.trim()}>
              {isSending ? locale.sending.slice(0, 1) : <Send className="h-4 w-4" />}
            </Button>
          </form>
        )}
        {showPoweredBy && (
          <div className={cn('text-xs text-muted-foreground', isWidgetVariant && 'widget-chat-powered')}>
            <a href="https://coslo.it" target="_blank" rel="noopener noreferrer" className="hover:underline">
              {tFixed('chat.poweredBy')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
