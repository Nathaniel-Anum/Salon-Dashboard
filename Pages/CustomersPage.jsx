/**
 * CustomersPage.jsx
 * ─────────────────
 * Full CRUD page for salon customers / clients.
 *
 * Endpoints:
 *   GET    /api/portal/v1/accounts/customers/        → list
 *   POST   /api/portal/v1/accounts/customers/        → create
 *   PATCH  /api/portal/v1/accounts/customers/{id}/   → update
 *   DELETE /api/portal/v1/accounts/customers/{id}/   → delete
 *
 * Design: cream / gold palette — matches Staff + Services pages.
 */

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Modal, Form, Input, Button, Switch, message, Tooltip } from "antd";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiGrid,
  FiList,
  FiPhone,
  FiMail,
  FiUser,
  FiUsers,
  FiExternalLink,
} from "react-icons/fi";
import _axios from "../src/api/_axios";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const GOLD_BTN = "!bg-[#BBA14F] !border-none hover:!bg-[#a08340] !text-white";

const AVATAR_COLORS = [
  ["#BBA14F", "#987554"],
  ["#987554", "#6b4f30"],
  ["#4f7aa8", "#2d5a84"],
  ["#7a4fa8", "#5a2d84"],
  ["#4fa87a", "#2d845a"],
  ["#a84f7a", "#842d5a"],
];

/* ─────────────────────────────────────────────
   CUSTOMER AVATAR
───────────────────────────────────────────── */
function CustomerAvatar({ name, size = 42 }) {
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  const [from, to] = AVATAR_COLORS[idx];
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.36,
        fontFamily: "'Poppins', sans-serif",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
      }}
    >
      {initials}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CUSTOMER FORM FIELDS
   (module-level to avoid focus-steal re-mount)
───────────────────────────────────────────── */
function CustomerFormFields({ isEdit = false }) {
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4">
        <Form.Item
          name="first_name"
          label="First Name"
          className="flex-1"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input placeholder="e.g. Amara" className="rounded-xl" />
        </Form.Item>
        <Form.Item
          name="last_name"
          label="Last Name"
          className="flex-1"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input placeholder="e.g. Johnson" className="rounded-xl" />
        </Form.Item>
      </div>

      <Form.Item
        name="email"
        label="Email"
        rules={[{ type: "email", message: "Enter a valid email" }]}
      >
        <Input placeholder="name@example.com" className="rounded-xl" />
      </Form.Item>

      <Form.Item name="phone" label="Phone">
        <Input placeholder="+233 000 000 0000" className="rounded-xl" />
      </Form.Item>

      {!isEdit && (
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input.Password placeholder="Set a password" className="rounded-xl" />
        </Form.Item>
      )}

      <Form.Item name="is_active" label="Active" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );
}

/* ─────────────────────────────────────────────
   MODAL TITLE HELPER
───────────────────────────────────────────── */
const modalTitle = (text) => (
  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#272727" }}>
    {text}
  </span>
);

