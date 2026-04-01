import React, { useState } from "react";
import { Table, Modal, Select, Input, Button, message, Tag } from "antd";
import { FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import _axios from "../src/api/_axios";

const RoleManagement = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", permission_ids: [] });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, name: "", permission_ids: [] });

  const queryClient = useQueryClient();

  // Get roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/roles/").then((r) => r.data),
  });

  // Get permissions
  const { data: permissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/permissions/").then((r) => r.data),
  });

  // Create role
  const createRole = useMutation({
    mutationFn: (data) => _axios.post("/api/portal/v1/accounts/roles/", data),
    onSuccess: () => {
      message.success("Role created successfully");
      queryClient.invalidateQueries(["roles"]);
      setOpen(false);
      setForm({ name: "", permission_ids: [] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to create role");
    },
  });

  // Update role
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
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to update role");
    },
  });

  // Delete role
  const deleteRole = useMutation({
    mutationFn: (id) => _axios.delete(`/api/portal/v1/accounts/roles/${id}/`),
    onSuccess: () => {
      message.success("Role deleted successfully");
      queryClient.invalidateQueries(["roles"]);
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to delete role");
    },
  });

  const handleEdit = (role) => {
    // permissions can be objects [{id,...}] or string codenames — always resolve to integer IDs
    const ids = (role.permissions || [])
      .map((p) => {
        if (typeof p === "object" && p !== null) return Number(p.id);
        // string codename / name — look up the integer ID from the permissions list
        const found = permissions.find(
          (perm) =>
            perm.codename === p ||
            perm.name === p ||
            perm.description === p ||
            String(perm.id) === String(p)
        );
        return found ? Number(found.id) : null;
      })
      .filter((id) => id !== null && !isNaN(id));

    setEditForm({ id: role.id, name: role.name, permission_ids: ids });
    setEditOpen(true);
  };

  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.results || [];
  const permissions = Array.isArray(permissionsData) ? permissionsData : permissionsData?.results || [];

  const permissionOptions = permissions.map((p) => ({
    label: p.description || p.name || p.codename || String(p.id),
    value: p.id,
  }));

  // Table columns
  const columns = [
    {
      title: "Role",
      dataIndex: "name",
      render: (text) => (
        <span className="font-medium text-[#2a2a2a]" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {text}
        </span>
      ),
    },
    {
      title: "Permissions",
      dataIndex: "permissions",
      render: (perms) => {
        if (!perms || perms.length === 0)
          return <span className="text-xs text-gray-400">None</span>;
        return (
          <div className="flex flex-wrap gap-1.5">
            {perms.map((p, i) => {
              const label = typeof p === "object"
                ? (p.description || p.name || p.codename || `#${p.id}`)
                : String(p);
              return (
                <Tag
                  key={i}
                  className="text-xs rounded-full border-0 m-0"
                  style={{
                    background: "rgba(187,161,79,0.12)",
                    color: "#8a6f2e",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  {label}
                </Tag>
              );
            })}
          </div>
        );
      },
    },
    {
      title: "Action",
      width: 80,
      render: (_, record) => (
        <div className="flex gap-4 text-lg">
          <FiEdit2
            className="cursor-pointer hover:text-[#bfa46f] transition-colors"
            onClick={() => handleEdit(record)}
          />
          <FiTrash2
            className="cursor-pointer hover:text-red-500 transition-colors"
            onClick={() => deleteRole.mutate(record.id)}
          />
        </div>
      ),
    },
  ];

  const modalStyle = {
    borderRadius: 16,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
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
          onClick={() => setOpen(true)}
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

      {/* Table */}
      <div
        className="rounded-2xl p-6"
        style={{
         
          border: "1px solid rgba(187,161,79,0.18)",
          boxShadow: "0 4px 20px rgba(39,39,39,0.05)",
        }}
      >
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8 }}
          rowClassName={() => "hover:bg-[#fdf6ea] transition-colors"}
        />
      </div>

      {/* ── Add Role Modal ── */}
      <Modal
        title={
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#272727" }}>
            Add New Role
          </span>
        }
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
        style={modalStyle}
      >
        <div className="pt-4 pb-2">
          <div className="mb-4">
            <label className="text-sm font-medium text-[#272727] block mb-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Role Name
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              value={form.permission_ids}
              onChange={(value) => setForm({ ...form, permission_ids: value })}
              options={permissionOptions}
              allowClear
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              loading={createRole.isPending}
              onClick={() => createRole.mutate(form)}
              className="!bg-[#BBA14F] !border-none hover:!bg-[#a08340]"
            >
              Save Role
            </Button>
          </div>
        </div>
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
        style={modalStyle}
      >
        <div className="pt-4 pb-2">
          <div className="mb-4">
            <label className="text-sm font-medium text-[#272727] block mb-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Role Name
            </label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
              value={editForm.permission_ids}
              onChange={(value) => setEditForm({ ...editForm, permission_ids: value })}
              options={permissionOptions}
              allowClear
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              loading={updateRole.isPending}
              onClick={() =>
                updateRole.mutate({
                  ...editForm,
                  permission_ids: editForm.permission_ids
                    .filter(Boolean)
                    .map(Number)
                    .filter((n) => !isNaN(n)),
                })
              }
              className="!bg-[#BBA14F] !border-none hover:!bg-[#a08340]"
            >
              Update Role
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RoleManagement;
