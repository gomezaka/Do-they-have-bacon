"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Could not load Turnstile.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Turnstile."));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

export function TurnstileField({ value, onChange }: { value?: string; onChange: (token?: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            setMessage("Bacon shield passed.");
            onChange(token);
          },
          "expired-callback": () => {
            setMessage("Bacon shield expired. Try again.");
            onChange(undefined);
          },
          "error-callback": () => {
            setMessage("Bacon shield failed to load correctly.");
            onChange(undefined);
          }
        });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load Turnstile."));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onChange, siteKey]);

  if (!siteKey) return null;

  return (
    <div className="field">
      <label>Bacon shield</label>
      <div ref={containerRef} />
      <p className="muted small">Cloudflare Turnstile protects the bacon map from bots.</p>
      {message && <p className={value ? "success small" : "muted small"}>{message}</p>}
    </div>
  );
}
