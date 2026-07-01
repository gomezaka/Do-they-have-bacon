import Link from "next/link";
import type { HotelWithReports } from "@/types/db";
import { calculateBaconStatus } from "@/lib/status";
import { formatDate } from "@/lib/date";
import { BaconStatusBadge } from "@/components/BaconStatusBadge";

export function HotelCard({ hotel }: { hotel: HotelWithReports }) {
  const summary = calculateBaconStatus(hotel.reports);

  return (
    <Link className="card hotel-card" href={`/hotels/${hotel.id}`}>
      <div className="hotel-thumb" aria-hidden="true">🏨</div>
      <div className="hotel-main">
        <h3 className="hotel-title">{hotel.name}</h3>
        <p className="hotel-meta">{hotel.city}, {hotel.country}</p>
        <BaconStatusBadge summary={summary} />
        <p className="hotel-meta">⭐ {hotel.reports.length} reports · last seen {formatDate(summary.lastReportedAt)}</p>
      </div>
      <span className="chevron" aria-hidden="true">›</span>
    </Link>
  );
}
