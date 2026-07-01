"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAnonymousScoutCreatedAt, getAnonymousScoutId, resetAnonymousScoutId } from "@/lib/anonymousScout";
import { getClientDataMode } from "@/lib/dataMode";
import { getCurrentAuthUser, signOut, type BaconAuthUser } from "@/lib/authClient";

export function AuthStatus() {
  const [user, setUser] = useState<BaconAuthUser | null | undefined>(undefined);
  const [scoutId, setScoutId] = useState("loading-scout");
  const [createdAt, setCreatedAt] = useState<string | undefined>();
  const mode = getClientDataMode();

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;
      setScoutId(getAnonymousScoutId());
      setCreatedAt(getAnonymousScoutCreatedAt());
    });

    getCurrentAuthUser().then((current) => {
      if (active) setUser(current);
    });
    return () => {
      active = false;
    };
  }, []);

  function resetScout() {
    const next = resetAnonymousScoutId();
    setScoutId(next);
    setCreatedAt(getAnonymousScoutCreatedAt());
  }

  return (
    <section className="card form">
      <div className="stack">
        <p className="hero-kicker">Scout identity</p>
        <h2>Anonymous bacon scout</h2>
        <p className="muted">Reports do not require an account. This browser uses a local scout ID for rate limits and future badges.</p>
        <p><strong>Scout ID:</strong> <code>{scoutId}</code></p>
        {createdAt && <p className="muted small">Created {new Date(createdAt).toLocaleDateString("en-US")}</p>}
      </div>

      <div className="actions">
        <button className="button secondary" type="button" onClick={resetScout}>Reset local scout ID</button>
      </div>

      <div className="notice stack">
        <strong>Optional account</strong>
        <p className="muted">Sign-in is not required. Later it can unlock editable reports, public scout names and badges.</p>
        {mode === "local" ? (
          <p className="muted small">Local mode: account sign-in is disabled.</p>
        ) : user === undefined ? (
          <p className="muted small">Checking optional Supabase session…</p>
        ) : user ? (
          <div className="auth-inline">
            <span className="auth-pill">{user.email ?? "Signed-in bacon scout"}</span>
            <button
              className="auth-button"
              type="button"
              onClick={async () => {
                await signOut();
                window.location.reload();
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link className="button ghost" href="/login">Optional sign in</Link>
        )}
      </div>
    </section>
  );
}
