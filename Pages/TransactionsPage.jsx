import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  message,
} from "antd";
import dayjs from "dayjs";
import { FiCreditCard, FiPlus } from "react-icons/fi";
import { createSalonPayment, getTransactionAppointments } from "../src/api/transactions";

const GOLD_BTN = "!bg-[#BBA14F] !border-none hover:!bg-[#a08340] !text-white";

const PAYMENT_METHOD_OPTIONS = [
  { label: "Cash", value: "cash" },
  { label: "Mobile Money", value: "mobile_money" },
  { label: "Card Terminal", value: "card_terminal" },
  { label: "Bank Transfer", value: "bank_transfer" },
];

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

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [messageApi, messageContext] = message.useMessage();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: appointmentsRaw, isLoading: aptsLoading } = useQuery({
    queryKey: ["transactions-appointments"],
    queryFn: () => getTransactionAppointments(),
    staleTime: 60_000,
  });

  const eligibleOptions = useMemo(() => {
    const list = Array.isArray(appointmentsRaw)
      ? appointmentsRaw
      : appointmentsRaw?.results ?? [];
    return list
      .filter((a) =>
        ["arrived", "completed"].includes(String(a?.status || "").toLowerCase()),
      )
      .map((a) => ({
        value: a.id,
        label: getAppointmentLabel(a),
      }));
  }, [appointmentsRaw]);

  const paymentMutation = useMutation({
    mutationFn: ({ appointmentId, payload }) => createSalonPayment(appointmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      messageApi.success("Payment recorded successfully.");
      setModalOpen(false);
      form.resetFields();
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
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    form.resetFields();
  };

  const handleSubmit = (values) => {
    const payload = {
      amount: Number(values.amount).toFixed(2),
      payment_method: values.payment_method,
    };
    if (values.external_reference?.trim()) {
      payload.external_reference = values.external_reference.trim();
    }
    paymentMutation.mutate({ appointmentId: values.appointment_id, payload });
  };

  return (
    <div style={{ animation: "fadeInUp 0.45s ease both" }} className="space-y-7">
      {messageContext}

      {/* ── Page Header ── */}
      <div
        className="relative overflow-hidden rounded-2xl px-7 py-7 sm:px-10 sm:py-8"
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
            className={`${GOLD_BTN} rounded-xl! h-10! px-6! font-medium! text-sm! shrink-0`}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Record Transaction
          </Button>
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
          <Form form={form} layout="vertical" onFinish={handleSubmit}>

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
              label="Reference number"
            >
              <Input placeholder="Enter reference number" className="rounded-xl!" />
            </Form.Item>

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
                loading={paymentMutation.isPending}
                className={`${GOLD_BTN} rounded-xl! h-9! px-6!`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Save Payment
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
}