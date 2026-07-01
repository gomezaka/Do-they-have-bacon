"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Opening the bacon gate...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;

    async function finishAuth() {
      const error = searchParams.get("error_description") || searchParams.get("error");
      if (error) {
        if (!active) return;
        setIsError(true);
        setMessage(error);
        return;
      }

      const code = searchParams.get("code");
      const supabase = getSupabaseBrowserClient();

      if (!supabase) {
        if (!active) return;
        setIsError(true);
        setMessage("Supabase is not configured in this build.");
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        if (!active) return;
        setMessage("You are signed in. Bacon scouting may continue.");
      } catch (error) {
        if (!active) return;
        setIsError(true);
        setMessage(error instanceof Error ? error.message : "Could not complete sign-in.");
      }
    }

    finishAuth();

    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <section>
      <div className="context-header">
        <Link className="round-icon" href="/tools" aria-label="Back">‹</Link>
        <h1>Scout access</h1>
        <span className="header-spacer" />
      </div>

      <div className={isError ? "notice error" : "intro-card"}>
        <p className="hero-kicker">Do They Have Bacon?</p>
        <h2>{isError ? "Sign-in failed." : "Sign-in complete."}</h2>
        <p className="hotel-meta">{message}</p>
      </div>

      <div className="actions">
        <Link className="button" href="/tools">Back to You</Link>
        <Link className="button secondary" href="/">Home</Link>
      </div>
    </section>
  );
}

function AuthCallbackFallback() {
  return (
    <section>
      <div className="context-header">
        <Link className="round-icon" href="/tools" aria-label="Back">‹</Link>
        <h1>Scout access</h1>
        <span className="header-spacer" />
      </div>
      <div className="intro-card">
        <p className="hero-kicker">Do They Have Bacon?</p>
        <h2>Opening the bacon gate...</h2>
        <p className="hotel-meta">Checking the magic link.</p>
      </div>
    </section>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
