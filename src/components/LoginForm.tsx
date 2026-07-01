"use client";

import { FormEvent, useState } from "react";
import { getClientDataMode } from "@/lib/dataMode";
import { sendMagicLink } from "@/lib/authClient";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const mode = getClientDataMode();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (mode !== "supabase") {
      setError("Auth is only active when NEXT_PUBLIC_DATA_MODE=supabase.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setIsSending(true);
    try {
      await sendMagicLink(email.trim());
      setMessage("Check your inbox. The bacon gate opens by email link.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send login link.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="stack">
        <h2>Sign in as a bacon scout</h2>
        <p className="muted">
          This is optional. Anonymous scouts can still add hotels, report bacon and attach evidence.
        </p>
      </div>

      {mode !== "supabase" && (
        <div className="notice">
          Local mode is active. You can test the app without signing in.
        </div>
      )}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="scout@example.com"
          autoComplete="email"
        />
      </div>

      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="button" type="submit" disabled={isSending || mode !== "supabase"}>
          {isSending ? "Sending..." : "Send magic link"}
        </button>
      </div>
    </form>
  );
}
