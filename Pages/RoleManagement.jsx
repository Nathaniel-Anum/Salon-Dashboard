import React, { useState } from "react";
import { Table, Modal, Select, Input, Button } from "antd";
import { FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import _axios from "../src/api/_axios";

const RoleManagement = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", permissions: [] });

  const queryClient = useQueryClient();

  //  Get roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/roles/"),
  });

  //  Get permissions
  const { data: permissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/permissions/"),
  });

//   console.log(permissionsData?.data);
  //  Create role
  const createRole = useMutation({
    mutationFn: (data) => _axios.post("/api/portal/v1/accounts/roles/", data),
    onSuccess: () => {
      queryClient.invalidateQueries(["roles"]);
      setOpen(false);
      setForm({ name: "", permissions: [] });
    },
  });

  //  Delete role
  const deleteRole = useMutation({
    mutationFn: (id) => _axios.delete(`/api/portal/v1/accounts/roles/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries(["roles"]);
    },
  });

  const roles = rolesData?.data || [];
  const permissions = permissionsData?.data || [];

  //  Table columns
  const columns = [
    {
      title: "Role",
      dataIndex: "name",
      render: (text) => (
        <span className="font-medium text-[#2a2a2a]">{text}</span>
      ),
    },
    //    {
    //   title: "Permissions",
    //   dataIndex: "permissions",
    //   render: (permissions) => (
    //     <div className="flex flex-wrap gap-2">
    //       {permissions?.map((p, index) => {
    //         const label = p.split(".")[1]?.replace("_", " ");

    //         return (
    //           <span
    //             key={index}
    //             className="text-xs px-3 py-1 rounded-full
    //                        bg-[#f5efe6] border border-[#e4d9c6]
    //                        capitalize tracking-wide"
    //           >
    //             {label}
    //           </span>
    //         );
    //       })}
    //     </div>
    //   ),
    // },

    {
      title: "Permissions",
      dataIndex: "permissions",
      render: (permissions) => (
        <div className="flex flex-wrap gap-2">
          {permissions?.map((p, index) => (
            <span
              key={index}
              className="text-xs px-2 py-1 rounded-full bg-[#f5efe6] border border-[#e4d9c6]"
            >
              {p}
            </span>
          ))}
        </div>
      ),
    },
    {
      title: "Action",
      render: (_, record) => (
        <div className="flex gap-4 text-lg">
          <FiEdit2 className="cursor-pointer hover:text-[#bfa46f]" />
          <FiTrash2
            onClick={() => deleteRole.mutate(record.id)}
            className="cursor-pointer hover:text-red-500"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-semibold tracking-wide text-[#2a2a2a]">
          Roles & Permissions
        </h2>

        {/* Add Button */}
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-5 py-2 rounded-full
                     bg-gradient-to-r from-[#c6a96b] to-[#bfa46f]
                     text-white shadow-sm hover:scale-[1.02]
                     transition-all duration-300 cursor-pointer"
        >
          <FiPlus />
          Add Role
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl p-6 border border-[#e4d9c6] shadow-sm">
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 6 }}
        />
      </div>

      {/* Modal */}
      
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
       
         wrapClassName="modal"
           maskStyle={{
    backdropFilter: "blur(4px)",
    backgroundColor: "rgba(0,0,0,0.3)",
  }}
      >
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-6 text-[#2a2a2a]">
            Add Role
          </h3>

          {/* Name */}
          <div className="mb-4">
            <label className="text-sm text-gray-600">Role Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 rounded-lg border-black/20 focus:border-black"
            />
          </div>

          {/* Permissions */}
          <div className="mb-6">
            <label className="text-sm text-gray-600">Permissions</label>
            <Select
              mode="multiple"
              placeholder="Select permissions"
              className="w-full mt-1"
              value={form.permissions}
              onChange={(value) => setForm({ ...form, permissions: value })}
              options={permissions.map((p) => ({
                label: p.description,
                value: p.id,
              }))}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button onClick={() => setOpen(false)}>Cancel</Button>

            <Button
              type="primary"
              loading={createRole.isPending}
              onClick={() => createRole.mutate(form)}
              className="bg-[#c6a96b] hover:bg-[#bfa46f] border-none"
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RoleManagement;
