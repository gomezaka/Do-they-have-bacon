import Link from "next/link";
import { HotelSearch } from "@/components/HotelSearch";

export default function SearchPage() {
  return (
    <section>
      <div className="context-header">
        <Link className="round-icon" href="/" aria-label="Back">‹</Link>
        <h1>Find a hotel</h1>
        <span className="header-spacer" />
      </div>
      <HotelSearch />
    </section>
  );
}
