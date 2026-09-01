import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  message,
} from "antd";
import dayjs from "dayjs";
import { FiCreditCard, FiPlus, FiSearch } from "react-icons/fi";
import { createSalonPayment, getAppointmentTransactions, getTransactionAppointments } from "../src/api/transactions";
import { getAppointmentFinancialSummary } from "../src/api/appointmentCheckout";

const GOLD_BTN = "!bg-[#BBA14F] !border-none hover:!bg-[#a08340] !text-white";

const PAYMENT_METHOD_OPTIONS = [
  { label: "Cash", value: "cash" },
  { label: "Mobile Money", value: "mobile_money" },
  { label: "Card Terminal", value: "card_terminal" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Other", value: "other" },
];

const REFERENCE_METHODS = new Set(["mobile_money", "card_terminal", "bank_transfer"]);

function makeIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "GHS 0.00";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function isNoPaymentRequired(summary) {
  return Boolean(
    summary &&
    Number(summary.total_amount_due || 0) === 0 &&
    Number(summary.total_amount_paid || 0) === 0,
  );
}

function getTransactionCustomerName(item) {
  return (
    item?.customer_name ||
    item?.guest_customer?.full_name ||
    item?.customer_details?.full_name ||
    [item?.customer_details?.first_name, item?.customer_details?.last_name].filter(Boolean).join(" ") ||
    item?.customer?.full_name ||
    item?.customer?.name ||
    "Walk-in Client"
  );
}

function getTransactionAppointmentPaymentStatus(item) {
  return String(
    item?.appointment_payment_status ||
    item?.appointment?.appointment_payment_status ||
    item?.payment_status ||
    "—"
  )
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getTransactionPaymentRef(item) {
  return item?.payment_reference || item?.external_reference || item?.transaction_reference || item?.provider_reference || "—";
}

function getTransactionAmount(item) {
  return (
    item?.amount ??
    item?.paid_amount ??
    item?.payment_amount ??
    item?.total_amount ??
    item?.deposit_amount ??
    0
  );
}

function getTransactionType(item) {
  return String(item?.transaction_type || item?.payment_method || item?.channel || item?.method || "—")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getTransactionStatus(item) {
  return String(item?.payment_status || item?.status || "recorded")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getStatusStyle(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("success") || normalized.includes("paid") || normalized.includes("completed")) {
    return { background: "rgba(34,160,80,0.12)", color: "#1a8a40" };
  }
  if (normalized.includes("fail") || normalized.includes("void")) {
    return { background: "rgba(200,50,50,0.1)", color: "#c43232" };
  }
  return { background: "rgba(187,161,79,0.12)", color: "#8a6f2e" };
}

function getCustomerName(apt) {
  const c = apt?.customer_details ?? apt?.customer ?? apt?.client ?? null;
  if (typeof c === "string") return c;
  return (
    [c?.first_name, c?.last_name].filter(Boolean).join(" ") ||
    c?.full_name || c?.name ||
    apt?.customer_name || apt?.client_name || "Walk-in Client"
  );
}

function getAppointmentLabel(apt) {
  const name = getCustomerName(apt);
  const raw = apt?.scheduled_start;
  let dateLabel = "";
  if (raw) {
    const d = dayjs(raw);
    if (d.isValid()) dateLabel = d.format("DD MMM YYYY • h:mm A");
  }
  if (!dateLabel) {
    const dp = apt?.appointment_date || apt?.date;
    const tp = apt?.start_time || apt?.time;
    if (dp || tp) {
      const d = dayjs(`${dp || ""}T${String(tp || "09:00").slice(0, 5)}`);
      if (d.isValid()) dateLabel = d.format("DD MMM YYYY • h:mm A");
    }
  }
  const status = String(apt?.status || "").replaceAll("_", " ");
  return [name, dateLabel, status].filter(Boolean).join(" • ");
}

function TransactionCard({ item }) {
  const status = getTransactionStatus(item);
  const statusStyle = getStatusStyle(status);
  const createdAt = item?.created_at || item?.paid_at || item?.transaction_date;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(165deg, rgba(255,255,255,0.96), rgba(248,239,224,0.96))",
        border: "1px solid rgba(187,161,79,0.2)",
        boxShadow: "0 3px 14px rgba(39,39,39,0.06)",
      }}
    >
      <div className="mb-3">
        <p
          className="text-[11px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
        >
          Payment Status
        </p>
        <p
          className="text-sm font-semibold truncate"
          style={{ ...statusStyle, display: "inline-flex", borderRadius: 999, padding: "4px 9px", fontFamily: "'Poppins', sans-serif", margin: 0 }}
        >
          {getTransactionAppointmentPaymentStatus(item)}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
            Customer
          </p>
          <p className="text-sm font-medium" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif", margin: 0 }}>
            {getTransactionCustomerName(item)}
          </p>
          {item?.customer_email && (
            <p className="text-[11px] truncate" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif", margin: "2px 0 0" }}>
              {item.customer_email}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
              Amount
            </p>
            <p className="text-sm font-semibold" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif", margin: 0 }}>
              {formatMoney(getTransactionAmount(item))}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
              Type
            </p>
            <p className="text-sm" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif", margin: 0 }}>
              {getTransactionType(item)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
            Payment Reference
          </p>
          <p className="text-sm wrap-break-word" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif", margin: 0 }}>
            {getTransactionPaymentRef(item)}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
            Created
          </p>
          <p className="text-sm" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif", margin: 0 }}>
            {createdAt && dayjs(createdAt).isValid() ? dayjs(createdAt).format("DD MMM YYYY • h:mm A") : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [messageApi, messageContext] = message.useMessage();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pendingOperation, setPendingOperation] = useState(null);
  const [validatingPayment, setValidatingPayment] = useState(false);
  const selectedAppointmentId = Form.useWatch("appointment_id", form);
  const selectedPaymentMethod = Form.useWatch("payment_method", form);
  const enteredAmount = Form.useWatch("amount", form);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: appointmentsRaw, isLoading: aptsLoading } = useQuery({
    queryKey: ["transactions-appointments"],
    queryFn: () => getTransactionAppointments(),
    staleTime: 60_000,
  });

  const { data: transactionsRaw, isLoading: txLoading } = useQuery({
    queryKey: ["appointment-transactions", debouncedSearch],
    queryFn: () => getAppointmentTransactions(debouncedSearch ? { search: debouncedSearch } : {}),
    staleTime: 30_000,
  });

  const summaryQ = useQuery({
    queryKey: ["transaction-entry-summary", selectedAppointmentId],
    queryFn: () => getAppointmentFinancialSummary(selectedAppointmentId),
    enabled: modalOpen && Boolean(selectedAppointmentId),
    staleTime: 0,
  });

  const eligibleOptions = useMemo(() => {
    const list = normalizeList(appointmentsRaw);
    return list
      .filter((a) =>
        String(a?.status || "").toLowerCase() === "arrived",
      )
      .map((a) => ({
        value: a.id,
        label: getAppointmentLabel(a),
      }));
  }, [appointmentsRaw]);

  const transactions = useMemo(() => normalizeList(transactionsRaw), [transactionsRaw]);

  const paymentMutation = useMutation({
    mutationFn: ({ appointmentId, payload }) => createSalonPayment(appointmentId, payload),
    onSuccess: (payment) => {
      setPendingOperation(null);
      queryClient.invalidateQueries({ queryKey: ["transactions-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-entry-summary", selectedAppointmentId] });
      const balance = Number(payment?.appointment_remaining_balance_amount ?? 0);
      messageApi.success(`${formatMoney(payment?.amount)} recorded.`);
      if (balance > 0) {
        form.setFieldsValue({
          amount: balance,
          payment_method: "cash",
          external_reference: undefined,
          manager_confirmed: false,
        });
        summaryQ.refetch();
      } else {
        setModalOpen(false);
        form.resetFields();
      }
    },
    onError: (err) => {
      const d = err?.response?.data;
      const msg =
        d?.detail ||
        d?.non_field_errors?.[0] ||
        Object.values(d || {}).flat?.()?.[0] ||
        Object.values(d || {})[0] ||
        "Could not record payment.";
      messageApi.error(String(msg));
    },
  });

  const openModal = () => {
    form.resetFields();
    setPendingOperation(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingOperation(null);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    setValidatingPayment(true);
    try {
      const fresh = await getAppointmentFinancialSummary(values.appointment_id);
      queryClient.setQueryData(["transaction-entry-summary", values.appointment_id], fresh);
      const freshRemaining = Number(fresh.remaining_amount_due || 0);
      if (freshRemaining <= 0) {
        form.setFieldsValue({ amount: 0, manager_confirmed: false });
        messageApi.info(
          isNoPaymentRequired(fresh)
            ? "No payment is required for this appointment."
            : "This appointment balance is already settled.",
        );
        return;
      }
      if (Number(values.amount) > freshRemaining && !values.manager_confirmed) {
        form.setFieldsValue({ amount: freshRemaining, manager_confirmed: false });
        messageApi.warning(`The current balance is ${formatMoney(freshRemaining)}. Review the amount before recording payment.`);
        return;
      }
      const payload = {
        amount: Number(values.amount).toFixed(2),
        payment_method: values.payment_method,
        idempotency_key: makeIdempotencyKey(),
      };
      if (values.external_reference?.trim()) {
        payload.external_reference = values.external_reference.trim();
      }
      const operation = { appointmentId: values.appointment_id, payload };
      setPendingOperation(operation);
      paymentMutation.mutate(operation);
    } catch (error) {
      const detail = error?.response?.data?.detail || "Could not verify the current balance. No payment was recorded.";
      messageApi.error(String(detail));
    } finally {
      setValidatingPayment(false);
    }
  };

  useEffect(() => {
    if (!summaryQ.data || !selectedAppointmentId) return;
    form.setFieldsValue({
      amount: Number(summaryQ.data.remaining_amount_due || 0),
      payment_method: form.getFieldValue("payment_method") || "cash",
      manager_confirmed: false,
    });
  }, [form, selectedAppointmentId, summaryQ.data]);

  const remainingAmount = Number(summaryQ.data?.remaining_amount_due || 0);
  const overpaymentAmount = Math.max(0, Number(enteredAmount || 0) - remainingAmount);
  const noPaymentRequired = isNoPaymentRequired(summaryQ.data);
  const balanceSettled = Boolean(summaryQ.data) && remainingAmount <= 0;

  return (
    <div style={{ animation: "fadeInUp 0.45s ease both" }} className="space-y-7">
      {messageContext}

      {/* ── Page Header ── */}
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-6 sm:px-10 sm:py-8"
        style={{
          background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
          boxShadow: "0 8px 32px rgba(39,39,39,0.18)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.15) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p
              className="text-xs tracking-[0.25em] uppercase mb-1"
              style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
            >
              Front Desk
            </p>
            <h1
              className="text-2xl sm:text-3xl font-bold text-white leading-snug"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Transactions
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(255,255,255,0.58)", fontFamily: "'Poppins', sans-serif" }}
            >
              Record in-shop payments against appointments.
            </p>
          </div>

          <Button
            icon={<FiPlus />}
            onClick={openModal}
            className={`${GOLD_BTN} rounded-xl! h-10! px-6! font-medium! text-sm! shrink-0 w-full sm:w-auto`}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Record Transaction
          </Button>
        </div>
      </div>

      <div
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: "#fff",
          border: "1px solid rgba(187,161,79,0.25)",
          boxShadow: "0 1px 6px rgba(39,39,39,0.06)",
        }}
      >
        <div>
          <p className="text-sm font-semibold text-[#272727]" style={{ fontFamily: "'Poppins', sans-serif", margin: 0 }}>
            Appointment Transactions
          </p>
          <p className="text-xs mt-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif", marginBottom: 0 }}>
            Search by guest or registered customer names, appointment reference, last five reference characters, appointment ID, payment reference, or receipt reference.
          </p>
        </div>

        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-full w-full lg:w-auto"
          style={{
            background: "#FDFAF5",
            border: "1px solid rgba(187,161,79,0.25)",
            boxShadow: "0 1px 6px rgba(39,39,39,0.05)",
          }}
        >
          <FiSearch size={14} style={{ color: "#987554" }} />
          <input
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#b5a47a] flex-1 min-w-0 lg:w-64"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:hidden">
        {txLoading ? (
          <div className="rounded-2xl px-4 py-12" style={{ background: "#FDFAF5", border: "1px solid rgba(187,161,79,0.18)" }}>
            <div className="flex items-center justify-center">
              <Spin />
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl px-4 py-10" style={{ background: "#FDFAF5", border: "1px solid rgba(187,161,79,0.18)" }}>
            <Empty description={debouncedSearch ? `No transactions found for "${debouncedSearch}"` : "No transactions yet"} />
          </div>
        ) : (
          transactions.map((item, idx) => (
            <TransactionCard key={String(item?.id ?? `${item?.reference_code || "tx"}-${idx}`)} item={item} />
          ))
        )}
      </div>

      <div
        className="hidden lg:block rounded-2xl overflow-hidden"
        style={{
          background: "#FDFAF5",
          border: "1px solid rgba(187,161,79,0.18)",
          boxShadow: "0 3px 16px rgba(39,39,39,0.06)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr
                style={{
                  background: "linear-gradient(90deg, rgba(187,161,79,0.1), rgba(152,117,84,0.06))",
                  borderBottom: "1px solid rgba(187,161,79,0.2)",
                }}
              >
                {["Payment Status", "Customer", "Amount", "Transaction Type", "Payment Ref", "Created"].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[11px] uppercase tracking-wider"
                    style={{
                      color: "#987554",
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="flex items-center justify-center">
                      <Spin />
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10">
                    <Empty description={debouncedSearch ? `No transactions found for "${debouncedSearch}"` : "No transactions yet"} />
                  </td>
                </tr>
              ) : (
                transactions.map((item, idx) => {
                  const status = getTransactionStatus(item);
                  const statusStyle = getStatusStyle(status);
                  const createdAt = item?.created_at || item?.paid_at || item?.transaction_date;
                  return (
                    <tr
                      key={String(item?.id ?? `${item?.reference_code || "tx"}-${idx}`)}
                      style={{
                        borderBottom: "1px solid rgba(187,161,79,0.1)",
                        background: idx % 2 === 0 ? "#FDFAF5" : "rgba(187,161,79,0.03)",
                      }}
                    >
                      <td className="px-4 py-3 text-xs font-semibold" style={{ fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap" }}>
                        <span style={{ ...statusStyle, display: "inline-flex", borderRadius: 999, padding: "4px 9px" }}>
                          {getTransactionAppointmentPaymentStatus(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ maxWidth: 180 }}>
                        <div style={{ minWidth: 0 }}>
                          <p className="text-sm font-medium text-[#272727] truncate" style={{ fontFamily: "'Poppins', sans-serif", margin: 0 }}>
                            {getTransactionCustomerName(item)}
                          </p>
                          {item?.customer_email && (
                            <p className="text-[11px] truncate" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif", margin: 0 }}>
                              {item.customer_email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}>
                        {formatMoney(getTransactionAmount(item))}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#987554] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        {getTransactionType(item)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#987554] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        {getTransactionPaymentRef(item)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#987554] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        {createdAt && dayjs(createdAt).isValid() ? dayjs(createdAt).format("DD MMM YYYY • h:mm A") : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Record Transaction Modal ── */}
      <Modal
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        centered
        width={500}
        closable={false}
        styles={{
          content: { padding: 0, borderRadius: 20, overflow: "hidden" },
          mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.5)" },
        }}
      >
        {/* Header */}
        <div
          className="relative overflow-hidden px-6 pt-6 pb-5"
          style={{ background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #BBA14F, #987554)",
                  boxShadow: "0 4px 14px rgba(187,161,79,0.4)",
                }}
              >
                <FiCreditCard size={18} color="#fff" />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                >
                  In-Shop Payment
                </p>
                <h3
                  className="text-base font-bold text-white leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Record Transaction
                </h3>
              </div>
            </div>
            <button
              onClick={closeModal}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-70"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5" style={{ background: "#FDFAF5" }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ payment_method: "cash", manager_confirmed: false }}>

            <Form.Item
              name="appointment_id"
              label="Appointment"
              rules={[{ required: true, message: "Please select an appointment" }]}
            >
              <Select
                showSearch
                placeholder="Select appointment…"
                options={eligibleOptions}
                optionFilterProp="label"
                className="rounded-xl!"
                loading={aptsLoading}
                notFoundContent={aptsLoading ? "Loading…" : "No eligible appointments found"}
              />
            </Form.Item>

            {selectedAppointmentId && (
              <div
                className="rounded-2xl px-4 py-3 mb-5"
                style={{
                  background: noPaymentRequired ? "#eef7ef" : "#f3ebdd",
                  border: noPaymentRequired ? "1px solid rgba(40,122,82,0.22)" : "1px solid rgba(187,161,79,0.24)",
                }}
              >
                {summaryQ.isFetching ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#987554]"><Spin size="small" /> Loading current balance…</div>
                ) : summaryQ.isError ? (
                  <Alert type="error" showIcon message="Could not load the current balance" action={<Button size="small" onClick={() => summaryQ.refetch()}>Retry</Button>} />
                ) : (
                  <>
                    <div className="flex items-end justify-between gap-4 pb-3 mb-3" style={{ borderBottom: "1px solid rgba(152,117,84,0.18)" }}>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#987554] m-0">
                          {noPaymentRequired ? "No payment required" : balanceSettled ? "Balance settled" : "Amount to collect"}
                        </p>
                        <p className="text-2xl font-bold text-[#272727] m-0" style={{ fontFamily: "'Playfair Display', serif" }}>{formatMoney(summaryQ.data?.remaining_amount_due)}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase rounded-full px-2 py-1" style={{ color: "#7a6530", background: "rgba(187,161,79,0.16)" }}>
                        {noPaymentRequired ? "Complimentary" : String(summaryQ.data?.settlement_status || "unpaid").replaceAll("_", " ")}
                      </span>
                    </div>
                    {[
                      ["Original services", summaryQ.data?.original_net_total],
                      ["Add-ons", summaryQ.data?.active_addon_total],
                      ["Paid online", summaryQ.data?.online_amount_paid],
                      ["Paid on-site", summaryQ.data?.salon_payments_received],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between py-1 text-xs">
                        <span className="text-[#987554]">{label}</span>
                        <b className="text-[#272727]">{formatMoney(value)}</b>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {balanceSettled ? (
              <div className="mb-1">
                <Alert
                  type="success"
                  showIcon
                  message={noPaymentRequired ? "No payment required" : "Balance already settled"}
                  description={
                    noPaymentRequired
                      ? "This appointment is intentionally free. No cash or electronic transaction should be recorded. Finalize it from the appointment checkout."
                      : "Nothing remains to collect for this appointment."
                  }
                />
                <div className="flex justify-end mt-4">
                  <Button onClick={closeModal}>Close</Button>
                </div>
              </div>
            ) : summaryQ.data ? (
              <>
            <Form.Item
              name="payment_method"
              label="Payment Method"
              rules={[{ required: true, message: "Please choose a payment method" }]}
            >
              <Select
                placeholder="Choose payment method"
                options={PAYMENT_METHOD_OPTIONS}
                className="rounded-xl!"
              />
            </Form.Item>

            <Form.Item
              name="amount"
              label="Amount (GHS)"
              rules={[
                { required: true, message: "Please enter the amount" },
                {
                  validator: (_, value) =>
                    !value || Number(value) > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error("Amount must be positive")),
                },
              ]}
            >
              <InputNumber
                min={0.01}
                step={0.01}
                className="rounded-xl! w-full!"
                placeholder="e.g. 150.00"
              />
            </Form.Item>

            <Form.Item
              name="external_reference"
              label="Provider or terminal reference"
              rules={[
                {
                  validator: (_, value) =>
                    !REFERENCE_METHODS.has(selectedPaymentMethod) || value?.trim()
                      ? Promise.resolve()
                      : Promise.reject(new Error("Reference is required for this payment method")),
                },
              ]}
            >
              <Input
                placeholder={REFERENCE_METHODS.has(selectedPaymentMethod) ? "Required after provider success" : "Optional"}
                className="rounded-xl!"
              />
            </Form.Item>

            {overpaymentAmount > 0 && (
              <>
                <Alert
                  type="warning"
                  showIcon
                  className="mb-3"
                  message={`This is ${formatMoney(overpaymentAmount)} above the current balance.`}
                />
                <Form.Item
                  name="manager_confirmed"
                  valuePropName="checked"
                  rules={[{
                    validator: (_, checked) =>
                      checked
                        ? Promise.resolve()
                        : Promise.reject(new Error("Manager confirmation is required")),
                  }]}
                >
                  <Checkbox>Manager confirmed this intentional overpayment</Checkbox>
                </Form.Item>
              </>
            )}

            <p className="text-[11px] leading-relaxed text-[#987554] -mt-1 mb-4">
              For split tender, record each payment method separately. Electronic payments should only be recorded after provider success.
            </p>

            {paymentMutation.isError && pendingOperation && (
              <Alert
                type="error"
                showIcon
                className="mb-4"
                message="Payment outcome may be unknown"
                description="Retry the preserved operation to avoid recording a duplicate payment."
                action={<Button size="small" onClick={() => paymentMutation.mutate(pendingOperation)}>Retry same payment</Button>}
              />
            )}

            <div className="flex justify-end gap-3 mt-2">
              <Button
                onClick={closeModal}
                className="rounded-xl! h-9!"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                loading={paymentMutation.isPending || validatingPayment}
                disabled={validatingPayment}
                className={`${GOLD_BTN} rounded-xl! h-9! px-6!`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {validatingPayment ? "Verifying Balance" : "Record Payment"}
              </Button>
            </div>
              </>
            ) : selectedAppointmentId ? null : (
              <p className="text-xs text-[#987554] text-center py-2">Select an arrived appointment to load its authoritative balance.</p>
            )}
          </Form>
        </div>
      </Modal>
    </div>
  );
}
