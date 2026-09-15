import { useContext } from "react";
import BookingV2Context from "../context/bookingV2Context.js";

export function useBookingV2() {
  const value = useContext(BookingV2Context);
  if (!value) throw new Error("useBookingV2 must be used inside BookingV2Provider");
  return value;
}
