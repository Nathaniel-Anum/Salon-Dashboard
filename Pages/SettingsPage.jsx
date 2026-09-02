import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Empty, Input, Modal, Select, Spin, message } from "antd";
import { FiCreditCard, FiEdit2, FiPlus, FiSettings, FiTrash2 } from "react-icons/fi";
import {
  createDepositRule,
  deleteDepositRule,
  getDepositRuleById,
  getDepositRules,
  patchDepositRule,
} from "../src/api/depositRules";

const normalizeList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const defaultForm = {
  deposit_type: "percentage",
  fixed_amount: "",
  percentage: "",
  grace_period_hours: "0",
  appointment_no_show_grace_minutes: "0",
  waitlist_payment_grace_minutes: "0",
};

const getRuleId = (rule) => rule?.id ?? rule?.public_id ?? rule?.uuid;

const toFormState = (rule) => ({
  deposit_type: String(rule?.deposit_type || "percentage"),
  fixed_amount: rule?.fixed_amount === null || rule?.fixed_amount === undefined ? "" : String(rule.fixed_amount),
  percentage: rule?.percentage === null || rule?.percentage === undefined ? "" : String(rule.percentage),
  grace_period_hours:
    rule?.grace_period_hours === null || rule?.grace_period_hours === undefined
      ? "0"
      : String(rule.grace_period_hours),
  appointment_no_show_grace_minutes:
    rule?.appointment_no_show_grace_minutes === null || rule?.appointment_no_show_grace_minutes === undefined
      ? "0"
      : String(rule.appointment_no_show_grace_minutes),
  waitlist_payment_grace_minutes:
    rule?.waitlist_payment_grace_minutes === null || rule?.waitlist_payment_grace_minutes === undefined
      ? "0"
      : String(rule.waitlist_payment_grace_minutes),
});

const asInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

const buildPayload = (form) => {
  const type = String(form.deposit_type || "percentage").toLowerCase();
  const fixedAmount = String(form.fixed_amount || "").trim();
  const percentage = String(form.percentage || "").trim();

  if (type === "fixed" && !fixedAmount) {
    throw new Error("Fixed amount is required when deposit type is fixed.");
  }
  if (type === "percentage" && !percentage) {
    throw new Error("Percentage is required when deposit type is percentage.");
  }

  return {
    deposit_type: type,
    fixed_amount: type === "fixed" ? fixedAmount : "",
    percentage: type === "percentage" ? percentage : "",
    is_active: true,
    grace_period_hours: asInt(form.grace_period_hours),
    appointment_no_show_grace_minutes: asInt(form.appointment_no_show_grace_minutes),
    waitlist_payment_grace_minutes: asInt(form.waitlist_payment_grace_minutes),
  };
};

const extractApiErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;

  if (data && typeof data === "object") {
    const messages = [];

    Object.values(data).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string" && item.trim()) messages.push(item.trim());
        });
      } else if (typeof value === "string" && value.trim()) {
        messages.push(value.trim());
      }
    });

    if (messages.length > 0) return messages.join(" ");
  }

  return fallback;
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isPreparingEdit, setIsPreparingEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: rulesRaw, isLoading } = useQuery({
    queryKey: ["deposit-rules"],
    queryFn: getDepositRules,
  });

  const rules = useMemo(() => normalizeList(rulesRaw), [rulesRaw]);

  const createMutation = useMutation({
    mutationFn: createDepositRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-rules"] });
      setOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (err) => {
      message.error(extractApiErrorMessage(err, "Failed to create deposit rule"));
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, payload }) => patchDepositRule(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-rules"] });
      setOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (err) => {
      message.error(extractApiErrorMessage(err, "Failed to update deposit rule"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDepositRule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-rules"] });
    },
    onError: (err) => {
      message.error(extractApiErrorMessage(err, "Failed to delete deposit rule"));
    },
  });

  const busy = createMutation.isPending || patchMutation.isPending || deleteMutation.isPending;

  const resetModal = () => {
    setOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setOpen(true);
  };

  const openEdit = async (id) => {
    setIsPreparingEdit(true);
    try {
      const detail = await getDepositRuleById(id);
      setEditingId(id);
      setForm(toFormState(detail));
      setOpen(true);
    } catch (err) {
      message.error(extractApiErrorMessage(err, "Failed to load deposit rule"));
    } finally {
      setIsPreparingEdit(false);
    }
  };

  const handleSubmit = () => {
    let payload;
    try {
      payload = buildPayload(form);
    } catch (err) {
      message.error(err.message || "Please fill required fields");
      return;
    }

    if (editingId) {
      patchMutation.mutate({ id: editingId, payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const askDelete = (id) => {
    Modal.confirm({
      title: "Delete this deposit rule?",
      content: "This action is permanent and cannot be undone.",
      okText: "Delete",
      okButtonProps: {
        style: {
          background: "linear-gradient(135deg,#A53232,#7A1F1F)",
          border: "none",
        },
      },
      onOk: () => deleteMutation.mutate(id),
    });
  };

  return (
    <div className="min-h-screen px-6 py-8" style={{ background: "#F8F2E8", fontFamily: "'Poppins', sans-serif" }}>
      <div
        className="rounded-3xl p-6 sm:p-7 mb-6"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(220,189,109,0.22), transparent 46%), linear-gradient(125deg, #181614 0%, #2A2118 45%, #47331F 100%)",
          boxShadow: "0 20px 48px rgba(38,29,21,0.28)",
          border: "1px solid rgba(220,189,109,0.2)",
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#D8B55F,#A47C46)" }}
          >
            <FiSettings size={20} color="#fff" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ margin: 0, color: "#D7B263" }}>Booking Policies</p>
            <h1 className="text-2xl" style={{ margin: 0, color: "#fff", fontFamily: "'Playfair Display', serif" }}>Deposit Rules</h1>
          </div>
        </div>
        <p className="text-sm" style={{ margin: 0, color: "rgba(255,255,255,0.82)" }}>
          Set how customers are charged for booking deposits. The selected type sends only its value and always keeps rules active.
        </p>
      </div>

      <div
        className="rounded-3xl p-5 sm:p-6"
        style={{
          background: "linear-gradient(165deg, rgba(255,255,255,0.96), rgba(248,239,224,0.96))",
          border: "1px solid rgba(187,161,79,0.24)",
          boxShadow: "0 12px 28px rgba(67,52,35,0.12)",
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg" style={{ margin: 0, color: "#2A2118", fontFamily: "'Playfair Display', serif" }}>
              Existing Rules
            </h2>
            <p className="text-xs mt-1" style={{ marginBottom: 0, color: "#87643E" }}>
              Manage deposit type, grace periods, and no-show/waitlist payment windows.
            </p>
          </div>

          <Button
            type="primary"
            icon={<FiPlus />}
            onClick={openCreate}
            style={{
              background: "linear-gradient(135deg,#B9934D,#8E6A3F)",
              border: "none",
              borderRadius: 12,
              height: 40,
              boxShadow: "0 8px 18px rgba(185,147,77,0.3)",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Add Deposit Rule
          </Button>
        </div>

        {isLoading || isPreparingEdit ? (
          <div className="py-14 text-center">
            <Spin />
          </div>
        ) : rules.length === 0 ? (
          <div className="py-8">
            <Empty description="No deposit rules yet" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rules.map((rule) => {
              const id = getRuleId(rule);
              const type = String(rule?.deposit_type || "").toLowerCase();
              const valueLabel = type === "fixed" ? "Fixed Amount" : "Percentage";
              const value = type === "fixed" ? rule?.fixed_amount : rule?.percentage;

              return (
                <div
                  key={String(id)}
                  className="rounded-2xl p-4"
                  style={{
                    background:
                      "radial-gradient(circle at top right, rgba(221,192,127,0.25), rgba(255,255,255,0.95) 55%), linear-gradient(160deg, rgba(255,255,255,0.98), rgba(247,239,227,0.92))",
                    border: "1px solid rgba(183,145,74,0.25)",
                    boxShadow: "0 10px 22px rgba(61,46,28,0.1)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
                        style={{
                          background: "linear-gradient(135deg, rgba(185,147,77,0.24), rgba(142,106,63,0.2))",
                          color: "#8E6A3F",
                        }}
                      >
                        <FiCreditCard size={16} />
                      </span>
                      <div>
                        <p className="text-xs uppercase tracking-wider" style={{ margin: 0, color: "#8A6A43" }}>
                          Deposit Rule
                        </p>
                        <p className="text-base font-semibold" style={{ margin: 0, color: "#2A2118" }}>
                          {type === "fixed" ? "Fixed" : "Percentage"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-9 h-9 rounded-lg border-0 cursor-pointer"
                        style={{ background: "rgba(48,93,147,0.12)", color: "#1E4C7E" }}
                        onClick={() => openEdit(id)}
                        disabled={busy}
                      >
                        <FiEdit2 size={15} style={{ margin: "0 auto" }} />
                      </button>
                      <button
                        type="button"
                        className="w-9 h-9 rounded-lg border-0 cursor-pointer"
                        style={{ background: "rgba(165,50,50,0.13)", color: "#8A2525" }}
                        onClick={() => askDelete(id)}
                        disabled={busy}
                      >
                        <FiTrash2 size={15} style={{ margin: "0 auto" }} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <p style={{ margin: 0, color: "#9B7A4E", fontSize: 12 }}>{valueLabel}</p>
                      <p style={{ margin: 0, color: "#2A2118", fontWeight: 600 }}>{value || "-"}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: "#9B7A4E", fontSize: 12 }}>Grace Hours</p>
                      <p style={{ margin: 0, color: "#2A2118", fontWeight: 600 }}>{rule?.grace_period_hours ?? 0}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: "#9B7A4E", fontSize: 12 }}>No-Show Grace (min)</p>
                      <p style={{ margin: 0, color: "#2A2118", fontWeight: 600 }}>
                        {rule?.appointment_no_show_grace_minutes ?? 0}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: "#9B7A4E", fontSize: 12 }}>Waitlist Grace (min)</p>
                      <p style={{ margin: 0, color: "#2A2118", fontWeight: 600 }}>
                        {rule?.waitlist_payment_grace_minutes ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onCancel={resetModal}
        footer={null}
        centered
        width={620}
        closable={false}
        styles={{
          content: { padding: 0, borderRadius: 20, overflow: "hidden" },
          mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.45)" },
        }}
      >
        <div
          className="relative overflow-hidden px-7 pt-7 pb-6"
          style={{
            background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div
            className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 80% 50%, rgba(187,161,79,0.15), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #BBA14F, #987554)",
                  boxShadow: "0 4px 14px rgba(187,161,79,0.4)",
                }}
              >
                <FiCreditCard size={20} color="#fff" />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                >
                  {editingId ? "Update Rule" : "New Rule"}
                </p>
                <h3
                  className="text-lg font-bold text-white leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {editingId ? "Edit Deposit Rule" : "Create Deposit Rule"}
                </h3>
              </div>
            </div>

            <button
              onClick={resetModal}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-70"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-7 py-6" style={{ background: "#FDFAF5" }}>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <p className="text-xs mb-1" style={{ color: "#7D5D37", fontWeight: 600 }}>Deposit Type</p>
              <Select
                value={form.deposit_type}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    deposit_type: value,
                    fixed_amount: value === "fixed" ? prev.fixed_amount : "",
                    percentage: value === "percentage" ? prev.percentage : "",
                  }))
                }
                options={[
                  { label: "Percentage", value: "percentage" },
                  { label: "Fixed Amount", value: "fixed" },
                ]}
                style={{ width: "100%" }}
              />
            </div>

            {form.deposit_type === "percentage" ? (
              <div>
                <p className="text-xs mb-1" style={{ color: "#7D5D37", fontWeight: 600 }}>Percentage</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 15"
                  value={form.percentage}
                  onChange={(e) => setForm((prev) => ({ ...prev, percentage: e.target.value }))}
                />
              </div>
            ) : (
              <div>
                <p className="text-xs mb-1" style={{ color: "#7D5D37", fontWeight: 600 }}>Fixed Amount</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 25"
                  value={form.fixed_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, fixed_amount: e.target.value }))}
                />
              </div>
            )}

            <div>
              <p className="text-xs mb-1" style={{ color: "#7D5D37", fontWeight: 600 }}>Grace Period (Hours)</p>
              <Input
                type="number"
                min="0"
                value={form.grace_period_hours}
                onChange={(e) => setForm((prev) => ({ ...prev, grace_period_hours: e.target.value }))}
              />
            </div>

            <div>
              <p className="text-xs mb-1" style={{ color: "#7D5D37", fontWeight: 600 }}>Appointment No-Show Grace (Minutes)</p>
              <Input
                type="number"
                min="0"
                value={form.appointment_no_show_grace_minutes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    appointment_no_show_grace_minutes: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <p className="text-xs mb-1" style={{ color: "#7D5D37", fontWeight: 600 }}>Waitlist Payment Grace (Minutes)</p>
              <Input
                type="number"
                min="0"
                value={form.waitlist_payment_grace_minutes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    waitlist_payment_grace_minutes: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div
            className="flex items-center justify-between mt-6 pt-5"
            style={{ borderTop: "1px solid rgba(187,161,79,0.18)" }}
          >
            <div className="flex gap-3">
              <button
                type="button"
                onClick={resetModal}
                className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-80"
                style={{
                  background: "rgba(187,161,79,0.1)",
                  color: "#987554",
                  border: "1px solid rgba(187,161,79,0.25)",
                  fontFamily: "'Poppins', sans-serif",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={createMutation.isPending || patchMutation.isPending}
                className="rounded-full! px-6! font-medium! text-sm!"
                style={{
                  background: "linear-gradient(135deg, #BBA14F, #987554)",
                  border: "none",
                  fontFamily: "'Poppins', sans-serif",
                  boxShadow: "0 4px 14px rgba(187,161,79,0.35)",
                  height: 36,
                }}
              >
                {editingId ? "Save Changes" : "Create Rule"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
