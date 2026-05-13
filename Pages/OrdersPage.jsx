/**
 * OrdersPage.jsx
 * ──────────────
 * Full page for commerce orders — create, view, confirm, complete & cancel.
 *
 * Endpoints:
 *   GET    /api/portal/v1/commerce/orders/              → list
 *   POST   /api/portal/v1/commerce/orders/              → create
 *   GET    /api/portal/v1/commerce/orders/{id}/         → detail
 *   POST   /api/portal/v1/commerce/orders/{id}/confirm  → confirm
 *   POST   /api/portal/v1/commerce/orders/{id}/complete → complete
 *   POST   /api/portal/v1/commerce/orders/{id}/cancel   → cancel
 *
 * Design: cream / gold palette — matches the rest of the dashboard.
 */

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  message,
  Popconfirm,
  Tooltip,
  Table,
  Divider,
} from "antd";
import {
  FiPlus,
  FiSearch,
  FiShoppingCart,
  FiTrash2,
  FiEye,
  FiCheck,
  FiX,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiAlertCircle,
  FiMinusCircle,
} from "react-icons/fi";
import {
  getOrders,
  createOrder,
  getOrder,
  confirmOrder,
  completeOrder,
  cancelOrder,
  getProducts,
} from "../src/api/commerce";
import _axios from "../src/api/_axios";

