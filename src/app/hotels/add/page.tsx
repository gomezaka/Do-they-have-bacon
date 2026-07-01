import Link from "next/link";
import { ManualHotelForm } from "@/components/ManualHotelForm";

export default function AddHotelPage() {
  return (
    <section>
      <div className="context-header">
        <Link className="round-icon" href="/search" aria-label="Back">‹</Link>
        <h1>Add hotel</h1>
        <span className="header-spacer" />
      </div>
      <div className="intro-card">
        <p className="hero-kicker">Uncharted breakfast territory</p>
        <h2>Put this hotel on the bacon map.</h2>
        <p className="hotel-meta">Create the hotel, place the pin, then submit the first scout report.</p>
      </div>
      <ManualHotelForm />
    </section>
  );
}
