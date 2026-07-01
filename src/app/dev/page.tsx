import Link from "next/link";
import { DataModeBanner } from "@/components/DataModeBanner";
import { AuthStatus } from "@/components/AuthStatus";
import { LocalDataTools } from "@/components/LocalDataTools";
import { R2StatusTool } from "@/components/R2StatusTool";

export default function DevPage() {
  const devToolsEnabled = process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === "true";

  if (!devToolsEnabled) {
    return (
      <section>
        <div className="context-header">
          <Link className="round-icon" href="/" aria-label="Back">‹</Link>
          <h1>Not found</h1>
          <span className="header-spacer" />
        </div>
        <div className="notice">
          <strong>Nothing to see here.</strong>
          <p className="muted small">Developer tools are disabled for this build.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="context-header">
        <Link className="round-icon" href="/" aria-label="Back">‹</Link>
        <h1>Developer tools</h1>
        <span className="header-spacer" />
      </div>
      <div className="tight-stack">
        <DataModeBanner />
        <AuthStatus />
        <div className="intro-card">
          <p className="hero-kicker">Private tools</p>
          <h2>Local bacon lab.</h2>
          <p className="hotel-meta">This page is hidden unless NEXT_PUBLIC_SHOW_DEV_TOOLS=true.</p>
        </div>
        <LocalDataTools />
        <R2StatusTool />
      </div>
    </section>
  );
}
