import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Table, Modal, Form, Input, Select, Button, Switch } from "antd";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import _axios from "../src/api/_axios";

export default function Staff() {
  const queryClient = useQueryClient();

  // --- MODAL STATES ---
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStaff, setEditStaff] = useState(null);

  // --- FORMS ---
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // --- FETCH STAFF ---
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () =>
      _axios.get("/api/portal/v1/accounts/staff/").then((res) => res.data),
  });

  // --- FETCH ROLES ---
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () =>
      _axios.get("/api/portal/v1/accounts/roles/").then((res) => res.data),
  });

  console.log("rolesData:", rolesData);

  // --- CREATE STAFF ---
  const createStaff = useMutation({
    mutationFn: (data) => _axios.post("/api/portal/v1/accounts/staff/", data),
    onSuccess: () => {
        message.success("Staff Successfully added")
      queryClient.invalidateQueries(["staff"]);
      setAddOpen(false);
      addForm.resetFields();
    },
  });

  // --- UPDATE STAFF ---
  const updateStaff = useMutation({
    mutationFn: (data) =>
      _axios.patch(`/api/portal/v1/accounts/staff/${data.id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["staff"]);
      setEditOpen(false);
      editForm.resetFields();
    },
  });

  // --- DELETE STAFF ---
  const deleteStaff = useMutation({
    mutationFn: (id) => _axios.delete(`/api/portal/v1/accounts/staff/${id}/`),
    onSuccess: () => queryClient.invalidateQueries(["staff"]),
  });

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

  // --- TABLE COLUMNS ---
  const columns = [
    { title: "Full Name", dataIndex: "full_name", key: "full_name" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Phone", dataIndex: "phone", key: "phone" },
    {
      title: "Active",
      dataIndex: "is_active",
      key: "is_active",
      render: (val) => <span>{val ? "Yes" : "No"}</span>,
    },
    {
      title: "Roles",
      dataIndex: "roles",
      key: "roles",
      render: (roles) => roles?.map((r) => r.name).join(", "),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div className="flex gap-2">
          <FiEdit2
            className="cursor-pointer hover:text-[#bfa46f]"
            onClick={() => handleEdit(record)}
          />
          <FiTrash2
            className="cursor-pointer hover:text-red-500"
            onClick={() => deleteStaff.mutate(record.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#e4d9c6] shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-[#2a2a2a]">Staff</h2>
        <div className="flex gap-3">
          {/* <Button
            type="primary"
            icon={<FiPlus />}
            className="flex items-center gap-2 px-5 py-2 rounded-full
                     bg-gradient-to-r from-[#c6a96b] to-[#bfa46f]
                     text-white shadow-sm hover:scale-[1.02]
                     transition-all duration-300 cursor-pointer"
            onClick={() => setAddOpen(true)}
          >
            Add Staff
          </Button> */}

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-full
                               bg-gradient-to-r from-[#c6a96b] to-[#bfa46f]
                               text-white shadow-sm hover:scale-[1.02]
                               transition-all duration-300 cursor-pointer"
          >
            <FiPlus />
            Add Staff
          </button>
          {/* <Button
            type="primary"
            icon={<FiPlus />}
            className="bg-gradient-to-r from-[#6bc6a9] to-[#6bbfa4]"
            onClick={() => alert("Invite Staff functionality")}
          >
            Invite Staff
          </Button> */}
        </div>
      </div>

      <Table
        loading={staffLoading}
        columns={columns}
        dataSource={staffData || []}
        rowKey="id"
        pagination={{ pageSize: 5 }}
      />

      {/* --- ADD STAFF MODAL --- */}
      <Modal
        title="Add Staff"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        footer={null}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={(values) => createStaff.mutate(values)}
          initialValues={{
            is_active: true,
            is_verified: true,
            is_staff: true,
          }}
        >
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="role_ids" label="Roles">
           {rolesData && (
  <Select
    mode="multiple"
    placeholder="Select Roles"
    options={rolesData.map((r) => ({ label: r.name, value: r.id }))}
  />
)}
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              className="bg-[#c6a96b] hover:bg-[#bfa46f] border-none"
            >
              Add
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* --- EDIT STAFF MODAL --- */}
      <Modal
        title="Edit Staff"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) =>
            updateStaff.mutate({ id: editStaff.id, ...values })
          }
        >
          <Form.Item
            name="full_name"
            label="Full Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password">
            <Input.Password placeholder="Leave empty to keep current" />
          </Form.Item>
          <Form.Item name="role_ids" label="Roles">
            <Select
              mode="multiple"
              placeholder="Select Roles"
              options={rolesData?.map((r) => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              className="bg-[#c6a96b] hover:bg-[#bfa46f] border-none"
            >
              Update
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
