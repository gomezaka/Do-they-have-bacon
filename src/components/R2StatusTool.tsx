"use client";

import { useState } from "react";

interface R2StatusPayload {
  configured: boolean;
  missing: string[];
  bucketName?: string;
  publicUrl?: string;
  endpoint?: string;
  localUploadsAllowed: boolean;
}

export function R2StatusTool() {
  const [status, setStatus] = useState<R2StatusPayload | null>(null);
  const [message, setMessage] = useState("R2 status has not been checked yet.");
  const [isChecking, setIsChecking] = useState(false);

  async function checkStatus() {
    setIsChecking(true);
    setMessage("Checking Cloudflare R2 configuration...");

    try {
      const response = await fetch("/api/uploads/r2-status", { cache: "no-store" });
      const payload = (await response.json()) as R2StatusPayload;
      setStatus(payload);
      setMessage(payload.configured ? "R2 is configured." : "R2 is missing one or more environment values.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check R2 configuration.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <section className="card form">
      <div className="stack">
        <h2>Cloudflare R2 check</h2>
        <p className="muted">
          This checks whether the server can see the R2 environment variables. It does not print secret values.
        </p>
      </div>

      <div className="actions">
        <button className="button secondary" type="button" onClick={checkStatus} disabled={isChecking}>
          {isChecking ? "Checking..." : "Check R2 config"}
        </button>
      </div>

      <p className="muted">{message}</p>

      {status && (
        <div className="notice stack">
          <p><strong>Status:</strong> {status.configured ? "Configured" : "Not ready"}</p>
          <p><strong>Bucket:</strong> {status.bucketName || "Missing"}</p>
          <p><strong>Endpoint:</strong> {status.endpoint || "Missing"}</p>
          <p><strong>Public URL:</strong> {status.publicUrl || "Missing"}</p>
          <p><strong>Local R2 uploads:</strong> {status.localUploadsAllowed ? "Allowed" : "Disabled"}</p>
          {!status.configured && status.missing.length > 0 && (
            <p><strong>Missing:</strong> {status.missing.join(", ")}</p>
          )}
        </div>
      )}
    </section>
  );
}
