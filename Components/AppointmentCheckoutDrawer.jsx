import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Spin, message } from "antd";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCreditCard,
  FiFileText,
  FiGift,
  FiPlus,
  FiRefreshCw,
  FiScissors,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import {
  createAppointmentAddon,
  finalizeAppointmentSettlement,
  getAppointmentAddons,
  getAppointmentFinancialSummary,
  getAppointmentReceipts,
  getCheckoutAppointment,
  recordAppointmentPayment,
  updateCheckoutStatus,
  voidAppointmentAddon,
} from "../src/api/appointmentCheckout";
import {
  firstApiErrorMessage,
  getApiError,
  isIntegrationError,
  normalizePortalIssues,
} from "../src/api/apiErrors";
import "./AppointmentCheckoutDrawer.css";
import PortalSelect from "./PortalSelect";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "card_terminal", label: "Card terminal" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

const REFERENCE_METHODS = new Set([
  "mobile_money",
  "card_terminal",
  "bank_transfer",
]);

const MAX_ADDONS = 20;

const emptyAddonLine = () => ({
  clientId: makeKey(),
  serviceId: "",
  optionId: "",
  staffId: "",
  performedAt: dayjs().format("YYYY-MM-DDTHH:mm"),
  idempotencyKey: makeKey(),
  sentFingerprint: null,
});

function makeKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.addons)) return raw.addons;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function amount(value) {
  const parsed = Number(String(value ?? "0").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: currency || "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount(value));
}

function isNoPaymentRequired(summary) {
  return Boolean(
    summary &&
    amount(summary.total_amount_due) === 0 &&
    amount(summary.total_amount_paid) === 0,
  );
}

function lineAmount(value, currency = "GHS", fallback = "Included") {
  if (value === null || value === undefined || value === "") return fallback;
  return amount(value) === 0 ? "Free" : money(value, currency);
}

function readable(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function firstError(error, fallback) {
  return firstApiErrorMessage(error, fallback);
}

function requiresServiceOption(service = {}) {
  return [service.price_type, service.pricing_type, service.price_mode]
    .some((value) => String(value || "").toLowerCase() === "from") ||
    service.is_from_price === true;
}

function lineFingerprint(line) {
  return JSON.stringify({
    serviceId: line.serviceId,
    optionId: line.optionId,
    staffId: line.staffId,
    performedAt: line.performedAt,
  });
}

function clientIssue(addonIndex, field, message) {
  return {
    scope: "addon",
    addonIndex,
    field,
    message,
    code: "client_validation",
    action: "correct",
  };
}

function retryAfterMilliseconds(error) {
  const raw = error?.response?.headers?.["retry-after"];
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const retryAt = Date.parse(raw);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : 0;
}

function serviceOptions(service = {}) {
  return normalizeList(
    service.service_options ?? service.options ?? service.service_option_details ?? [],
  ).filter((option) => option?.is_active !== false);
}

function assignedStaffIds(service = {}) {
  const values = [
    ...(service.assigned_staff_ids ?? []),
    ...(service.staff_ids ?? []),
    ...(Array.isArray(service.assigned_staff) ? service.assigned_staff : []),
  ];
  return values
    .map((item) => item?.id ?? item?.user_id ?? item?.account_id ?? item)
    .filter((item) => item !== null && item !== undefined)
    .map(String);
}

function staffMatches(person = {}, id) {
  const needle = String(id);
  return [person.id, person.user, person.user_id, person.account_id]
    .some((candidate) => String(candidate) === needle);
}

function customerName(appointment = {}, booking = {}) {
  const customer =
    appointment.customer_details ?? appointment.customer ?? appointment.guest ??
    appointment.guest_customer ?? booking.client;
  if (typeof customer === "string") return customer;
  return (
    customer?.full_name ||
    customer?.name ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    appointment.customer_name ||
    booking.client ||
    "Walk-in customer"
  );
}

function originalServices(appointment = {}, booking = {}) {
  const rows = normalizeList(
    appointment.services ?? appointment.appointment_services ?? booking.services ?? [],
  );
  if (rows.length) return rows;
  return booking.service ? [{ service_name: booking.service }] : [];
}

function serviceLineName(service = {}) {
  const name =
    service.service_name_snapshot || service.service_name || service.name ||
    service.service?.name || "Service";
  const option =
    service.service_option_name_snapshot || service.service_option_name ||
    service.option_name || service.service_option?.name;
  return option ? `${name} · ${option}` : name;
}

function ProgressRail({ status, summary }) {
  const paid = amount(summary?.remaining_amount_due) === 0 && Boolean(summary);
  const complimentary = isNoPaymentRequired(summary);
  const steps = [
    { label: "Arrived", done: ["arrived", "completed"].includes(status) },
    { label: "Services", done: ["arrived", "completed"].includes(status) },
    { label: complimentary ? "No payment" : "Paid", done: paid },
    { label: "Complete", done: status === "completed" },
  ];
  const firstPending = steps.findIndex((step) => !step.done);

  return (
    <ol className="checkout-progress" aria-label="Checkout progress">
      {steps.map((step, index) => {
        const current = index === firstPending;
        return (
          <li key={step.label} className={step.done ? "is-done" : current ? "is-current" : ""}>
            <span>{step.done ? <FiCheck size={12} /> : index + 1}</span>
            <small>{step.label}</small>
          </li>
        );
      })}
    </ol>
  );
}

function MoneyRow({ label, value, strong = false, muted = false, currency }) {
  return (
    <div className={`checkout-money-row ${strong ? "is-strong" : ""} ${muted ? "is-muted" : ""}`}>
      <span>{label}</span>
      <b>{money(value, currency)}</b>
    </div>
  );
}

export default function AppointmentCheckoutDrawer({
  booking,
  allServices = [],
  allStaff = [],
  onClose,
  onStatusChange,
  onReschedule,
  rescheduleLoading,
  onCancel,
  cancelLoading,
}) {
  const bookingId = booking?.id;
  const queryClient = useQueryClient();
  const addonPanelRef = useRef(null);
  const addonSummaryRef = useRef(null);
  const [statusOverride, setStatusOverride] = useState(null);
  const [showAddonForm, setShowAddonForm] = useState(false);
  const [addonLines, setAddonLines] = useState(() => [emptyAddonLine()]);
  const [addonIssues, setAddonIssues] = useState([]);
  const [addonErrorMeta, setAddonErrorMeta] = useState(null);
  const [addonRetryAt, setAddonRetryAt] = useState(0);
  const [addonOutcomeAmbiguous, setAddonOutcomeAmbiguous] = useState(false);
  const [pendingAddon, setPendingAddon] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [pendingVoid, setPendingVoid] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    managerConfirmed: false,
  });
  const [pendingPayment, setPendingPayment] = useState(null);
  const [validatingPayment, setValidatingPayment] = useState(false);
  const [pendingFinalizeKey, setPendingFinalizeKey] = useState(null);
  const [showScheduleActions, setShowScheduleActions] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    date:
      booking?.date ||
      booking?.raw?.scheduled_start?.slice(0, 10) ||
      booking?.raw?.appointment_date ||
      dayjs().format("YYYY-MM-DD"),
    time: booking?.startTime || "09:00",
    staffId: booking?.staffId || "",
    reason: "",
  });

  const appointmentQ = useQuery({
    queryKey: ["checkout-appointment", bookingId],
    queryFn: () => getCheckoutAppointment(bookingId),
    enabled: Boolean(bookingId),
    staleTime: 10_000,
  });
  const addonsQ = useQuery({
    queryKey: ["appointment-addons", bookingId],
    queryFn: () => getAppointmentAddons(bookingId),
    enabled: Boolean(bookingId),
    staleTime: 5_000,
  });
  const summaryQ = useQuery({
    queryKey: ["appointment-financial-summary", bookingId],
    queryFn: () => getAppointmentFinancialSummary(bookingId),
    enabled: Boolean(bookingId),
    staleTime: 5_000,
  });

  const appointment = useMemo(
    () => appointmentQ.data ?? booking?.raw ?? booking ?? {},
    [appointmentQ.data, booking],
  );
  const localStatus = String(
    statusOverride ?? appointment?.status ?? booking?.status ?? "pending",
  ).toLowerCase();
  const summary = summaryQ.data;
  const addons = useMemo(() => normalizeList(addonsQ.data), [addonsQ.data]);
  const services = useMemo(() => originalServices(appointment, booking), [appointment, booking]);
  const reference =
    summary?.appointment_reference || appointment.appointment_reference ||
    appointment.reference || `#${bookingId}`;
  const currency = summary?.currency || "GHS";
  const remaining = amount(summary?.remaining_amount_due);
  const overpaid = amount(summary?.overpaid_amount);
  const noPaymentRequired = isNoPaymentRequired(summary);
  const finalized = Boolean(summary?.is_finalized || localStatus === "completed");
  const terminalStatus = ["completed", "no-show", "no_show", "cancelled"].includes(localStatus);
  const canCheckIn = localStatus === "confirmed";

  const receiptsQ = useQuery({
    queryKey: ["appointment-receipts", bookingId],
    queryFn: () => getAppointmentReceipts(bookingId),
    enabled: Boolean(bookingId && finalized),
    staleTime: 30_000,
  });
  const receipts = useMemo(() => normalizeList(receiptsQ.data), [receiptsQ.data]);

  const catalog = useMemo(
    () => allServices.filter((service) => service?.is_active !== false),
    [allServices],
  );
  const eligibleStaffFor = (service) => {
    const ids = assignedStaffIds(service);
    const activeStaff = allStaff.filter((person) =>
      person?.is_active !== false &&
      person?.active !== false &&
      !["inactive", "disabled"].includes(String(person?.status || "").toLowerCase()),
    );
    if (!ids.length) return activeStaff;
    return activeStaff.filter((person) => ids.some((id) => staffMatches(person, id)));
  };
  const canAdd = localStatus === "arrived" && !finalized;
  const isLoading = appointmentQ.isLoading || summaryQ.isLoading || addonsQ.isLoading;

  const addonFieldIssue = (index, field) => addonIssues.find(
    (issue) => issue.field === field && (
      (issue.scope === "addon" && issue.addonIndex === index) || issue.scope === "batch"
    ),
  );
  const addonRowIssues = (index) => addonIssues.filter(
    (issue) => (issue.scope === "addon" && issue.addonIndex === index) ||
      (issue.scope === "batch" && Boolean(issue.field)),
  );
  const appointmentAddonIssue = addonIssues.find((issue) => issue.scope === "appointment");
  const addonSubmissionBlocked = Boolean(appointmentAddonIssue) || addonIssues.some(
    (issue) => issue.action === "sign_in" || issue.action === "contact_manager",
  ) || [405, 415].includes(addonErrorMeta?.status);

  useEffect(() => {
    if (!addonIssues.length || !showAddonForm) return;
    const first = addonIssues[0];
    const targetIndex = first.scope === "addon" ? first.addonIndex : first.field ? 0 : undefined;
    const control = targetIndex !== undefined
      ? addonPanelRef.current?.querySelector(
          `[data-addon-index="${targetIndex}"] [data-addon-field="${first.field}"] .portal-select input, ` +
          `[data-addon-index="${targetIndex}"] [data-addon-field="${first.field}"] select, ` +
          `[data-addon-index="${targetIndex}"] [data-addon-field="${first.field}"] input`,
        )
      : null;
    requestAnimationFrame(() => (control ?? addonSummaryRef.current)?.focus());
  }, [addonIssues, showAddonForm]);

  useEffect(() => {
    if (!addonRetryAt) return undefined;
    const wait = Math.max(0, addonRetryAt - Date.now());
    const timer = setTimeout(() => setAddonRetryAt(0), wait);
    return () => clearTimeout(timer);
  }, [addonRetryAt]);

  const refreshCheckout = async () => {
    await Promise.all([
      appointmentQ.refetch(),
      addonsQ.refetch(),
      summaryQ.refetch(),
      queryClient.invalidateQueries({ queryKey: ["appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["appointment-transactions"] }),
    ]);
  };

  const reconcileAddonOutcome = async () => {
    await refreshCheckout();
    setAddonOutcomeAmbiguous(false);
    setPendingAddon(null);
    setAddonIssues([]);
    setAddonErrorMeta(null);
    setAddonRetryAt(0);
    message.info("Appointment services and balance refreshed. Review the preserved draft before saving again.");
  };

  const checkInMutation = useMutation({
    mutationFn: () => updateCheckoutStatus(bookingId, "arrived"),
    onSuccess: async () => {
      setStatusOverride("arrived");
      await refreshCheckout();
    },
    onError: (error) => message.error(firstError(error, "Could not check in this customer.")),
  });

  const addonMutation = useMutation({
    mutationFn: (operation) => createAppointmentAddon(bookingId, operation.payload),
    onSuccess: async (result) => {
      const savedAddons = normalizeList(result?.addons);
      const savedSummary = result?.financial_summary;
      if (savedAddons.length || Array.isArray(result?.addons)) {
        queryClient.setQueryData(["appointment-addons", bookingId], savedAddons);
      }
      if (savedSummary) {
        queryClient.setQueryData(["appointment-financial-summary", bookingId], savedSummary);
      }
      setPendingAddon(null);
      setAddonLines([emptyAddonLine()]);
      setAddonIssues([]);
      setAddonErrorMeta(null);
      setAddonRetryAt(0);
      setAddonOutcomeAmbiguous(false);
      setShowAddonForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["appointment-transactions"] }),
      ]);
    },
    onError: async (error, operation) => {
      const meta = getApiError(error);
      const issues = normalizePortalIssues(error, {
        addonCount: operation?.payload?.addons?.length ?? addonLines.length,
      });
      const ambiguous = meta.isNetworkError || (meta.status !== null && meta.status >= 500);
      setAddonIssues(issues);
      setAddonErrorMeta(meta);
      setAddonRetryAt(meta.status === 429 ? Date.now() + retryAfterMilliseconds(error) : 0);
      setAddonOutcomeAmbiguous(ambiguous);

      if (isIntegrationError(error)) {
        console.error("Add-on integration error", {
          status: meta.status,
          code: meta.code,
          endpoint: `/api/portal/v1/booking/appointments/${bookingId}/addons/`,
          requestId: meta.requestId,
        });
      }

      if (meta.status === 404) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["services"] }),
          queryClient.invalidateQueries({ queryKey: ["staff"] }),
          refreshCheckout(),
        ]);
      }

      if (issues.some((issue) => issue.field === "idempotency_key")) {
        await refreshCheckout();
      }

      message.error(issues[0]?.message || "The selected services could not be saved.");
    },
  });
  const addonFormLocked = addonMutation.isPending || addonOutcomeAmbiguous;

  const voidMutation = useMutation({
    mutationFn: (operation) =>
      voidAppointmentAddon(bookingId, operation.addonId, operation.payload),
    onSuccess: async () => {
      setPendingVoid(null);
      setVoidTarget(null);
      setVoidReason("");
      await refreshCheckout();
    },
    onError: (error) => message.error(firstError(error, "Could not void the add-on.")),
  });

  const paymentMutation = useMutation({
    mutationFn: (operation) => recordAppointmentPayment(bookingId, operation.payload),
    onSuccess: async (payment) => {
      setPendingPayment(null);
      const nextBalance = amount(payment.appointment_remaining_balance_amount);
      await refreshCheckout();
      if (nextBalance > 0) {
        setPaymentForm({ amount: nextBalance.toFixed(2), method: "cash", reference: "", managerConfirmed: false });
      } else {
        setShowPayment(false);
        setPaymentForm({ amount: "", method: "cash", reference: "", managerConfirmed: false });
      }
    },
    onError: (error) => message.error(firstError(error, "Payment outcome is unknown. Retry with the preserved operation.")),
  });

  const finalizeMutation = useMutation({
    mutationFn: async (idempotencyKey) => {
      const fresh = await getAppointmentFinancialSummary(bookingId);
      if (amount(fresh.remaining_amount_due) > 0) {
        const error = new Error(`${money(fresh.remaining_amount_due, fresh.currency)} remains to be collected.`);
        error.code = "BALANCE_REMAINS";
        throw error;
      }
      if (amount(fresh.overpaid_amount) > 0) {
        const error = new Error("Resolve the overpayment before completing this appointment.");
        error.code = "OVERPAID";
        throw error;
      }
      if (String(fresh.settlement_status).toLowerCase() !== "paid") {
        const error = new Error("The server has not marked this settlement as paid. Refresh before completing.");
        error.code = "SETTLEMENT_NOT_READY";
        throw error;
      }
      if (!fresh.is_finalized) {
        await finalizeAppointmentSettlement(bookingId, { idempotency_key: idempotencyKey });
      }
      return updateCheckoutStatus(bookingId, "completed");
    },
    onSuccess: async () => {
      setPendingFinalizeKey(null);
      setStatusOverride("completed");
      await refreshCheckout();
      receiptsQ.refetch();
    },
    onError: async (error) => {
      message.error(firstError(error, error.message || "Could not complete the appointment."));
      await summaryQ.refetch();
      if (error.code === "BALANCE_REMAINS") openPaymentPanel();
    },
  });

  function openPaymentPanel() {
    setShowPayment(true);
    setShowAddonForm(false);
    setPaymentForm({
      amount: remaining.toFixed(2),
      method: "cash",
      reference: "",
      managerConfirmed: false,
    });
  }

  function updateAddonLine(index, changes) {
    setAddonLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const next = { ...line, ...changes };
      if (line.sentFingerprint && lineFingerprint(next) !== line.sentFingerprint) {
        next.idempotencyKey = makeKey();
        next.sentFingerprint = null;
      }
      return next;
    }));
    setAddonIssues((current) => current.filter((issue) => {
      if (issue.scope !== "addon" || issue.addonIndex !== index) return true;
      return !Object.keys(changes).some((key) => ({
        serviceId: "service_id",
        optionId: "service_option_id",
        staffId: "staff_member_id",
        performedAt: "performed_at",
      })[key] === issue.field);
    }));
    setAddonOutcomeAmbiguous(false);
    setAddonErrorMeta(null);
    setAddonRetryAt(0);
    setPendingAddon(null);
  }

  function addAddonLine() {
    if (addonLines.length >= MAX_ADDONS) return;
    setAddonLines((current) => [...current, emptyAddonLine()]);
    setAddonIssues([]);
    setAddonErrorMeta(null);
    setAddonRetryAt(0);
  }

  function removeAddonLine(index) {
    if (addonLines.length === 1) return;
    setAddonLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
    setAddonIssues([]);
    setAddonErrorMeta(null);
    setAddonRetryAt(0);
    setAddonOutcomeAmbiguous(false);
    setPendingAddon(null);
  }

  function submitAddon() {
    const clientIssues = [];
    if (!addonLines.length || addonLines.length > MAX_ADDONS) {
      clientIssues.push({
        scope: "batch",
        message: `Select between 1 and ${MAX_ADDONS} services.`,
        code: "client_validation",
        action: "correct",
      });
    }

    addonLines.forEach((line, index) => {
      const service = catalog.find((item) => String(item.id) === String(line.serviceId));
      const options = serviceOptions(service);
      const option = options.find((item) => String(item.id) === String(line.optionId));
      const eligibleStaff = eligibleStaffFor(service);
      const staffIsEligible = !line.staffId || eligibleStaff.some((person) => staffMatches(person, line.staffId));

      if (!service) clientIssues.push(clientIssue(index, "service_id", "Choose an active service."));
      if (service && (!Number.isInteger(Number(service.id)) || Number(service.id) <= 0)) {
        clientIssues.push(clientIssue(index, "service_id", "Choose a valid service."));
      }
      if (service && requiresServiceOption(service) && !option) {
        clientIssues.push(clientIssue(index, "service_option_id", "Choose a service option."));
      }
      if (line.optionId && !option) {
        clientIssues.push(clientIssue(index, "service_option_id", "Choose an available option for this service."));
      }
      if (option && (!Number.isInteger(Number(option.id)) || Number(option.id) <= 0)) {
        clientIssues.push(clientIssue(index, "service_option_id", "Choose a valid service option."));
      }
      if (!staffIsEligible) {
        clientIssues.push(clientIssue(index, "staff_member_id", "Choose an eligible team member or leave this unassigned."));
      }
      if (line.staffId && (!Number.isInteger(Number(line.staffId)) || Number(line.staffId) <= 0)) {
        clientIssues.push(clientIssue(index, "staff_member_id", "Choose a valid team member or leave this unassigned."));
      }
      if (line.performedAt && !dayjs(line.performedAt).isValid()) {
        clientIssues.push(clientIssue(index, "performed_at", "Enter a valid performance time."));
      }
    });

    if (clientIssues.length) {
      setAddonIssues(clientIssues);
      return;
    }

    const payload = {
      addons: addonLines.map((line) => {
        const addon = {
          service_id: Number(line.serviceId),
          idempotency_key: line.idempotencyKey,
        };
        if (line.optionId) addon.service_option_id = Number(line.optionId);
        if (line.staffId) addon.staff_member_id = Number(line.staffId);
        if (line.performedAt) addon.performed_at = dayjs(line.performedAt).toISOString();
        return addon;
      }),
    };
    const operation = { payload };
    setAddonLines((current) => current.map((line) => ({
      ...line,
      sentFingerprint: lineFingerprint(line),
    })));
    setAddonIssues([]);
    setAddonErrorMeta(null);
    setAddonRetryAt(0);
    setAddonOutcomeAmbiguous(false);
    setPendingAddon(operation);
    addonMutation.mutate(operation);
  }

  function submitVoid() {
    if (!voidTarget || !voidReason.trim()) return message.error("Enter a reason for the audit trail.");
    const operation = {
      addonId: voidTarget.public_id ?? voidTarget.id ?? voidTarget.addon_id,
      payload: { reason: voidReason.trim(), idempotency_key: makeKey() },
    };
    setPendingVoid(operation);
    voidMutation.mutate(operation);
  }

  async function submitPayment() {
    const value = amount(paymentForm.amount);
    if (value <= 0) return message.error("Enter an amount greater than zero.");
    if (REFERENCE_METHODS.has(paymentForm.method) && !paymentForm.reference.trim()) {
      return message.error("Enter the provider or terminal reference.");
    }
    setValidatingPayment(true);
    try {
      const fresh = await getAppointmentFinancialSummary(bookingId);
      queryClient.setQueryData(["appointment-financial-summary", bookingId], fresh);
      const freshRemaining = amount(fresh.remaining_amount_due);
      if (freshRemaining <= 0) {
        setShowPayment(false);
        return message.info(
          isNoPaymentRequired(fresh)
            ? "No payment is required for this appointment."
            : "This appointment balance is already settled.",
        );
      }
      if (value > freshRemaining && !paymentForm.managerConfirmed) {
        return message.error(`The balance is now ${money(freshRemaining, fresh.currency)}. Review the amount or obtain manager confirmation.`);
      }
      const payload = {
        amount: value.toFixed(2),
        payment_method: paymentForm.method,
        idempotency_key: makeKey(),
      };
      if (paymentForm.reference.trim()) payload.external_reference = paymentForm.reference.trim();
      const operation = { payload };
      setPendingPayment(operation);
      paymentMutation.mutate(operation);
    } catch (error) {
      message.error(firstError(error, "Could not verify the current balance. No payment was recorded."));
    } finally {
      setValidatingPayment(false);
    }
  }

  function finalizeAndComplete() {
    const key = pendingFinalizeKey || makeKey();
    setPendingFinalizeKey(key);
    finalizeMutation.mutate(key);
  }

  const activeAddons = addons.filter((addon) => addon.status !== "voided" && !addon.voided_at);
  const voidedAddons = addons.filter((addon) => addon.status === "voided" || addon.voided_at);
  const paymentOverage = Math.max(0, amount(paymentForm.amount) - remaining);
  const source = String(appointment.booking_source || booking?.booking_source || "walk-in").toLowerCase();

  return (
    <div className="checkout-overlay" role="presentation" onMouseDown={onClose}>
      <aside className="checkout-drawer" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="checkout-header">
          <div className="checkout-header-copy">
            <span className="checkout-kicker">Appointment checkout</span>
            <h2 id="checkout-title">{customerName(appointment, booking)}</h2>
            <div className="checkout-meta">
              <span>{reference}</span>
              <span>•</span>
              <span>{source === "online" ? "Mobile app" : source === "walk-in" ? "Walk-in" : readable(source)}</span>
              <span className={`checkout-status status-${localStatus}`}>{readable(localStatus)}</span>
            </div>
          </div>
          <button className="checkout-icon-button on-dark" onClick={onClose} aria-label="Close checkout"><FiX /></button>
          <ProgressRail status={localStatus} summary={summary} />
        </header>

        {isLoading ? (
          <div className="checkout-loading"><Spin /><p>Preparing the appointment checkout…</p></div>
        ) : (
          <div className="checkout-layout">
            <main className="checkout-main">
              {summaryQ.isError && (
                <div className="checkout-alert error">
                  <FiAlertCircle />
                  <div><b>Financial summary unavailable</b><p>{firstError(summaryQ.error, "Refresh and try again.")}</p></div>
                  <button onClick={() => summaryQ.refetch()}><FiRefreshCw /> Retry</button>
                </div>
              )}

              {canCheckIn && (
                <section className="checkout-callout">
                  <div className="checkout-callout-icon"><FiUser /></div>
                  <div><span>First step</span><h3>Check in the customer</h3><p>Add-ons and checkout unlock after arrival is confirmed.</p></div>
                  <button className="checkout-primary compact" onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending}>
                    {checkInMutation.isPending ? "Checking in…" : "Check in customer"}<FiArrowRight />
                  </button>
                </section>
              )}

              <section className="checkout-section">
                <div className="checkout-section-heading">
                  <div><span>Service sheet</span><h3>What was delivered</h3></div>
                  {canAdd && <button className="checkout-text-button" onClick={() => { setShowAddonForm((value) => !value); setShowPayment(false); }}><FiPlus /> Add service</button>}
                </div>

                <div className="checkout-lines">
                  {services.map((service, index) => (
                    <div className="checkout-service-line" key={service.id ?? service.service_id ?? index}>
                      <div className="checkout-line-icon"><FiScissors /></div>
                      <div className="checkout-line-copy"><b>{serviceLineName(service)}</b><span>Original booking{service.staff_name ? ` · ${service.staff_name}` : ""}</span></div>
                      <strong>{lineAmount(service.total ?? service.price, currency, noPaymentRequired ? "Free" : "Included")}</strong>
                    </div>
                  ))}
                  {!services.length && <div className="checkout-empty">No original service lines were returned for this appointment.</div>}
                  {activeAddons.map((addon) => (
                    <div className="checkout-service-line addon" key={addon.public_id ?? addon.id}>
                      <div className="checkout-line-icon"><FiPlus /></div>
                      <div className="checkout-line-copy"><b>{serviceLineName(addon)}</b><span>Add-on · {addon.performed_at ? dayjs(addon.performed_at).format("h:mm A") : "Recorded today"}</span></div>
                      <strong>{lineAmount(addon.gross_total, addon.currency || currency)}</strong>
                      {canAdd && <button className="checkout-void-button" onClick={() => { setVoidTarget(addon); setVoidReason(""); }} aria-label={`Void ${serviceLineName(addon)}`}>Void</button>}
                    </div>
                  ))}
                </div>

                {showAddonForm && canAdd && (
                  <div className="checkout-form-panel" ref={addonPanelRef}>
                    <div className="checkout-form-title">
                      <div><span>New add-ons</span><h4>Record services delivered today</h4></div>
                      <button className="checkout-icon-button" onClick={() => setShowAddonForm(false)} aria-label="Close add-on form"><FiX /></button>
                    </div>

                    <p className="checkout-addon-intro">Add up to {MAX_ADDONS} services in one save. Prices and the updated balance are confirmed by the server.</p>

                    {addonIssues.length > 0 && (
                      <div className="checkout-validation-summary" role="alert" tabIndex={-1} ref={addonSummaryRef}>
                        <FiAlertCircle />
                        <div>
                          <b>Services not saved</b>
                          <ul>{[...new Set(addonIssues.map((issue) => issue.message))].map((text) => <li key={text}>{text}</li>)}</ul>
                          {addonOutcomeAmbiguous && <p>Retry the exact request below, or refresh the appointment before making changes.</p>}
                          {addonErrorMeta?.requestId && <small>Support request: {addonErrorMeta.requestId}</small>}
                        </div>
                      </div>
                    )}

                    <div className="checkout-addon-list">
                      {addonLines.map((line, index) => {
                        const selectedService = catalog.find((service) => String(service.id) === String(line.serviceId));
                        const options = serviceOptions(selectedService);
                        const needsOption = requiresServiceOption(selectedService);
                        const eligibleStaff = eligibleStaffFor(selectedService);
                        const rowIssues = addonRowIssues(index);
                        const serviceIssue = addonFieldIssue(index, "service_id");
                        const optionIssue = addonFieldIssue(index, "service_option_id");
                        const staffIssue = addonFieldIssue(index, "staff_member_id");
                        const performedIssue = addonFieldIssue(index, "performed_at");

                        return (
                          <fieldset className={`checkout-addon-card ${rowIssues.length ? "has-error" : ""}`} key={line.clientId} data-addon-index={index} disabled={addonFormLocked}>
                            <legend><span>{String(index + 1).padStart(2, "0")}</span> Service</legend>
                            {addonLines.length > 1 && (
                              <button type="button" className="checkout-addon-remove" onClick={() => removeAddonLine(index)} disabled={addonFormLocked} aria-label={`Remove service ${index + 1}`}><FiX /></button>
                            )}
                            <div className="checkout-form-grid">
                              <label className={`span-2 ${serviceIssue ? "has-error" : ""}`} data-addon-field="service_id">
                                Service <em>Required</em>
                                <PortalSelect value={line.serviceId} disabled={addonFormLocked} aria-invalid={Boolean(serviceIssue)} onChange={(event) => {
                                  const serviceId = event.target.value;
                                  const service = catalog.find((item) => String(item.id) === String(serviceId));
                                  const allowedStaff = eligibleStaffFor(service);
                                  const keepStaff = line.staffId && allowedStaff.some((person) => staffMatches(person, line.staffId));
                                  updateAddonLine(index, { serviceId, optionId: "", staffId: keepStaff ? line.staffId : "" });
                                }}><option value="">Choose a service…</option>{catalog.map((service) => <option key={service.id} value={service.id}>{service.name || `Service #${service.id}`}</option>)}</PortalSelect>
                                {serviceIssue && <small className="checkout-field-error">{serviceIssue.message}</small>}
                              </label>

                              {(selectedService && (options.length > 0 || needsOption)) && (
                                <label className={`span-2 ${optionIssue ? "has-error" : ""}`} data-addon-field="service_option_id">
                                  Service option {needsOption && <em>Required</em>}
                                  <PortalSelect value={line.optionId} disabled={addonFormLocked} aria-invalid={Boolean(optionIssue)} onChange={(event) => updateAddonLine(index, { optionId: event.target.value })}>
                                    <option value="">{needsOption ? "Choose an option…" : "Use standard service"}</option>
                                    {options.map((option) => <option key={option.id} value={option.id}>{option.name || `Option #${option.id}`}</option>)}
                                  </PortalSelect>
                                  {optionIssue && <small className="checkout-field-error">{optionIssue.message}</small>}
                                </label>
                              )}

                              <label className={staffIssue ? "has-error" : ""} data-addon-field="staff_member_id">
                                Performed by <span className="checkout-optional">Optional</span>
                                <PortalSelect value={line.staffId} disabled={addonFormLocked} aria-invalid={Boolean(staffIssue)} onChange={(event) => updateAddonLine(index, { staffId: event.target.value })}>
                                  <option value="">Not assigned</option>
                                  {eligibleStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.name || `Staff #${person.id}`}</option>)}
                                </PortalSelect>
                                {staffIssue && <small className="checkout-field-error">{staffIssue.message}</small>}
                              </label>

                              <label className={performedIssue ? "has-error" : ""} data-addon-field="performed_at">
                                Performed at <span className="checkout-optional">Optional</span>
                                <input type="datetime-local" value={line.performedAt} aria-invalid={Boolean(performedIssue)} onChange={(event) => updateAddonLine(index, { performedAt: event.target.value })} />
                                {performedIssue && <small className="checkout-field-error">{performedIssue.message}</small>}
                              </label>
                            </div>
                            {rowIssues.some((issue) => !issue.field) && <p className="checkout-row-error">{rowIssues.find((issue) => !issue.field)?.message}</p>}
                          </fieldset>
                        );
                      })}
                    </div>

                    <div className="checkout-addon-actions">
                      <button type="button" className="checkout-text-button" onClick={addAddonLine} disabled={addonFormLocked || addonLines.length >= MAX_ADDONS}><FiPlus /> Add another service</button>
                      <span>{addonLines.length} / {MAX_ADDONS}</span>
                    </div>

                    {addonMutation.isError && pendingAddon && (
                      <button className="checkout-retry" onClick={() => addonMutation.mutate(pendingAddon)} disabled={addonMutation.isPending || addonRetryAt > Date.now() || addonSubmissionBlocked}>
                        <FiRefreshCw /> {addonRetryAt > Date.now() ? "Retry when the wait period ends" : `Retry the exact ${pendingAddon.payload.addons.length === 1 ? "service" : `${pendingAddon.payload.addons.length} services`}`}
                      </button>
                    )}
                    {addonOutcomeAmbiguous && <button className="checkout-retry" onClick={reconcileAddonOutcome}><FiRefreshCw /> Refresh and reconcile appointment</button>}
                    {appointmentAddonIssue && !addonOutcomeAmbiguous && <button className="checkout-retry" onClick={reconcileAddonOutcome}><FiRefreshCw /> Refresh appointment</button>}
                    <button className="checkout-primary" onClick={submitAddon} disabled={addonFormLocked || addonSubmissionBlocked}>
                      {addonMutation.isPending ? "Adding services…" : `Add ${addonLines.length} ${addonLines.length === 1 ? "service" : "services"}`}
                    </button>
                  </div>
                )}

                {voidedAddons.length > 0 && (
                  <details className="checkout-history"><summary><span>Voided services ({voidedAddons.length})</span><FiChevronDown /></summary>{voidedAddons.map((addon) => <div key={addon.public_id ?? addon.id}><span>{serviceLineName(addon)}</span><del>{money(addon.gross_total, addon.currency || currency)}</del></div>)}</details>
                )}
              </section>

              {!terminalStatus && <details className="checkout-secondary-actions" open={showScheduleActions} onToggle={(event) => setShowScheduleActions(event.currentTarget.open)}>
                <summary>Schedule and appointment actions <FiChevronDown /></summary>
                <div className="checkout-secondary-body">
                  <div className="checkout-form-grid">
                    <label>Date<input type="date" value={rescheduleForm.date} onChange={(event) => setRescheduleForm((current) => ({ ...current, date: event.target.value }))} /></label>
                    <label>Time<input type="time" value={rescheduleForm.time} onChange={(event) => setRescheduleForm((current) => ({ ...current, time: event.target.value }))} /></label>
                    <label className="span-2">Team member<PortalSelect value={rescheduleForm.staffId} onChange={(event) => setRescheduleForm((current) => ({ ...current, staffId: event.target.value }))}><option value="">Choose staff…</option>{allStaff.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.name}</option>)}</PortalSelect></label>
                    <label className="span-2">Reason<input value={rescheduleForm.reason} onChange={(event) => setRescheduleForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Optional note" /></label>
                  </div>
                  <div className="checkout-secondary-buttons">
                    <button onClick={() => onReschedule?.(bookingId, rescheduleForm.date, rescheduleForm.time, Number(rescheduleForm.staffId), rescheduleForm.reason)} disabled={rescheduleLoading || !rescheduleForm.staffId}><FiClock /> {rescheduleLoading ? "Rescheduling…" : "Reschedule"}</button>
                    <button onClick={() => { setStatusOverride("no_show"); onStatusChange?.(bookingId, "no_show"); }}><FiUser /> Mark no-show</button>
                    <button className="danger" onClick={() => { if (window.confirm("Cancel this appointment?")) onCancel?.(bookingId); }} disabled={cancelLoading}><FiTrash2 /> {cancelLoading ? "Cancelling…" : "Cancel appointment"}</button>
                  </div>
                </div>
              </details>}
            </main>

            <aside className="checkout-balance-rail">
              <div className="checkout-balance-heading"><span>Live balance</span><div className={`checkout-payment-state ${noPaymentRequired ? "state-free" : `state-${summary?.settlement_status || "unpaid"}`}`}>{noPaymentRequired ? "No payment required" : readable(summary?.settlement_status || "unpaid")}</div></div>
              <div className={`checkout-amount-due ${noPaymentRequired ? "is-free" : ""}`}><span>{noPaymentRequired ? "Complimentary appointment" : remaining > 0 ? "Amount to collect" : "Balance settled"}</span><strong>{money(remaining, currency)}</strong><small>{noPaymentRequired ? "Nothing is owed and no payment transaction will be created" : "Always calculated from the latest server summary"}</small></div>
              <div className="checkout-money-list">
                <MoneyRow label="Original services" value={summary?.original_net_total} currency={currency} />
                <MoneyRow label="Add-ons" value={summary?.active_addon_total} currency={currency} />
                <MoneyRow label="Total due" value={summary?.total_amount_due} strong currency={currency} />
                <MoneyRow label="Paid online" value={summary?.online_amount_paid} muted currency={currency} />
                <MoneyRow label="Paid on-site" value={summary?.salon_payments_received} muted currency={currency} />
                {amount(summary?.salon_payment_reversals) > 0 && <MoneyRow label="Reversals" value={summary?.salon_payment_reversals} muted currency={currency} />}
              </div>

              {noPaymentRequired && <div className="checkout-free-state"><FiGift /><div><b>No payment required</b><p>{localStatus === "completed" ? "This complimentary appointment was completed without recording a payment transaction." : localStatus === "arrived" ? "This booking is intentionally free. Finalize it without recording a cash or electronic payment." : "This booking is intentionally free. Nothing is owed by the customer."}</p></div></div>}

              {overpaid > 0 && <div className="checkout-alert warning"><FiAlertCircle /><div><b>Overpayment to resolve</b><p>{money(overpaid, currency)} must be reviewed before completion.</p></div></div>}

              {localStatus === "completed" ? (
                <div className="checkout-complete-card"><FiCheckCircle /><div><b>Appointment complete</b><span>The settlement is locked and ready for receipt.</span></div></div>
              ) : localStatus !== "arrived" ? null : showPayment && remaining > 0 ? (
                <div className="checkout-payment-form">
                  <div className="checkout-form-title"><div><span>New tender</span><h4>Record payment</h4></div><button className="checkout-icon-button" onClick={() => setShowPayment(false)}><FiX /></button></div>
                  <label>Amount ({currency})<input inputMode="decimal" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value, managerConfirmed: false }))} /></label>
                  <label>Payment method<PortalSelect value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value, reference: "" }))}>{PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</PortalSelect></label>
                  {REFERENCE_METHODS.has(paymentForm.method) && <label>Provider reference<input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Required after provider success" /></label>}
                  {paymentOverage > 0 && <label className="checkout-confirm"><input type="checkbox" checked={paymentForm.managerConfirmed} onChange={(event) => setPaymentForm((current) => ({ ...current, managerConfirmed: event.target.checked }))} /><span><b>Manager confirmed overpayment</b><small>This records {money(paymentOverage, currency)} more than the current balance.</small></span></label>}
                  <p className="checkout-payment-note">Electronic payments should only be recorded after the terminal or provider confirms success.</p>
                  {paymentMutation.isError && pendingPayment && <button className="checkout-retry" onClick={() => paymentMutation.mutate(pendingPayment)}><FiRefreshCw /> Retry preserved payment</button>}
                  <button className="checkout-primary" onClick={submitPayment} disabled={paymentMutation.isPending || validatingPayment}>{paymentMutation.isPending ? "Recording payment…" : validatingPayment ? "Verifying balance…" : `Record ${money(paymentForm.amount, currency)}`}</button>
                  <small className="checkout-split-note">For split tender, record each method separately. This panel stays open while a balance remains.</small>
                </div>
              ) : remaining > 0 ? (
                <button className="checkout-primary checkout-collect" onClick={openPaymentPanel} disabled={!summary}><FiCreditCard /> Collect {money(remaining, currency)}</button>
              ) : (
                <button className="checkout-primary checkout-complete" onClick={finalizeAndComplete} disabled={!summary || finalizeMutation.isPending || overpaid > 0}><FiCheckCircle /> {finalizeMutation.isPending ? "Finalizing…" : "Finalize and complete"}</button>
              )}

              {canCheckIn && <p className="checkout-disabled-note"><FiAlertCircle /> Check in the customer to unlock services and checkout.</p>}

              {localStatus === "completed" && (
                <div className="checkout-receipts">
                  <div className="checkout-receipts-title"><FiFileText /><span>Receipts</span></div>
                  {receiptsQ.isLoading ? <Spin size="small" /> : receipts.length ? receipts.map((receipt, index) => {
                    const href = receipt.pdf_url || receipt.url || receipt.download_url;
                    return href ? <a key={receipt.public_id ?? index} href={href} target="_blank" rel="noreferrer"><span>{receipt.receipt_reference || receipt.reference || `Receipt ${index + 1}`}</span><FiArrowRight /></a> : <div key={receipt.public_id ?? index}><span>{receipt.receipt_reference || receipt.reference || `Receipt ${index + 1}`}</span></div>;
                  }) : <p>Receipt generation may take a moment. Refresh to check again.</p>}
                </div>
              )}
            </aside>
          </div>
        )}

        {voidTarget && (
          <div className="checkout-mini-modal" role="dialog" aria-modal="true" aria-label="Void add-on">
            <div><span>Audit correction</span><h3>Void {serviceLineName(voidTarget)}?</h3><p>The line remains in history. Enter why it is being corrected.</p><textarea autoFocus value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="e.g. Wrong service option selected" />
              {voidMutation.isError && pendingVoid && <button className="checkout-retry" onClick={() => voidMutation.mutate(pendingVoid)}><FiRefreshCw /> Retry preserved void</button>}
              <div className="checkout-mini-actions"><button onClick={() => setVoidTarget(null)}>Keep service</button><button className="danger" onClick={submitVoid} disabled={voidMutation.isPending}>{voidMutation.isPending ? "Voiding…" : "Void add-on"}</button></div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