const GOLD_BTN = "!bg-[#BBA14F] !border-none hover:!bg-[#a08340] !text-white";

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function formatPrice(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(n);
}

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "#c97d10", bg: "rgba(245,180,60,0.12)",  icon: <FiClock size={11} />   },
  confirmed: { label: "Confirmed", color: "#a08340", bg: "rgba(187,161,79,0.12)",  icon: <FiCheck size={11} />   },
  completed: { label: "Completed", color: "#1a8a40", bg: "rgba(34,160,80,0.12)",   icon: <FiCheckCircle size={11} /> },
  cancelled: { label: "Cancelled", color: "#b83232", bg: "rgba(200,60,60,0.1)",    icon: <FiXCircle size={11} /> },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: "#987554",
    bg: "rgba(152,117,84,0.1)",
    icon: <FiAlertCircle size={11} />,
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────── */
function StatCard({ label, value, color, bg, icon }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-2xl"
      style={{
        background: "#fff",
        border: "1px solid rgba(187,161,79,0.15)",
        boxShadow: "0 2px 12px rgba(39,39,39,0.05)",
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: bg }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p
          className="text-2xl font-bold leading-none"
          style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}
        >
          {value}
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ORDER DETAIL MODAL
───────────────────────────────────────────── */
function OrderDetailModal({ orderId, open, onClose }) {
  const { data: order, isLoading } = useQuery({
    queryKey: ["commerce-order", orderId],
    queryFn: () => getOrder(orderId),
    enabled: !!orderId && open,
  });

  const itemsData = order?.items ?? [];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={560}
      closable={false}
      styles={{
        content: { padding: 0, borderRadius: 20, overflow: "hidden" },
        mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.5)" },
      }}
    >
      {/* Header */}
      <div
        className="relative overflow-hidden px-6 pt-6 pb-5"
        style={{
          background:
            "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
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
              <FiEye size={18} color="#fff" />
            </div>
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
              >
                Order Details
              </p>
              <h3
                className="text-base font-bold text-white leading-none"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Order #{orderId}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
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
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#BBA14F", borderTopColor: "transparent" }}
            />
          </div>
        ) : order ? (
          <div className="space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className="px-4 py-3 rounded-xl"
                style={{ background: "rgba(187,161,79,0.07)", border: "1px solid rgba(187,161,79,0.15)" }}
              >
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>Status</p>
                <StatusBadge status={order.status} />
              </div>
              <div
                className="px-4 py-3 rounded-xl"
                style={{ background: "rgba(187,161,79,0.07)", border: "1px solid rgba(187,161,79,0.15)" }}
              >
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>Customer</p>
                <p className="text-sm font-semibold text-[#272727]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {order.customer_name ?? `#${order.customer}`}
                </p>
              </div>
            </div>

            {/* Items */}
            <div>
              <p
                className="text-xs uppercase tracking-widest mb-2"
                style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
              >
                Items
              </p>
              <div className="space-y-2">
                {itemsData.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                    style={{ background: "#fff", border: "1px solid rgba(187,161,79,0.15)" }}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#272727]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        {item.product_name ?? `Product #${item.product_id}`}
                      </p>
                      <p className="text-xs" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                        Qty: {item.quantity}
                      </p>
                    </div>
                    {item.subtotal != null && (
                      <p className="text-sm font-semibold" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}>
                        {formatPrice(item.subtotal)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div
              className="px-4 py-3 rounded-xl space-y-1.5"
              style={{ background: "#fff", border: "1px solid rgba(187,161,79,0.15)" }}
            >
              {order.tax && parseFloat(order.tax) > 0 && (
                <div className="flex justify-between text-xs" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                  <span>Tax</span><span>{formatPrice(order.tax)}</span>
                </div>
              )}
              {order.discount && parseFloat(order.discount) > 0 && (
                <div className="flex justify-between text-xs" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                  <span>Discount</span><span>-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div
                className="flex justify-between text-sm font-bold pt-1 border-t"
                style={{ borderColor: "rgba(187,161,79,0.15)", color: "#272727", fontFamily: "'Poppins', sans-serif" }}
              >
                <span>Total</span><span>{formatPrice(order.total)}</span>
              </div>
            </div>

            {order.notes && (
              <div
                className="px-4 py-3 rounded-xl"
                style={{ background: "rgba(187,161,79,0.06)", border: "1px solid rgba(187,161,79,0.15)" }}
              >
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>Notes</p>
                <p className="text-sm text-[#272727]" style={{ fontFamily: "'Poppins', sans-serif" }}>{order.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-sm py-8" style={{ color: "#987554" }}>Order not found.</p>
        )}
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   NEW ORDER MODAL
───────────────────────────────────────────── */
function NewOrderModal({ open, onClose, products, customers, onSuccess }) {
  const [form] = Form.useForm();
  const [items, setItems] = useState([{ product_id: undefined, quantity: 1 }]);
  const [messageApi, msgCtx] = message.useMessage();

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-orders"] });
      messageApi.success("Order created!");
      form.resetFields();
      setItems([{ product_id: undefined, quantity: 1 }]);
      onSuccess?.();
    },
    onError: (err) => {
      const data = err?.response?.data;
      // Backend sends { items: ["Insufficient stock…"] } or similar
      const apiMessage =
        data?.items?.[0] ||
        data?.detail ||
        (typeof data === "string" ? data : null);
      messageApi.error(apiMessage || "Could not create order.");
      form.resetFields();
      setItems([{ product_id: undefined, quantity: 1 }]);
    },
  });

  const handleAddItem = () =>
    setItems((prev) => [...prev, { product_id: undefined, quantity: 1 }]);

  const handleRemoveItem = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleItemChange = (idx, field, value) =>
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const validItems = items.filter((it) => it.product_id);
      if (validItems.length === 0) {
        messageApi.warning("Add at least one item.");
        return;
      }
      createMutation.mutate({
        customer: values.customer,
        items: validItems,
        notes: values.notes ?? "",
        tax: values.tax ?? "0.00",
        discount: values.discount ?? "0.00",
      });
    } catch {
      // validation errors shown inline
    }
  };

  const productList = Array.isArray(products)
    ? products
    : products?.results ?? [];
  const customerList = Array.isArray(customers)
    ? customers
    : customers?.results ?? [];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={600}
      closable={false}
      styles={{
        content: { padding: 0, borderRadius: 20, overflow: "hidden" },
        mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.5)" },
      }}
    >
      {msgCtx}
      {/* Header */}
      <div
        className="relative overflow-hidden px-6 pt-6 pb-5"
        style={{
          background:
            "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
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
              <FiShoppingCart size={18} color="#fff" />
            </div>
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
              >
                New Order
              </p>
              <h3
                className="text-base font-bold text-white leading-none"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Create Order
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
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
      <div
        className="px-6 py-5 max-h-[70vh] overflow-y-auto"
        style={{ background: "#FDFAF5" }}
      >
        <Form form={form} layout="vertical">
          {/* Customer */}
          <Form.Item
            name="customer"
            label="Customer"
            rules={[{ required: true, message: "Please select a customer" }]}
          >
            <Select
              placeholder="Select a customer"
              showSearch
              filterOption={(input, option) =>
                option?.label?.toLowerCase().includes(input.toLowerCase())
              }
              options={customerList.map((c) => ({
                label: c.full_name ?? (`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || `#${c.id}`),
                value: c.id,
              }))}
            />
          </Form.Item>

          {/* Items */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
              >
                Order Items
              </p>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{
                  background: "rgba(187,161,79,0.12)",
                  border: "1px solid rgba(187,161,79,0.3)",
                  color: "#7a6030",
                  cursor: "pointer",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <FiPlus size={11} /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: "#fff", border: "1px solid rgba(187,161,79,0.15)" }}
                >
                  <Select
                    placeholder="Select product"
                    className="flex-1"
                    value={item.product_id}
                    onChange={(v) => handleItemChange(idx, "product_id", v)}
                    showSearch
                    filterOption={(input, option) =>
                      option?.label?.toLowerCase().includes(input.toLowerCase())
                    }
                    options={productList.map((p) => ({
                      label: p.name,
                      value: p.id,
                    }))}
                  />
                  <InputNumber
                    min={1}
                    value={item.quantity}
                    onChange={(v) => handleItemChange(idx, "quantity", v ?? 1)}
                    className="!w-20"
                    placeholder="Qty"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all hover:scale-110"
                      style={{
                        background: "rgba(220,60,60,0.08)",
                        border: "1px solid rgba(220,60,60,0.2)",
                        color: "#d94040",
                        cursor: "pointer",
                      }}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <Form.Item name="notes" label="Notes">
            <Input.TextArea
              rows={2}
              placeholder="Any special instructions…"
              className="!rounded-xl"
            />
          </Form.Item>

          {/* Tax + Discount */}
          <div className="flex gap-4">
            <Form.Item name="tax" label="Tax" className="flex-1">
              <Input placeholder="0.00" className="!rounded-xl" />
            </Form.Item>
            <Form.Item name="discount" label="Discount" className="flex-1">
              <Input placeholder="0.00" className="!rounded-xl" />
            </Form.Item>
          </div>
        </Form>

        <div className="flex justify-end gap-3 mt-2">
          <Button
            onClick={onClose}
            className="!rounded-xl !h-9"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Cancel
          </Button>
          <Button
            loading={createMutation.isPending}
            className={`${GOLD_BTN} !rounded-xl !h-9 !px-6`}
            style={{ fontFamily: "'Poppins', sans-serif" }}
            onClick={handleSubmit}
          >
            Place Order
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function OrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [messageApi, msgCtx] = message.useMessage();

  /* ── Data ── */
  const { data: orderData, isLoading } = useQuery({
    queryKey: ["commerce-orders"],
    queryFn: getOrders,
  });

  const { data: productData } = useQuery({
    queryKey: ["commerce-products"],
    queryFn: getProducts,
  });

  const { data: customerData } = useQuery({
    queryKey: ["customers"],
    queryFn: () =>
      _axios
        .get("/api/portal/v1/accounts/customers/")
        .then((r) => r.data),
  });

  const orders = useMemo(() => {
    const list = Array.isArray(orderData)
      ? orderData
      : orderData?.results ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (o) =>
        String(o.id).includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.status?.toLowerCase().includes(q)
    );
  }, [orderData, search]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const list = Array.isArray(orderData)
      ? orderData
      : orderData?.results ?? [];
    return {
      total:     list.length,
      pending:   list.filter((o) => o.status === "pending").length,
      completed: list.filter((o) => o.status === "completed").length,
      cancelled: list.filter((o) => o.status === "cancelled").length,
    };
  }, [orderData]);

  /* ── Action mutations ── */
  const confirmMutation = useMutation({
    mutationFn: confirmOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-orders"] });
      messageApi.success("Order confirmed!");
    },
    onError: () => messageApi.error("Action failed. Please try again."),
  });

  const completeMutation = useMutation({
    mutationFn: completeOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-orders"] });
      messageApi.success("Order marked as completed!");
    },
    onError: () => messageApi.error("Action failed. Please try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-orders"] });
      messageApi.success("Order cancelled.");
    },
    onError: () => messageApi.error("Action failed. Please try again."),
  });

  /* ── Table columns ── */
  const columns = [
    {
      title: "Order ID",
      key: "id",
      width: 100,
      render: (_, record) => (
        <span
          className="font-mono text-sm font-semibold"
          style={{ color: "#272727" }}
        >
          #{record.id}
        </span>
      ),
    },
    {
      title: "Customer",
      key: "customer",
      render: (_, record) => (
        <p
          className="text-sm font-medium text-[#272727]"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {record.customer_name ?? `Customer #${record.customer}`}
        </p>
      ),
    },
    {
      title: "Items",
      key: "items",
      width: 80,
      render: (_, record) => (
        <span
          className="text-sm font-semibold text-center"
          style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}
        >
          {record.items?.length ?? record.item_count ?? "—"}
        </span>
      ),
    },
    {
      title: "Total",
      key: "total",
      render: (_, record) => (
        <span
          className="text-sm font-semibold"
          style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}
        >
          {record.total != null ? formatPrice(record.total) : "—"}
        </span>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => <StatusBadge status={record.status} />,
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_, record) => {
        const isPending   = record.status === "pending";
        const isConfirmed = record.status === "confirmed";
        const isFinal     = record.status === "completed" || record.status === "cancelled";
        return (
          <div className="flex items-center gap-1.5">
            {/* View */}
            <Tooltip title="View Details">
              <button
                onClick={() => setDetailOrderId(record.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: "rgba(187,161,79,0.1)",
                  border: "1px solid rgba(187,161,79,0.25)",
                  color: "#BBA14F",
                  cursor: "pointer",
                }}
              >
                <FiEye size={13} />
              </button>
            </Tooltip>

            {/* Confirm — only for pending */}
            {isPending && (
              <Tooltip title="Confirm Order">
                <button
                  onClick={() => confirmMutation.mutate(record.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    background: "rgba(34,160,80,0.1)",
                    border: "1px solid rgba(34,160,80,0.25)",
                    color: "#1a8a40",
                    cursor: "pointer",
                  }}
                >
                  <FiCheck size={13} />
                </button>
              </Tooltip>
            )}

            {/* Complete — only for confirmed */}
            {isConfirmed && (
              <Tooltip title="Mark as Completed">
                <button
                  onClick={() => completeMutation.mutate(record.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                  style={{
                    background: "rgba(79,122,168,0.1)",
                    border: "1px solid rgba(79,122,168,0.25)",
                    color: "#3b6de8",
                    cursor: "pointer",
                  }}
                >
                  <FiCheckCircle size={13} />
                </button>
              </Tooltip>
            )}

            {/* Cancel — for pending or confirmed */}
            {!isFinal && (
              <Popconfirm
                title="Cancel Order"
                description="Are you sure you want to cancel this order?"
                onConfirm={() => cancelMutation.mutate(record.id)}
                okText="Yes, cancel"
                cancelText="No"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Cancel Order">
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    style={{
                      background: "rgba(220,60,60,0.08)",
                      border: "1px solid rgba(220,60,60,0.2)",
                      color: "#d94040",
                      cursor: "pointer",
                    }}
                  >
                    <FiMinusCircle size={13} />
                  </button>
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ animation: "fadeInUp 0.45s ease both" }} className="space-y-7">
      {msgCtx}

      {/* ── Page Header ── */}
      <div
        className="relative overflow-hidden rounded-2xl px-7 py-7 sm:px-10 sm:py-8"
        style={{
          background:
            "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
          boxShadow: "0 8px 32px rgba(39,39,39,0.18)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(187,161,79,0.15) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div
          className="absolute right-0 top-0 h-full w-1/3 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 80% 50%, rgba(187,161,79,0.13), transparent 70%)",
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p
              className="text-xs tracking-[0.25em] uppercase mb-1"
              style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
            >
              Commerce
            </p>
            <h1
              className="text-2xl sm:text-3xl font-bold text-white leading-snug"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Orders
            </h1>
            <p
              className="text-sm mt-1"
              style={{
                color: "rgba(255,255,255,0.55)",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Track and manage customer orders
            </p>
          </div>
          <Button
            icon={<FiPlus />}
            className={`${GOLD_BTN} !rounded-xl !h-10 !px-5 !font-medium !text-sm shrink-0`}
            onClick={() => setNewOrderOpen(true)}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            New Order
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Orders"
          value={stats.total}
          color="#BBA14F"
          bg="rgba(187,161,79,0.12)"
          icon={<FiShoppingCart size={20} />}
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          color="#c97d10"
          bg="rgba(245,180,60,0.12)"
          icon={<FiClock size={20} />}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          color="#1a8a40"
          bg="rgba(34,160,80,0.12)"
          icon={<FiCheckCircle size={20} />}
        />
        <StatCard
          label="Cancelled"
          value={stats.cancelled}
          color="#b83232"
          bg="rgba(200,60,60,0.1)"
          icon={<FiXCircle size={20} />}
        />
      </div>

      {/* ── Search ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{
          background: "#fff",
          border: "1px solid rgba(187,161,79,0.25)",
          boxShadow: "0 1px 6px rgba(39,39,39,0.06)",
          maxWidth: 440,
        }}
      >
        <FiSearch size={15} style={{ color: "#987554", flexShrink: 0 }} />
        <input
          placeholder="Search by ID, customer or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#c8b88a] w-full"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{
              color: "#987554",
              background: "none",
              border: "none",
              cursor: "pointer",
              lineHeight: 1,
              fontSize: 18,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#fff",
          border: "1px solid rgba(187,161,79,0.15)",
          boxShadow: "0 2px 16px rgba(39,39,39,0.06)",
        }}
      >
        <Table
          rowKey="id"
          dataSource={orders}
          columns={columns}
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            style: { padding: "12px 20px" },
          }}
          locale={{
            emptyText: (
              <div
                className="flex flex-col items-center justify-center py-16 gap-3"
                style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
              >
                <FiShoppingCart size={36} style={{ opacity: 0.3 }} />
                <p className="text-sm">
                  {search ? "No orders match your search" : "No orders yet — create your first one!"}
                </p>
                {!search && (
                  <Button
                    icon={<FiPlus />}
                    className={`${GOLD_BTN} !rounded-xl !h-9 !px-5 !text-sm`}
                    onClick={() => setNewOrderOpen(true)}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    New Order
                  </Button>
                )}
              </div>
            ),
          }}
          style={{ fontFamily: "'Poppins', sans-serif" }}
        />
      </div>

      {/* ── New Order Modal ── */}
      <NewOrderModal
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        products={productData}
        customers={customerData}
        onSuccess={() => setNewOrderOpen(false)}
      />

      {/* ── Order Detail Modal ── */}
      <OrderDetailModal
        orderId={detailOrderId}
        open={!!detailOrderId}
        onClose={() => setDetailOrderId(null)}
      />
    </div>
  );
}
