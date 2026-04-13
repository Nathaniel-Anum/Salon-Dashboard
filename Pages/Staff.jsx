import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Form, Input, Select, Button, Switch, message, Tag, Tooltip } from "antd";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiGrid, FiList } from "react-icons/fi";
import { FaUserAlt } from "react-icons/fa";
import _axios from "../src/api/_axios";

/* avatar colour pool */
const AVATAR_COLORS = [
  ["#BBA14F", "#987554"],
  ["#987554", "#6b4f30"],
  ["#4f7aa8", "#2d5a84"],
  ["#7a4fa8", "#5a2d84"],
  ["#4fa87a", "#2d845a"],
];

function StaffAvatar({ name, size = 42 }) {
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

/* ── Staff form fields (module-level to avoid focus-steal bug) ── */
function StaffFormFields({ isEdit = false, roleOptions = [], rolesLoading = false }) {
  return (
    <>
      <Form.Item name="full_name" label="Full Name" rules={[{ required: true, message: "Required" }]}>
        <Input placeholder="e.g. Amara Johnson" className="rounded-xl" />
      </Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
        <Input placeholder="name@example.com" className="rounded-xl" />
      </Form.Item>
      <Form.Item name="phone" label="Phone">
        <Input placeholder="+234 000 000 0000" className="rounded-xl" />
      </Form.Item>
      <Form.Item
        name="password"
        label="Password"
        rules={isEdit ? [] : [{ required: true, message: "Required" }]}
      >
        <Input.Password
          placeholder={isEdit ? "Leave empty to keep current" : "Set password"}
          className="rounded-xl"
        />
      </Form.Item>
      <Form.Item name="role_ids" label="Roles">
        <Select
          mode="multiple"
          placeholder="Assign roles"
          options={roleOptions}
          loading={rolesLoading}
          className="w-full"
          allowClear
        />
      </Form.Item>
      <div className="flex gap-6">
        <Form.Item name="is_active" label="Active" valuePropName="checked" className="flex-1 mb-2">
          <Switch />
        </Form.Item>
        <Form.Item name="is_verified" label="Verified" valuePropName="checked" className="flex-1 mb-2">
          <Switch />
        </Form.Item>
      </div>
    </>
  );
}

export default function Staff() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // --- FETCH STAFF ---
  const { data: staffRaw, isLoading: staffLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/staff/").then((r) => r.data),
  });

  // --- FETCH ROLES — normalise to array regardless of API shape ---
  const { data: rolesRaw, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/roles/").then((r) => r.data),
  });

  const staffData = useMemo(
    () => (Array.isArray(staffRaw) ? staffRaw : staffRaw?.results || []),
    [staffRaw]
  );
  const rolesData = useMemo(
    () => (Array.isArray(rolesRaw) ? rolesRaw : rolesRaw?.results || []),
    [rolesRaw]
  );

  const roleOptions = useMemo(
    () => rolesData.map((r) => ({ label: r.name, value: r.id })),
    [rolesData]
  );

  // --- SEARCH filter ---
  const filtered = useMemo(() => {
    if (!search.trim()) return staffData;
    const q = search.toLowerCase();
    return staffData.filter(
      (s) =>
        s.full_name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
    );
  }, [staffData, search]);

  // --- CREATE STAFF ---
  const createStaff = useMutation({
    mutationFn: (data) => _axios.post("/api/portal/v1/accounts/staff/", data),
    onSuccess: () => {
      message.success("Staff member added successfully");
      queryClient.invalidateQueries(["staff"]);
      setAddOpen(false);
      addForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to add staff");
    },
  });

  // --- UPDATE STAFF ---
  const updateStaff = useMutation({
    mutationFn: (data) =>
      _axios.patch(`/api/portal/v1/accounts/staff/${data.id}/`, data),
    onSuccess: () => {
      message.success("Staff member updated successfully");
      queryClient.invalidateQueries(["staff"]);
      setEditOpen(false);
      editForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to update staff");
    },
  });

  // --- DELETE STAFF ---
  const deleteStaff = useMutation({
    mutationFn: (id) => _axios.delete(`/api/portal/v1/accounts/staff/${id}/`),
    onSuccess: () => {
      message.success("Staff member removed");
      queryClient.invalidateQueries(["staff"]);
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to delete staff");
    },
  });

  // --- HANDLE DELETE (with confirm) ---
  const handleDeleteStaff = (id, name) => {
    Modal.confirm({
      title: "Remove Staff Member",
      content: `Are you sure you want to remove ${name || "this staff member"}? This cannot be undone.`,
      okText: "Remove",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      centered: true,
      onOk: () => deleteStaff.mutate(id),
    });
  };

  // --- HANDLE EDIT ---
  const handleEdit = (staff) => {
    setEditStaff(staff);
    editForm.setFieldsValue({
      full_name: staff.full_name,
      email: staff.email,
      phone: staff.phone,
      password: "",
      is_active: staff.is_active,
      is_verified: staff.is_verified,
      is_staff: staff.is_staff,
      role_ids: staff.roles?.map((r) => r.id) || [],
    });
    setEditOpen(true);
  };

  /* ── shared modal form fields ── */
  const modalTitle = (text) => (
    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#272727" }}>
      {text}
    </span>
  );

  const goldBtn = "!bg-[#BBA14F] !border-none hover:!bg-[#a08340] !text-white";

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2
            className="text-xl font-semibold text-[#272727]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Staff Members
          </h2>
          <p className="text-sm text-[#987554] mt-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {staffData.length} team member{staffData.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* search */}
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
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#b5a47a] w-44"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            />
          </div>

          {/* view toggle */}
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

          {/* add button */}
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
            Add Staff
          </button>
        </div>
      </div>

      {/* ── Staff body ── */}
      {staffLoading ? (
        <div className="flex items-center justify-center h-48 text-[#987554]" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Loading staff…
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-48 rounded-2xl text-[#987554] gap-2"
          style={{
            background: "#FDFAF5",
            border: "1px dashed rgba(187,161,79,0.35)",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <FaUserAlt size={28} style={{ color: "#BBA14F", opacity: 0.4 }} />
          <p className="text-sm">
            {search ? `No staff matching "${search}"` : "No staff members yet"}
          </p>
        </div>

      ) : viewMode === "cards" ? (
        /* ── Cards grid ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((staff) => (
            <div
              key={staff.id}
              className="relative rounded-2xl p-5 transition-all duration-250 hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                background: "#FDFAF5",
                border: "1px solid rgba(187,161,79,0.18)",
                boxShadow: "0 3px 16px rgba(39,39,39,0.06)",
              }}
            >
              {/* top row */}
              <div className="flex items-center gap-3 mb-4">
                <StaffAvatar name={staff.full_name} size={48} />
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-[#272727] truncate leading-none mb-0.5"
                    style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14 }}
                  >
                    {staff.full_name}
                  </h3>
                  <p
                    className="text-xs text-[#987554] truncate"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    {staff.email}
                  </p>
                </div>

                {/* active badge */}
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{
                    background: staff.is_active ? "rgba(34,160,80,0.12)" : "rgba(200,50,50,0.1)",
                    color: staff.is_active ? "#1a8a40" : "#c43232",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  {staff.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* phone */}
              {staff.phone && (
                <p
                  className="text-xs text-[#987554] mb-3"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {staff.phone}
                </p>
              )}

              {/* roles */}
              <div className="flex flex-wrap gap-1.5 mb-4 min-h-5.5">
                {staff.roles?.length > 0 ? (
                  staff.roles.map((r) => (
                    <Tag
                      key={r.id}
                      className="text-[10px] rounded-full border-0 m-0 px-2.5 py-0.5"
                      style={{
                        background: "rgba(187,161,79,0.12)",
                        color: "#8a6f2e",
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {r.name}
                    </Tag>
                  ))
                ) : (
                  <span className="text-[10px] text-[#c8b890]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    No roles assigned
                  </span>
                )}
              </div>

              {/* divider */}
              <div className="h-px mb-3" style={{ background: "rgba(187,161,79,0.15)" }} />

              {/* actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => handleEdit(staff)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80"
                  style={{
                    color: "#987554",
                    background: "rgba(152,117,84,0.1)",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  <FiEdit2 size={12} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteStaff(staff.id, staff.full_name)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80"
                  style={{
                    color: "#c43232",
                    background: "rgba(196,50,50,0.08)",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  <FiTrash2 size={12} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

      ) : (
        /* ── Table view ── */
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#FDFAF5",
            border: "1px solid rgba(187,161,79,0.18)",
            boxShadow: "0 3px 16px rgba(39,39,39,0.06)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr
                  style={{
                    background: "linear-gradient(90deg, rgba(187,161,79,0.1), rgba(152,117,84,0.06))",
                    borderBottom: "1px solid rgba(187,161,79,0.2)",
                  }}
                >
                  {["#", "Staff Member", "Email", "Phone", "Roles", "Status", "Actions"].map((col) => (
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
                {filtered.map((staff, idx) => (
                  <tr
                    key={staff.id}
                    style={{
                      borderBottom: "1px solid rgba(187,161,79,0.1)",
                      background: idx % 2 === 0 ? "#FDFAF5" : "rgba(187,161,79,0.03)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(187,161,79,0.07)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#FDFAF5" : "rgba(187,161,79,0.03)")}
                  >
                    {/* # */}
                    <td className="px-4 py-3 text-xs text-[#c8b890]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {idx + 1}
                    </td>

                    {/* Staff member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StaffAvatar name={staff.full_name} size={34} />
                        <span
                          className="text-sm font-semibold text-[#272727] whitespace-nowrap"
                          style={{ fontFamily: "'Poppins', sans-serif" }}
                        >
                          {staff.full_name}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td
                      className="px-4 py-3 text-xs text-[#987554]"
                      style={{ fontFamily: "'Poppins', sans-serif", maxWidth: 180 }}
                    >
                      <span className="truncate block">{staff.email || "—"}</span>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 text-xs text-[#987554] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {staff.phone || "—"}
                    </td>

                    {/* Roles */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {staff.roles?.length > 0 ? (
                          staff.roles.map((r) => (
                            <Tag
                              key={r.id}
                              className="text-[10px] rounded-full border-0 m-0 px-2 py-0"
                              style={{
                                background: "rgba(187,161,79,0.12)",
                                color: "#8a6f2e",
                                fontFamily: "'Poppins', sans-serif",
                              }}
                            >
                              {r.name}
                            </Tag>
                          ))
                        ) : (
                          <span className="text-[10px] text-[#c8b890]" style={{ fontFamily: "'Poppins', sans-serif" }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
                        style={{
                          background: staff.is_active ? "rgba(34,160,80,0.12)" : "rgba(200,50,50,0.1)",
                          color: staff.is_active ? "#1a8a40" : "#c43232",
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        {staff.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(staff)}
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
                          onClick={() => handleDeleteStaff(staff.id, staff.full_name)}
                          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-200 hover:opacity-80 whitespace-nowrap"
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
                ))}
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
            <p className="text-[11px]" style={{ color: "rgba(152,117,84,0.7)", fontFamily: "'Poppins', sans-serif" }}>
              Showing {filtered.length} of {staffData.length} staff member{staffData.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── Add Staff Modal ── */}
      <Modal
        title={modalTitle("Add Staff Member")}
        open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields(); }}
        footer={null}
        centered
        style={{ borderRadius: 16 }}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={(values) => createStaff.mutate(values)}
          initialValues={{ is_active: true, is_verified: true, is_staff: true }}
          className="pt-3"
        >
          <StaffFormFields isEdit={false} roleOptions={roleOptions} rolesLoading={rolesLoading} />
          <Form.Item className="flex justify-end gap-2 mt-5 mb-0">
            <div className="flex justify-end gap-3">
              <Button onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createStaff.isPending}
                className={goldBtn}
              >
                Add Staff
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Edit Staff Modal ── */}
      <Modal
        title={modalTitle("Edit Staff Member")}
        open={editOpen}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); }}
        footer={null}
        centered
        style={{ borderRadius: 16 }}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateStaff.mutate({ id: editStaff?.id, ...values })}
          className="pt-3"
        >
          <StaffFormFields isEdit roleOptions={roleOptions} rolesLoading={rolesLoading} />
          <Form.Item className="flex justify-end gap-2 mt-5 mb-0">
            <div className="flex justify-end gap-3">
              <Button onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateStaff.isPending}
                className={goldBtn}
              >
                Update Staff
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