/* ─────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────── */
export default function CustomersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  /* ── UI state ── */
  const [addOpen, setAddOpen]       = useState(false);
  const [editOpen, setEditOpen]     = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [search, setSearch]         = useState("");
  const [viewMode, setViewMode]     = useState("cards");

  /* ── Forms ── */
  const [addForm]  = Form.useForm();
  const [editForm] = Form.useForm();

  /* ─────────────────────────────────────
     FETCH customers
  ───────────────────────────────────── */
  const { data: customersRaw, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () =>
      _axios.get("/api/portal/v1/accounts/customers/").then((r) => r.data),
  });

  const customersData = useMemo(
    () => (Array.isArray(customersRaw) ? customersRaw : customersRaw?.results || []),
    [customersRaw]
  );

  /* ─────────────────────────────────────
     SEARCH filter
  ───────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!search.trim()) return customersData;
    const q = search.toLowerCase();
    return customersData.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [customersData, search]);

  /* helper — full display name */
  const fullName = (c) =>
    c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";

  /* ─────────────────────────────────────
     CREATE
  ───────────────────────────────────── */
  const createCustomer = useMutation({
    mutationFn: (data) =>
      _axios.post("/api/portal/v1/accounts/customers/", data),
    onSuccess: () => {
      message.success("Customer added successfully");
      queryClient.invalidateQueries(["customers"]);
      setAddOpen(false);
      addForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to add customer");
    },
  });

  /* ─────────────────────────────────────
     UPDATE
  ───────────────────────────────────── */
  const updateCustomer = useMutation({
    mutationFn: (data) =>
      _axios.patch(`/api/portal/v1/accounts/customers/${data.id}/`, data),
    onSuccess: () => {
      message.success("Customer updated");
      queryClient.invalidateQueries(["customers"]);
      setEditOpen(false);
      editForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to update customer");
    },
  });

  /* ─────────────────────────────────────
     DELETE
  ───────────────────────────────────── */
  const deleteCustomer = useMutation({
    mutationFn: (id) =>
      _axios.delete(`/api/portal/v1/accounts/customers/${id}/`),
    onSuccess: () => {
      message.success("Customer removed");
      queryClient.invalidateQueries(["customers"]);
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to delete customer");
    },
  });

  /* ─────────────────────────────────────
     HANDLERS
  ───────────────────────────────────── */
  const handleEdit = (customer) => {
    setEditCustomer(customer);
    editForm.setFieldsValue({
      first_name: customer.first_name,
      last_name:  customer.last_name,
      email:      customer.email,
      phone:      customer.phone,
      is_active:  customer.is_active,
    });
    setEditOpen(true);
  };

  const handleDelete = (id, name) => {
    Modal.confirm({
      title: "Remove Customer",
      content: `Are you sure you want to remove ${name || "this customer"}? This cannot be undone.`,
      okText: "Remove",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      centered: true,
      onOk: () => deleteCustomer.mutate(id),
    });
  };

  /* ─────────────────────────────────────
     STATS
  ───────────────────────────────────── */
  const totalCustomers  = customersData.length;
  const activeCustomers = customersData.filter((c) => c.is_active).length;

  /* ═══════════════════════════════════
     RENDER
  ═══════════════════════════════════ */
  return (
    <div>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2
            className="text-xl font-semibold text-[#272727]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Clients
          </h2>
          <p
            className="text-sm text-[#987554] mt-0.5"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {totalCustomers} client{totalCustomers !== 1 ? "s" : ""} · {activeCustomers} active
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">

          {/* Search */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-full"
            style={{
              background: "#FDFAF5",
              border: "1px solid rgba(187,161,79,0.25)",
              boxShadow: "0 1px 6px rgba(39,39,39,0.05)",
            }}
          >
            <FiSearch size={14} style={{ color: "#987554" }} />
            <input
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#b5a47a] w-44"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            />
          </div>

          {/* View toggle */}
          <div
            className="flex items-center rounded-full p-1 gap-1"
            style={{
              background: "#FDFAF5",
              border: "1px solid rgba(187,161,79,0.25)",
            }}
          >
            {[
              { key: "cards", icon: <FiGrid size={14} />, label: "Cards" },
              { key: "table", icon: <FiList size={14} />, label: "Table" },
            ].map(({ key, icon, label }) => {
              const active = viewMode === key;
              return (
                <Tooltip key={key} title={label} placement="bottom">
                  <button
                    onClick={() => setViewMode(key)}
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200"
                    style={{
                      background: active
                        ? "linear-gradient(135deg, #BBA14F, #987554)"
                        : "transparent",
                      color: active ? "#fff" : "#987554",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: active ? "0 2px 8px rgba(187,161,79,0.35)" : "none",
                    }}
                  >
                    {icon}
                  </button>
                </Tooltip>
              );
            })}
          </div>

          {/* Add button */}
          <button
            onClick={() => setAddOpen(true)}
            className="flex cursor-pointer items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #BBA14F, #987554)",
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 4px 14px rgba(187,161,79,0.3)",
            }}
          >
            <FiPlus />
            Add Client
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total Clients",
            value: totalCustomers,
            icon: <FiUsers size={16} style={{ color: "#BBA14F" }} />,
            bg: "rgba(187,161,79,0.12)",
          },
          {
            label: "Active",
            value: activeCustomers,
            icon: <FiUser size={16} style={{ color: "#1a8a40" }} />,
            bg: "rgba(34,160,80,0.1)",
          },
          {
            label: "Inactive",
            value: totalCustomers - activeCustomers,
            icon: <FiUser size={16} style={{ color: "#c43232" }} />,
            bg: "rgba(200,50,50,0.1)",
          },
          {
            label: "Showing",
            value: filtered.length,
            icon: <FiSearch size={16} style={{ color: "#987554" }} />,
            bg: "rgba(152,117,84,0.1)",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-4"
            style={{
              background: "#FDFAF5",
              border: "1px solid rgba(187,161,79,0.15)",
              boxShadow: "0 2px 10px rgba(39,39,39,0.04)",
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center mb-2"
              style={{ background: stat.bg }}
            >
              {stat.icon}
            </div>
            <p
              className="text-xl font-bold text-[#272727] leading-none mb-0.5"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {isLoading ? "—" : stat.value}
            </p>
            <p
              className="text-[11px] text-[#987554]"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <div
          className="flex items-center justify-center h-48 rounded-2xl text-[#987554]"
          style={{
            background: "#FDFAF5",
            border: "1px dashed rgba(187,161,79,0.3)",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          Loading clients…
        </div>

      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-48 rounded-2xl gap-2 text-[#987554]"
          style={{
            background: "#FDFAF5",
            border: "1px dashed rgba(187,161,79,0.35)",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <FiUsers size={28} style={{ color: "#BBA14F", opacity: 0.4 }} />
          <p className="text-sm">
            {search ? `No clients matching "${search}"` : "No clients yet. Add your first one!"}
          </p>
        </div>

      ) : viewMode === "cards" ? (
        /* ── CARDS VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((customer) => {
            const name = fullName(customer);
            return (
              <div
                key={customer.id}
                className="relative rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{
                  background: "#FDFAF5",
                  border: "1px solid rgba(187,161,79,0.18)",
                  boxShadow: "0 3px 16px rgba(39,39,39,0.06)",
                }}
              >
                {/* Gold top bar */}
                <div
                  className="absolute top-0 left-0 right-0 rounded-t-2xl"
                  style={{
                    height: 3,
                    background: customer.is_active
                      ? "linear-gradient(90deg, #BBA14F, #e4ca80)"
                      : "rgba(200,50,50,0.4)",
                  }}
                />

                {/* Avatar + name + status */}
                <div className="flex items-center gap-3 mb-4 mt-1">
                  <CustomerAvatar name={name} size={48} />
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold text-[#272727] truncate leading-none mb-1"
                      style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14 }}
                    >
                      {name}
                    </h3>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: customer.is_active
                          ? "rgba(34,160,80,0.12)"
                          : "rgba(200,50,50,0.1)",
                        color: customer.is_active ? "#1a8a40" : "#c43232",
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {customer.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="flex flex-col gap-1.5 mb-4">
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <FiMail size={11} style={{ color: "#BBA14F", flexShrink: 0 }} />
                      <span
                        className="text-xs text-[#987554] truncate"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        {customer.email}
                      </span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <FiPhone size={11} style={{ color: "#BBA14F", flexShrink: 0 }} />
                      <span
                        className="text-xs text-[#987554]"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        {customer.phone}
                      </span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px mb-3" style={{ background: "rgba(187,161,79,0.15)" }} />

                {/* Actions */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => navigate(`/clients/${customer.user ?? customer.user_id ?? customer.id}`)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80"
                    style={{
                      color: "#BBA14F",
                      background: "rgba(187,161,79,0.1)",
                      fontFamily: "'Poppins', sans-serif",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <FiExternalLink size={12} />
                    View Profile
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(customer)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80"
                      style={{
                        color: "#987554",
                        background: "rgba(152,117,84,0.1)",
                        fontFamily: "'Poppins', sans-serif",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <FiEdit2 size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id, name)}
                      disabled={deleteCustomer.isPending}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80 disabled:opacity-50"
                      style={{
                        color: "#c43232",
                        background: "rgba(196,50,50,0.08)",
                        fontFamily: "'Poppins', sans-serif",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <FiTrash2 size={12} />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        /* ── TABLE VIEW ── */
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#FDFAF5",
            border: "1px solid rgba(187,161,79,0.18)",
            boxShadow: "0 3px 16px rgba(39,39,39,0.06)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 640 }}>

              {/* Header */}
              <thead>
                <tr
                  style={{
                    background: "linear-gradient(90deg, rgba(187,161,79,0.1), rgba(152,117,84,0.06))",
                    borderBottom: "1px solid rgba(187,161,79,0.2)",
                  }}
                >
                  {["#", "Client", "Email", "Phone", "Status", "Actions"].map((col) => (
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

              {/* Body */}
              <tbody>
                {filtered.map((customer, idx) => {
                  const name = fullName(customer);
                  return (
                    <tr
                      key={customer.id}
                      style={{
                        borderBottom: "1px solid rgba(187,161,79,0.1)",
                        background: idx % 2 === 0 ? "#FDFAF5" : "rgba(187,161,79,0.03)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(187,161,79,0.07)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          idx % 2 === 0 ? "#FDFAF5" : "rgba(187,161,79,0.03)")
                      }
                    >
                      {/* # */}
                      <td
                        className="px-4 py-3 text-xs text-[#c8b890]"
                        style={{ fontFamily: "'Poppins', sans-serif", width: 40 }}
                      >
                        {idx + 1}
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar name={name} size={34} />
                          <span
                            className="text-sm font-semibold text-[#272727] whitespace-nowrap"
                            style={{ fontFamily: "'Poppins', sans-serif" }}
                          >
                            {name}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td
                        className="px-4 py-3 text-xs text-[#987554]"
                        style={{ fontFamily: "'Poppins', sans-serif", maxWidth: 200 }}
                      >
                        <span className="truncate block">{customer.email || "—"}</span>
                      </td>

                      {/* Phone */}
                      <td
                        className="px-4 py-3 text-xs text-[#987554] whitespace-nowrap"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        {customer.phone || "—"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
                          style={{
                            background: customer.is_active
                              ? "rgba(34,160,80,0.12)"
                              : "rgba(200,50,50,0.1)",
                            color: customer.is_active ? "#1a8a40" : "#c43232",
                            fontFamily: "'Poppins', sans-serif",
                          }}
                        >
                          {customer.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/clients/${customer.user ?? customer.user_id ?? customer.id}`)}
                            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-200 hover:opacity-80 whitespace-nowrap"
                            style={{
                              color: "#BBA14F",
                              background: "rgba(187,161,79,0.1)",
                              fontFamily: "'Poppins', sans-serif",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <FiExternalLink size={11} />
                            Profile
                          </button>
                          <button
                            onClick={() => handleEdit(customer)}
                            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-200 hover:opacity-80 whitespace-nowrap"
                            style={{
                              color: "#987554",
                              background: "rgba(152,117,84,0.1)",
                              fontFamily: "'Poppins', sans-serif",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <FiEdit2 size={11} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id, name)}
                            disabled={deleteCustomer.isPending}
                            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-200 hover:opacity-80 whitespace-nowrap disabled:opacity-50"
                            style={{
                              color: "#c43232",
                              background: "rgba(196,50,50,0.08)",
                              fontFamily: "'Poppins', sans-serif",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            <FiTrash2 size={11} />
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            className="px-4 py-3"
            style={{
              borderTop: "1px solid rgba(187,161,79,0.12)",
              background: "rgba(187,161,79,0.04)",
            }}
          >
            <p
              className="text-[11px]"
              style={{ color: "rgba(152,117,84,0.7)", fontFamily: "'Poppins', sans-serif" }}
            >
              Showing {filtered.length} of {totalCustomers} client{totalCustomers !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── ADD CUSTOMER MODAL ── */}
      <Modal
        title={modalTitle("Add Client")}
        open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields(); }}
        footer={null}
        centered
        style={{ borderRadius: 16 }}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={(values) => createCustomer.mutate(values)}
          initialValues={{ is_active: true }}
          className="pt-3"
        >
          <CustomerFormFields isEdit={false} />
          <Form.Item className="mt-5 mb-0">
            <div className="flex justify-end gap-3">
              <Button onClick={() => { setAddOpen(false); addForm.resetFields(); }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createCustomer.isPending}
                className={GOLD_BTN}
              >
                Add Client
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── EDIT CUSTOMER MODAL ── */}
      <Modal
        title={modalTitle("Edit Client")}
        open={editOpen}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); }}
        footer={null}
        centered
        style={{ borderRadius: 16 }}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateCustomer.mutate({ id: editCustomer?.id, ...values })}
          className="pt-3"
        >
          <CustomerFormFields isEdit={true} />
          <Form.Item className="mt-5 mb-0">
            <div className="flex justify-end gap-3">
              <Button onClick={() => { setEditOpen(false); editForm.resetFields(); }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateCustomer.isPending}
                className={GOLD_BTN}
              >
                Save Changes
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
