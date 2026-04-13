import React, { useState } from "react";
import { Modal, Select, Input, Button, message, Spin } from "antd";
import { FiEdit2, FiTrash2, FiPlus, FiShield, FiLock, FiX } from "react-icons/fi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import _axios from "../src/api/_axios";

/* ─── tiny helpers ─────────────────────────────────────── */
/**
 * Extract a human-readable label from a permission object.
 * The API returns { id, label, code } — fall through common field names
 * so it works even if the backend shape changes.
 */
const permLabel = (p) =>
  typeof p === "object" && p !== null
    ? p.label || p.name || p.description || p.codename || p.code || `#${p.id}`
    : String(p);

/**
 * Resolve a permission value (id, codename/code string, or object) to a
 * human-readable label using the full permissions list as a lookup.
 */
const resolvePermLabel = (p, allPerms = []) => {
  if (typeof p === "object" && p !== null) {
    return p.label || p.name || p.description || p.codename || p.code || `#${p.id}`;
  }
  // p is a raw id or code/codename string — look it up
  const found = allPerms.find(
    (perm) =>
      String(perm.id) === String(p) ||
      perm.code === p ||
      perm.codename === p ||
      perm.name === p ||
      perm.label === p
  );
  return found
    ? found.label || found.name || found.description || found.codename || found.code || `#${found.id}`
    : String(p);
};

