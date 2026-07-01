import { HotelDetailsClient } from "@/components/HotelDetailsClient";

export default async function HotelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HotelDetailsClient hotelId={id} />;
}
