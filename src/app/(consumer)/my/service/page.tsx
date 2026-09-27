import { connection } from "next/server";
import { ServiceBooking } from "@/components/consumer/service-booking";
import { todayInMarket } from "@/lib/domain/market";
import { fromISODate } from "@/lib/domain/scheduling";
import { getHousehold, getServiceAvailability } from "@/lib/services/home";

export const metadata = { title: "Book a service" };

export default async function ServicePage() {
  await connection(); // availability is relative to today in Melbourne
  const household = getHousehold();
  return <ServiceBooking availability={getServiceAvailability(fromISODate(todayInMarket()))} installer={household.installer} />;
}
