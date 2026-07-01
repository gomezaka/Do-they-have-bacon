import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <section>
      <div className="context-header">
        <Link className="round-icon" href="/tools" aria-label="Back">‹</Link>
        <h1>Scout access</h1>
        <span className="header-spacer" />
      </div>
      <div className="intro-card">
        <p className="hero-kicker">Do They Have Bacon?</p>
        <h2>Optional scout sign-in.</h2>
        <p className="hotel-meta">Reporting works without an account. Sign-in is reserved for later profiles, badges and editable reports.</p>
      </div>
      <LoginForm />
    </section>
  );
}
