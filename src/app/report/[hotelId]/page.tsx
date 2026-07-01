import { ReportPageClient } from "@/components/ReportPageClient";

export default async function ReportPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  return <ReportPageClient hotelId={hotelId} />;
}
