import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookingV2Keys, getBookingV2Capabilities } from "../api/bookingV2.js";
import BookingV2Context from "./bookingV2Context.js";

export default function BookingV2Provider({ children }) {
  const query = useQuery({
    queryKey: bookingV2Keys.capabilities,
    queryFn: async () => {
      try {
        return { enabled: true, capabilities: await getBookingV2Capabilities() };
      } catch (error) {
        if (error?.response?.status === 404) return { enabled: false, capabilities: null };
        throw error;
      }
    },
    staleTime: 60_000,
    retry: (count, error) => error?.response?.status !== 404 && count < 1,
  });

  const value = useMemo(() => {
    const capabilities = query.data?.capabilities ?? null;
    return {
      enabled: query.data?.enabled === true,
      loading: query.isLoading,
      error: query.error ?? null,
      timezone: capabilities?.timezone
        ?? capabilities?.business_timezone
        ?? capabilities?.salon?.timezone
        ?? "Africa/Accra",
      refresh: query.refetch,
    };
  }, [query.data, query.error, query.isLoading, query.refetch]);

  return <BookingV2Context.Provider value={value}>{children}</BookingV2Context.Provider>;
}