/* ─── Role Card ────────────────────────────────────────── */
const RoleCard = ({ role, onView, onEdit, onDelete }) => {
  const count = role.permissions?.length ?? 0;

  return (
    <div
      onClick={() => onView(role)}
      className="relative overflow-hidden rounded-2xl cursor-pointer group transition-all duration-300 hover:-translate-y-1.5"
      style={{
        background: "#FDFAF5",
        border: "1px solid rgba(187,161,79,0.22)",
        boxShadow: "0 4px 24px rgba(39,39,39,0.07), inset 0 1px 0 rgba(187,161,79,0.10)",
        minHeight: 200,
      }}
    >
      {/* gold shimmer top-line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, #BBA14F, transparent)" }}
      />

      {/* glowing orb */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-300"
        style={{ background: "radial-gradient(circle, #BBA14F 0%, transparent 70%)" }}
      />

      <div className="relative p-6 flex flex-col h-full">
        {/* top row — icon + actions */}
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(187,161,79,0.15)",
              border: "1px solid rgba(187,161,79,0.3)",
              color: "#BBA14F",
              fontSize: 20,
            }}
          >
            <FiShield />
          </div>

          {/* action buttons — stop propagation so card click doesn't fire */}
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(role); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(187,161,79,0.15)", color: "#BBA14F" }}
              title="Edit role"
            >
              <FiEdit2 size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(role.id); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/20! hover:text-red-400!"
              style={{ background: "rgba(39,39,39,0.06)", color: "#aaa" }}
              title="Delete role"
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        </div>

        {/* role name */}
        <h3
          className="text-lg font-semibold mb-1 leading-snug"
          style={{ fontFamily: "'Playfair Display', serif", color: "#272727" }}
        >
          {role.name}
        </h3>

        {/* divider */}
        <div className="my-4 h-px" style={{ background: "rgba(187,161,79,0.25)" }} />

        {/* permissions count */}
        <div className="flex items-end justify-between mt-auto">
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}>
              Permissions
            </p>
            <p
              className="text-4xl font-bold"
              style={{
                fontFamily: "'Playfair Display', serif",
                background: "linear-gradient(135deg, #BBA14F, #e0c97a)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {count}
            </p>
          </div>
          <span
            className="text-[10px] px-3 py-1 rounded-full tracking-wide"
            style={{
              background: "rgba(187,161,79,0.12)",
              border: "1px solid rgba(187,161,79,0.25)",
              color: "#BBA14F",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {count === 1 ? "1 access" : `${count} access`}
          </span>
        </div>

        {/* click hint */}
        <p className="text-[10px] mt-3 opacity-50 group-hover:opacity-80 transition-opacity" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
          Click to view permissions →
        </p>
      </div>

      {/* bottom gold line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: "linear-gradient(90deg, transparent, #BBA14F, transparent)" }}
      />
    </div>
  );
};

/* ─── Shared Form Modal Body ───────────────────────────── */
const FormBody = ({ values, setValues, onSave, saving, onClose, saveLabel, permissionOptions }) => (
  <div className="pt-4 pb-2">
    <div className="mb-4">
      <label className="text-sm font-medium text-[#272727] block mb-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
        Role Name
      </label>
      <Input
        value={values.name}
        onChange={(e) => setValues({ ...values, name: e.target.value })}
        placeholder="e.g. Senior Stylist"
        className="rounded-xl"
      />
    </div>
    <div className="mb-6">
      <label className="text-sm font-medium text-[#272727] block mb-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
        Permissions
      </label>
      <Select
        mode="multiple"
        placeholder="Select permissions"
        className="w-full"
        value={values.permission_ids}
        onChange={(value) => setValues({ ...values, permission_ids: value })}
        options={permissionOptions}
        allowClear
      />
    </div>
    <div className="flex justify-end gap-3">
      <Button onClick={onClose}>Cancel</Button>
      <Button
        type="primary"
        loading={saving}
        onClick={onSave}
        className="bg-[#BBA14F]! border-none! hover:bg-[#a08340]!"
      >
        {saveLabel}
      </Button>
    </div>
  </div>
);

/* ─── Main Component ───────────────────────────────────── */
const RoleManagement = () => {
  const [addOpen, setAddOpen]     = useState(false);
  const [editOpen, setEditOpen]   = useState(false);
  const [viewOpen, setViewOpen]   = useState(false);
  const [viewRole, setViewRole]   = useState(null);
  const [form, setForm]           = useState({ name: "", permission_ids: [] });
  const [editForm, setEditForm]   = useState({ id: null, name: "", permission_ids: [] });

  const queryClient = useQueryClient();

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/roles/").then((r) => r.data),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/permissions/").then((r) => r.data),
  });

  const createRole = useMutation({
    mutationFn: (data) => _axios.post("/api/portal/v1/accounts/roles/", data),
    onSuccess: () => {
      message.success("Role created successfully");
      queryClient.invalidateQueries(["roles"]);
      setAddOpen(false);
      setForm({ name: "", permission_ids: [] });
    },
    onError: (err) => message.error(err.response?.data?.message || "Failed to create role"),
  });

  const updateRole = useMutation({
    mutationFn: (data) =>
      _axios.patch(`/api/portal/v1/accounts/roles/${data.id}/`, {
        name: data.name,
        permission_ids: data.permission_ids,
      }),
    onSuccess: () => {
      message.success("Role updated successfully");
      queryClient.invalidateQueries(["roles"]);
      setEditOpen(false);
      setEditForm({ id: null, name: "", permission_ids: [] });
    },
    onError: (err) => message.error(err.response?.data?.message || "Failed to update role"),
  });

  const deleteRole = useMutation({
    mutationFn: (id) => _axios.delete(`/api/portal/v1/accounts/roles/${id}/`),
    onSuccess: () => {
      message.success("Role deleted successfully");
      queryClient.invalidateQueries(["roles"]);
    },
    onError: (err) => message.error(err.response?.data?.message || "Failed to delete role"),
  });

  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.results || [];
  const permissions = Array.isArray(permissionsData) ? permissionsData : permissionsData?.results || [];

  const permissionOptions = permissions.map((p) => ({
    label: permLabel(p),
    value: p.id,
  }));

  const handleEdit = (role) => {
    const ids = (role.permissions || [])
      .map((p) => {
        if (typeof p === "object" && p !== null) return Number(p.id);
        const found = permissions.find(
          (perm) =>
            String(perm.id) === String(p) ||
            perm.code === p ||
            perm.codename === p ||
            perm.name === p ||
            perm.label === p ||
            perm.description === p
        );
        return found ? Number(found.id) : null;
      })
      .filter((id) => id !== null && !isNaN(id));
    setEditForm({ id: role.id, name: role.name, permission_ids: ids });
    setEditOpen(true);
  };

  const handleView = (role) => {
    setViewRole(role);
    setViewOpen(true);
  };

  const handleDeleteRole = (id) => {
    Modal.confirm({
      title: "Delete Role",
      content: "Are you sure you want to delete this role? This cannot be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      centered: true,
      onOk: () => deleteRole.mutate(id),
    });
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2
            className="text-xl font-semibold text-[#272727]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Roles & Permissions
          </h2>
          <p className="text-sm text-[#987554] mt-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Manage staff roles and access permissions
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex cursor-pointer items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg"
          style={{
            background: "linear-gradient(135deg, #BBA14F, #987554)",
            fontFamily: "'Poppins', sans-serif",
            boxShadow: "0 4px 14px rgba(187,161,79,0.3)",
          }}
        >
          <FiPlus />
          Add Role
        </button>
      </div>

      {/* ── Cards Grid ── */}
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <Spin size="large" />
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FiShield size={48} className="mb-4" style={{ color: "#BBA14F", opacity: 0.4 }} />
          <p className="text-[#987554]" style={{ fontFamily: "'Poppins', sans-serif" }}>
            No roles yet. Create your first role.
          </p>
        </div>
      ) : (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDeleteRole}
            />
          ))}
        </div>
      )}

      {/* ── View Permissions Modal ── */}
      <Modal
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={null}
        centered
        width={680}
        closeIcon={null}
        styles={{
          content: {
            padding: 0,
            borderRadius: 20,
            overflow: "hidden",
            background: "transparent",
            boxShadow: "0 20px 60px rgba(39,39,39,0.18)",
          },
          mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.35)" },
        }}
      >
        {viewRole && (
          <div style={{ background: "#FDFAF5", border: "1px solid rgba(187,161,79,0.22)" }}>
            {/* Modal header */}
            <div
              className="relative px-8 pt-8 pb-6"
              style={{ borderBottom: "1px solid rgba(187,161,79,0.25)" }}
            >
              {/* gold shimmer */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, #BBA14F 40%, transparent)" }}
              />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      background: "rgba(187,161,79,0.12)",
                      border: "1px solid rgba(187,161,79,0.35)",
                      color: "#BBA14F",
                    }}
                  >
                    <FiShield size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                      Role
                    </p>
                    <h3
                      className="text-2xl font-bold leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif", color: "#272727" }}
                    >
                      {viewRole.name}
                    </h3>
                  </div>
                </div>

                {/* close + count */}
                <div className="flex flex-col items-end gap-3">
                  <button
                    onClick={() => setViewOpen(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
                    style={{ color: "#aaa" }}
                  >
                    <FiX size={16} />
                  </button>
                  <div className="text-right">
                    <p
                      className="text-3xl font-bold leading-none"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        background: "linear-gradient(135deg, #BBA14F, #e0c97a)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {viewRole.permissions?.length ?? 0}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                      permissions
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Permissions list */}
            <div className="px-8 py-6" style={{ maxHeight: 420, overflowY: "auto" }}>
              {!viewRole.permissions || viewRole.permissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <FiLock size={32} style={{ color: "#BBA14F", opacity: 0.35, marginBottom: 12 }} />
                  <p className="text-sm" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                    No permissions assigned to this role.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))" }}>
                  {viewRole.permissions.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                      style={{
                        background: "rgba(187,161,79,0.08)",
                        border: "1px solid rgba(187,161,79,0.22)",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "rgba(187,161,79,0.15)", color: "#BBA14F" }}
                      >
                        <FiLock size={11} />
                      </div>
                      <span
                        className="text-sm leading-snug"
                        style={{ color: "#4a3b1f", fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}
                      >
                        {resolvePermLabel(p, permissions)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div
              className="px-8 py-5 flex justify-between items-center"
              style={{ borderTop: "1px solid rgba(187,161,79,0.25)", background: "rgba(187,161,79,0.03)" }}
            >
              <button
                onClick={() => { setViewOpen(false); handleEdit(viewRole); }}
                className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
              >
                <FiEdit2 size={13} /> Edit Role
              </button>
              <button
                onClick={() => setViewOpen(false)}
                className="px-6 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #BBA14F, #987554)",
                  color: "#fff",
                  fontFamily: "'Poppins', sans-serif",
                  boxShadow: "0 4px 14px rgba(187,161,79,0.25)",
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add Role Modal ── */}
      <Modal
        title={
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#272727" }}>
            Add New Role
          </span>
        }
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        footer={null}
        centered
        styles={{ content: { borderRadius: 16 } }}
      >
        <FormBody
          values={form}
          setValues={setForm}
          onSave={() => createRole.mutate(form)}
          saving={createRole.isPending}
          onClose={() => setAddOpen(false)}
          saveLabel="Save Role"
          permissionOptions={permissionOptions}
        />
      </Modal>

      {/* ── Edit Role Modal ── */}
      <Modal
        title={
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#272727" }}>
            Edit Role
          </span>
        }
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        centered
        styles={{ content: { borderRadius: 16 } }}
      >
        <FormBody
          values={editForm}
          setValues={setEditForm}
          onSave={() =>
            updateRole.mutate({
              ...editForm,
              permission_ids: editForm.permission_ids.filter(Boolean).map(Number).filter((n) => !isNaN(n)),
            })
          }
          saving={updateRole.isPending}
          onClose={() => setEditOpen(false)}
          saveLabel="Update Role"
          permissionOptions={permissionOptions}
        />
      </Modal>
    </div>
  );
};

export default RoleManagement;
