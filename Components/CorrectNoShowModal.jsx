import React, { useMemo, useState } from "react";
import { Alert, Button, Input, Modal, Select, Spin, Switch } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCreditCard,
  FiEdit3,
  FiRefreshCw,
} from "react-icons/fi";
import {
  correctAppointmentNoShow,
  getAppointmentFinancialSummary,
} from "../src/api/appointmentCheckout";
import { firstApiErrorMessage } from "../src/api/apiErrors";
import { createIdempotencyKey } from "../src/api/bookingV2.js";
import { permissionState } from "../src/auth/permissions";
import { useBookingV2 } from "../src/hooks/useBookingV2.js";
import "./CorrectNoShowModal.css";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "card_terminal", label: "Card terminal" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];
const REFERENCE_METHODS = new Set(["mobile_money", "card_terminal", "bank_transfer", "other"]);

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asMoney(value, currency = "GHS") {
  return `${currency} ${numeric(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstLeaf(value) {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstLeaf(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = firstLeaf(item);
      if (found) return found;
    }
  }
  return null;
}

function correctionError(error) {
  const data = error?.response?.data;
  if (error?.response?.status === 403) {
    return "You do not have permission to perform this correction.";
  }
  if (error?.response?.status === 404) {
    return "This appointment no longer exists or is not available to your account.";
  }
  return (
    firstLeaf(data?.payment) ||
    firstLeaf(data?.price_adjustment) ||
    firstLeaf(data?.errors) ||
    firstLeaf(data?.reason) ||
    firstLeaf(data?.status) ||
    firstLeaf(data?.outstanding_balance) ||
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.detail === "string" && data.detail) ||
    firstApiErrorMessage(error, "The appointment could not be corrected.")
  );
}

function paidAmount(summary) {
  if (summary?.total_amount_paid != null) return numeric(summary.total_amount_paid);
  const itemized =
    numeric(summary?.online_amount_paid) +
    numeric(summary?.salon_payments_received) -
    numeric(summary?.salon_payment_reversals);
  if (itemized > 0) return itemized;
  return Math.max(
    0,
    numeric(summary?.total_amount_due) - numeric(summary?.remaining_amount_due) + numeric(summary?.overpaid_amount),
  );
}

function fallbackFinancialSummary(appointment = {}) {
  const bookingPayments = Array.isArray(appointment.payments) ? appointment.payments : [];
  const hasAppointmentFinance = [
    appointment.subtotal_amount,
    appointment.service_price,
    appointment.remaining_balance_amount,
    appointment.deposit_amount,
    appointment.payment_status,
  ].some((value) => value !== null && value !== undefined && value !== "") || bookingPayments.length > 0;

  if (!hasAppointmentFinance) return null;

  const total = numeric(appointment.subtotal_amount ?? appointment.service_price);
  const completedPayments = bookingPayments
    .filter((payment) => ["completed", "paid", "received", "success", "succeeded"].includes(String(payment?.status || "").toLowerCase()))
    .reduce((sum, payment) => sum + numeric(payment?.amount), 0);
  const paid = completedPayments || numeric(appointment.deposit_amount);
  const remaining = appointment.remaining_balance_amount != null
    ? numeric(appointment.remaining_balance_amount)
    : Math.max(0, total - paid);

  return {
    appointment_reference: appointment.reference_code || appointment.appointment_reference,
    original_net_total: total,
    active_addon_total: 0,
    price_adjustment_total: 0,
    total_amount_due: total,
    total_amount_paid: paid,
    remaining_amount_due: remaining,
    overpaid_amount: Math.max(0, paid - total),
    currency: appointment.currency || "GHS",
  };
}

function SummaryRow({ label, value, currency, strong = false }) {
  return (
    <div className={`no-show-summary-row ${strong ? "is-strong" : ""}`}>
      <span>{label}</span>
      <strong>{asMoney(value, currency)}</strong>
    </div>
  );
}

function CorrectionContent({ open, appointment, onClose, onCorrected }) {
  const bookingV2 = useBookingV2();
  const appointmentId = appointment?.id;
  const [reason, setReason] = useState("");
  const [changePrice, setChangePrice] = useState(false);
  const [finalTotal, setFinalTotal] = useState(null);
  const [priceReason, setPriceReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [externalReference, setExternalReference] = useState("");
  const [pendingOperation, setPendingOperation] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const summaryQ = useQuery({
    queryKey: ["appointment-financial-summary", appointmentId],
    queryFn: () => getAppointmentFinancialSummary(appointmentId),
    enabled: Boolean(open && appointmentId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const usingAppointmentFinance = summaryQ.isSuccess && summaryQ.data == null;
  const summary = summaryQ.data ?? (usingAppointmentFinance ? fallbackFinancialSummary(appointment) : null);
  const currency = summary?.currency || appointment?.currency || "GHS";
  const currentTotal = numeric(summary?.total_amount_due);
  const alreadyPaid = paidAmount(summary);
  const requestedTotal = changePrice ? numeric(finalTotal ?? currentTotal) : currentTotal;
  const adjustmentDelta = requestedTotal - currentTotal;
  const projectedBalance = changePrice
    ? Math.max(0, requestedTotal - alreadyPaid)
    : numeric(summary?.remaining_amount_due);
  const projectedOverpayment = changePrice
    ? Math.max(0, alreadyPaid - requestedTotal)
    : numeric(summary?.overpaid_amount);

  const canAdjustPrice = permissionState("booking_price_adjustments.create", appointment) !== false;
  const canRecordPayment = permissionState("booking_salon_payments.create", appointment) !== false;
  const requiresReference = REFERENCE_METHODS.has(paymentMethod);

  const invalidateDraft = (setter) => (value) => {
    setter(value);
    setPendingOperation(null);
    setErrorMessage("");
  };

  const validation = useMemo(() => {
    if (reason.trim().length < 3) return "Enter at least 3 characters for the correction reason.";
    if (reason.trim().length > 2000) return "Keep the correction reason within 2,000 characters.";
    if (!summary) return "The latest balance must be loaded before continuing.";
    if (changePrice) {
      if (!canAdjustPrice) return "You do not have permission to change the final price.";
      if (finalTotal === "" || Number(finalTotal ?? currentTotal) < 0 || !Number.isFinite(Number(finalTotal ?? currentTotal))) {
        return "Enter a valid final appointment total.";
      }
      if (Math.abs(adjustmentDelta) < 0.005) return "The final price is unchanged.";
      if (priceReason.trim().length < 3) return "Enter a reason for the price change.";
    }
    if (projectedOverpayment > 0.004) return "Resolve the overpayment before completing this appointment.";
    if (projectedBalance > 0.004 && !canRecordPayment) {
      return "An authorized staff member must record the outstanding payment as part of this correction.";
    }
    if (projectedBalance > 0.004 && requiresReference && !externalReference.trim()) {
      return "Enter the payment provider reference.";
    }
    return null;
  }, [
    adjustmentDelta,
    canAdjustPrice,
    canRecordPayment,
    changePrice,
    currentTotal,
    externalReference,
    finalTotal,
    priceReason,
    projectedBalance,
    projectedOverpayment,
    reason,
    requiresReference,
    summary,
  ]);

  const mutation = useMutation({
    mutationFn: (payload) => correctAppointmentNoShow(appointmentId, payload, { v2: bookingV2.enabled }),
    onSuccess: (correctionResult) => {
      setErrorMessage("");
      onCorrected?.(correctionResult);
    },
    onError: (error) => setErrorMessage(correctionError(error)),
  });

  function buildPayload() {
    const payload = { reason: reason.trim() };
    const includesPayment = projectedBalance > 0.004;
    if (changePrice) {
      payload.price_adjustment = {
        final_total_amount_due: requestedTotal.toFixed(2),
        reason: priceReason.trim(),
      };
    }
    if (includesPayment) {
      payload.payment = {
        amount: projectedBalance.toFixed(2),
        payment_method: paymentMethod,
        ...(externalReference.trim() ? { external_reference: externalReference.trim() } : {}),
      };
    }
    if (changePrice || includesPayment) payload.idempotency_key = createIdempotencyKey("portal-correct-no-show");
    return payload;
  }

  function submit() {
    if (validation || mutation.isPending) return;
    const payload = pendingOperation || buildPayload();
    setPendingOperation(payload);
    mutation.mutate(payload);
  }

  const retrying = Boolean(pendingOperation && errorMessage);

  return (
    <Modal
      open={open}
      onCancel={mutation.isPending ? undefined : onClose}
      footer={null}
      width={620}
      centered
      destroyOnHidden
      className="no-show-modal"
      title={null}
      closable={!mutation.isPending}
      keyboard={!mutation.isPending}
      maskClosable={!mutation.isPending}
    >
      <div className="no-show-modal-header">
        <div className="no-show-warning-icon"><FiAlertTriangle /></div>
        <div>
          <span>Attendance correction</span>
          <h2>Change no-show to completed?</h2>
          <p>This updates client history, settlement records, analytics, and eligible loyalty points.</p>
        </div>
      </div>

      {summaryQ.isLoading ? (
        <div className="no-show-loading"><Spin /><span>Checking the latest appointment balance…</span></div>
      ) : summaryQ.isError ? (
        <Alert
          type="error"
          showIcon
          message="Financial summary unavailable"
          description="The balance must be checked before this appointment can be completed."
          action={<Button size="small" icon={<FiRefreshCw />} onClick={() => summaryQ.refetch()}>Retry</Button>}
        />
      ) : (
        <>
          <section className="no-show-financial-panel" aria-label="Appointment finances">
            <div className="no-show-financial-heading">
              <div>
                <span>Settlement check</span>
                <h3>{summary?.appointment_reference || appointment?.appointment_reference || `Appointment #${appointmentId}`}</h3>
              </div>
              <div className={`no-show-settlement-state ${projectedBalance > 0 ? "has-balance" : "is-settled"}`}>
                {projectedBalance > 0 ? `${asMoney(projectedBalance, currency)} due` : "Balance settled"}
              </div>
            </div>
            <div className="no-show-summary-grid">
              <SummaryRow label="Original appointment total" value={summary?.original_net_total} currency={currency} />
              <SummaryRow label="Add-ons" value={summary?.active_addon_total} currency={currency} />
              {numeric(summary?.price_adjustment_total) !== 0 && (
                <SummaryRow label="Existing adjustments" value={summary?.price_adjustment_total} currency={currency} />
              )}
              <SummaryRow label="Current total due" value={summary?.total_amount_due} currency={currency} strong />
              <SummaryRow label="Amount already paid" value={alreadyPaid} currency={currency} />
              <SummaryRow label="Current outstanding balance" value={summary?.remaining_amount_due} currency={currency} />
            </div>
            {usingAppointmentFinance && (
              <p className="no-show-financial-fallback">Using the appointment’s original payment and deposit record.</p>
            )}
          </section>

          <label className="no-show-field">
            <span>Why is this no-show being corrected?</span>
            <Input.TextArea
              autoFocus
              rows={3}
              maxLength={2000}
              value={reason}
              onChange={(event) => invalidateDraft(setReason)(event.target.value)}
              placeholder="Customer attended; the no-show was recorded in error."
              aria-required="true"
            />
            <small>{reason.trim().length.toLocaleString()} / 2,000</small>
          </label>

          {canAdjustPrice && (
            <section className="no-show-price-section">
              <div className="no-show-option-row">
                <div className="no-show-option-copy">
                  <FiEdit3 />
                  <div><strong>Final price changed onsite</strong><span>Use the actual final total if the services delivered changed.</span></div>
                </div>
                <Switch checked={changePrice} onChange={invalidateDraft(setChangePrice)} aria-label="Final price changed onsite" />
              </div>

              {changePrice && (
                <div className="no-show-price-fields">
                  <label className="no-show-field">
                    <span>Final appointment total ({currency})</span>
                    <Input
                      inputMode="decimal"
                      value={finalTotal ?? currentTotal.toFixed(2)}
                      onChange={(event) => invalidateDraft(setFinalTotal)(event.target.value)}
                      prefix={currency}
                    />
                    <small className={adjustmentDelta < 0 ? "decrease" : "increase"}>
                      {Math.abs(adjustmentDelta) < 0.005
                        ? "No change from the current total"
                        : `${adjustmentDelta > 0 ? "Increase" : "Decrease"} of ${asMoney(Math.abs(adjustmentDelta), currency)}`}
                    </small>
                  </label>
                  <label className="no-show-field">
                    <span>Why did the final price change?</span>
                    <Input.TextArea
                      rows={2}
                      value={priceReason}
                      onChange={(event) => invalidateDraft(setPriceReason)(event.target.value)}
                      placeholder="Describe what changed during the appointment."
                    />
                  </label>
                </div>
              )}
            </section>
          )}

          {projectedOverpayment > 0.004 && (
            <Alert
              type="warning"
              showIcon
              message={`Overpayment of ${asMoney(projectedOverpayment, currency)}`}
              description="This must be handled separately before the appointment can be completed."
            />
          )}

          {projectedBalance > 0.004 && (
            <section className="no-show-payment-panel">
              <div className="no-show-payment-heading">
                <FiCreditCard />
                <div>
                  <strong>Balance to collect: {asMoney(projectedBalance, currency)}</strong>
                  <span>The exact balance and correction will be recorded together.</span>
                </div>
              </div>
              {canRecordPayment ? (
                <div className="no-show-payment-fields">
                  <label className="no-show-field">
                    <span>Payment amount</span>
                    <Input value={projectedBalance.toFixed(2)} prefix={currency} readOnly />
                    <small>The backend requires the exact outstanding amount.</small>
                  </label>
                  <label className="no-show-field">
                    <span>Payment method</span>
                    <Select
                      value={paymentMethod}
                      options={PAYMENT_METHODS}
                      onChange={invalidateDraft(setPaymentMethod)}
                    />
                  </label>
                  {requiresReference && (
                    <label className="no-show-field no-show-reference-field">
                      <span>Provider reference</span>
                      <Input
                        value={externalReference}
                        onChange={(event) => invalidateDraft(setExternalReference)(event.target.value)}
                        placeholder="Required after provider confirmation"
                      />
                    </label>
                  )}
                </div>
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="Payment permission required"
                  description="An authorized staff member must settle this balance as part of the correction."
                />
              )}
            </section>
          )}

          {errorMessage && <Alert type="error" showIcon message={errorMessage} />}

          {validation && reason.trim().length >= 3 && (
            <p className="no-show-blocking-message">{validation}</p>
          )}
          <div className="no-show-modal-actions">
            <Button onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button
              type="primary"
              icon={retrying ? <FiRefreshCw /> : <FiCheckCircle />}
              onClick={submit}
              loading={mutation.isPending}
              disabled={Boolean(validation) || summaryQ.isError}
            >
              {mutation.isPending ? "Correcting appointment…" : retrying ? "Try correction again" : "Correct and complete"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function CorrectNoShowModal(props) {
  if (!props.open || !props.appointment?.id) return null;
  return <CorrectionContent key={props.appointment.id} {...props} />;
}
