import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";

export default function ToolsPage() {
  return (
    <section>
      <div className="context-header">
        <Link className="round-icon" href="/" aria-label="Back">‹</Link>
        <h1>You</h1>
        <span className="header-spacer" />
      </div>

      <div className="you-card">
        <span className="you-avatar">🕵️</span>
        <div>
          <h2>Anonymous bacon scout</h2>
          <p className="hotel-meta">Rank: Breakfast Witness</p>
        </div>
      </div>

      <div className="tight-stack">
        <div className="intro-card">
          <p className="hero-kicker">Scout profile</p>
          <h2>Your bacon trail starts here.</h2>
          <p className="hotel-meta">
            You can report bacon without an account. Optional sign-in will later unlock badges, editable reports and scout stats.
          </p>
        </div>

        <AuthStatus />

        <div className="profile-grid">
          <div className="stat-card">
            <div className="stat-number">0</div>
            <div className="stat-label">reports from this device</div>
          </div>
          <div className="stat-card">
            <div className="stat-number accent">Beta</div>
            <div className="stat-label">scout status</div>
          </div>
        </div>

        <Link className="add-manual-card" href="/hotels/add">
          <span className="add-manual-icon">🥓</span>
          <span>
            <strong>Report a breakfast</strong>
            <br />
            <span className="muted small">Add a hotel and submit the bacon truth.</span>
          </span>
        </Link>

        <Link className="add-manual-card" href="/map">
          <span className="add-manual-icon">⌖</span>
          <span>
            <strong>Open bacon map</strong>
            <br />
            <span className="muted small">See where scouts have already found breakfast evidence.</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
