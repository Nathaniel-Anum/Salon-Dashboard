/**
 * InventoryPage.jsx
 * ─────────────────
 * Full CRUD page for commerce inventory.
 *
 * Endpoints:
 *   GET    /api/portal/v1/commerce/inventory/        → list
 *   POST   /api/portal/v1/commerce/inventory/        → create  { product, quantity_available, reorder_level }
 *   PATCH  /api/portal/v1/commerce/inventory/{id}/   → update
 *   DELETE /api/portal/v1/commerce/inventory/{id}/   → delete
 *
 * Design: cream / gold palette — matches the rest of the dashboard.
 */

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Form,
  InputNumber,
  Select,
  Button,
  message,
  Popconfirm,
  Tooltip,
  Table,
  Tag,
} from "antd";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiArchive,
  FiAlertTriangle,
  FiPackage,
  FiLayers,
  FiRefreshCw,
} from "react-icons/fi";
import {
  getInventory,
  createInventory,
  updateInventory,
  deleteInventory,
  getProducts,
} from "../src/api/commerce";

const GOLD_BTN = "!bg-[#BBA14F] !border-none hover:!bg-[#a08340] !text-white";

/* ─────────────────────────────────────────────
   FORM FIELDS
───────────────────────────────────────────── */
function InventoryFormFields({ products, isEdit }) {
  return (
    <div className="space-y-5">

      {/* ── Product selector ── */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: "#fff",
          border: "1px solid rgba(187,161,79,0.2)",
          boxShadow: "0 1px 6px rgba(39,39,39,0.04)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, rgba(187,161,79,0.18), rgba(152,117,84,0.12))" }}
          >
            <FiPackage size={13} style={{ color: "#BBA14F" }} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
            Product
          </p>
        </div>
        <Form.Item
          name="product"
          rules={[{ required: true, message: "Please select a product" }]}
          style={{ marginBottom: 0 }}
        >
          <Select
            placeholder="Search and select a product…"
            disabled={isEdit}
            options={(Array.isArray(products) ? products : products?.results ?? []).map(
              (p) => ({ label: p.name, value: p.id })
            )}
            showSearch
            filterOption={(input, option) =>
              option?.label?.toLowerCase().includes(input.toLowerCase())
            }
            style={{ fontFamily: "'Poppins', sans-serif" }}
          />
        </Form.Item>
        {isEdit && (
          <p className="text-[11px] mt-2" style={{ color: "rgba(152,117,84,0.7)", fontFamily: "'Poppins', sans-serif" }}>
            Product cannot be changed after creation.
          </p>
        )}
      </div>

      {/* ── Section label ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "rgba(187,161,79,0.2)" }} />
        <p className="text-[10px] uppercase tracking-[0.22em] font-semibold shrink-0" style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}>
          Stock Details
        </p>
        <div className="flex-1 h-px" style={{ background: "rgba(187,161,79,0.2)" }} />
      </div>

      {/* ── Quantity + Reorder cards ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Quantity Available */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "#fff",
            border: "1px solid rgba(187,161,79,0.2)",
            boxShadow: "0 1px 6px rgba(39,39,39,0.04)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(34,160,80,0.14), rgba(34,160,80,0.07))" }}
            >
              <FiLayers size={13} style={{ color: "#1a8a40" }} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider leading-tight" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
              Qty Available
            </p>
          </div>
          <Form.Item
            name="quantity_available"
            rules={[{ required: true, message: "Required" }]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={0}
              placeholder="e.g. 50"
              className="!rounded-xl w-full"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            />
          </Form.Item>
          <p className="text-[10px] mt-2 leading-snug" style={{ color: "rgba(152,117,84,0.65)", fontFamily: "'Poppins', sans-serif" }}>
            Units currently in stock
          </p>
        </div>

        {/* Reorder Level */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: "#fff",
            border: "1px solid rgba(187,161,79,0.2)",
            boxShadow: "0 1px 6px rgba(39,39,39,0.04)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(230,168,23,0.18), rgba(230,168,23,0.08))" }}
            >
              <FiRefreshCw size={12} style={{ color: "#a06800" }} />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider leading-tight" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
              Reorder Level
            </p>
          </div>
          <Form.Item
            name="reorder_level"
            dependencies={["quantity_available"]}
            rules={[
              { required: true, message: "Required" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const qty = getFieldValue("quantity_available");
                  if (value == null || value === "") return Promise.resolve();
                  if (qty != null && value > qty) {
                    return Promise.reject(
                      new Error("Reorder level cannot exceed quantity available")
                    );
                  }
                  return Promise.resolve();
                },
              }),
            ]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={0}
              placeholder="e.g. 10"
              className="!rounded-xl w-full"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            />
          </Form.Item>
          <p className="text-[10px] mt-2 leading-snug" style={{ color: "rgba(152,117,84,0.65)", fontFamily: "'Poppins', sans-serif" }}>
            Alert when stock hits this
          </p>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function InventoryPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [editTarget, setEditTarget] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [messageApi, msgCtx] = message.useMessage();

  /* ── Data ── */
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ["commerce-inventory"],
    queryFn: getInventory,
  });

  const { data: productData } = useQuery({
    queryKey: ["commerce-products"],
    queryFn: getProducts,
  });

  const productMap = useMemo(() => {
    const list = Array.isArray(productData)
      ? productData
      : productData?.results ?? [];
    return Object.fromEntries(list.map((p) => [p.id, p]));
  }, [productData]);

  const inventory = useMemo(() => {
    const list = Array.isArray(inventoryData)
      ? inventoryData
      : inventoryData?.results ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((item) => {
      const product = productMap[item.product];
      return product?.name?.toLowerCase().includes(q);
    });
  }, [inventoryData, search, productMap]);

  /* ── Modal helpers ── */
  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    form.setFieldsValue({
      product: item.product,
      quantity_available: item.quantity_available,
      reorder_level: item.reorder_level,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    form.resetFields();
  };

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: (values) =>
      editTarget
        ? updateInventory(editTarget.id, values)
        : createInventory(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-inventory"] });
      messageApi.success(editTarget ? "Inventory updated!" : "Inventory record created!");
      closeModal();
    },
    onError: () => messageApi.error("Something went wrong. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-inventory"] });
      messageApi.success("Inventory record deleted.");
    },
    onError: () => messageApi.error("Could not delete record."),
  });

  /* ── Table columns ── */
  const columns = [
    {
      title: "Product",
      key: "product",
      render: (_, record) => {
        const product = productMap[record.product];
        return (
          <div className="flex items-center gap-3">
            {product?.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-9 h-9 rounded-xl object-cover shrink-0"
                style={{ border: "1px solid rgba(187,161,79,0.2)" }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(187,161,79,0.12), rgba(152,117,84,0.08))",
                  border: "1.5px dashed rgba(187,161,79,0.3)",
                }}
              >
                <FiArchive size={14} style={{ color: "#BBA14F", opacity: 0.6 }} />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-[#272727] leading-none mb-0.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {product?.name ?? `Product #${record.product}`}
              </p>
              {product?.sku && (
                <p className="text-[11px]" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                  SKU: {product.sku}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Qty Available",
      dataIndex: "quantity_available",
      key: "quantity_available",
      width: 150,
      render: (val, record) => {
        const low = val <= record.reorder_level;
        return (
          <div className="flex items-center gap-1.5">
            {low && (
              <Tooltip title="Below reorder level">
                <FiAlertTriangle size={13} style={{ color: "#e6a817", flexShrink: 0 }} />
              </Tooltip>
            )}
            <span
              className="font-semibold text-sm"
              style={{ color: low ? "#c47d00" : "#272727", fontFamily: "'Poppins', sans-serif" }}
            >
              {val}
            </span>
          </div>
        );
      },
    },
    {
      title: "Reorder Level",
      dataIndex: "reorder_level",
      key: "reorder_level",
      width: 150,
      render: (val) => (
        <span className="text-sm" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
          {val}
        </span>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 130,
      render: (_, record) => {
        const low = record.quantity_available <= record.reorder_level;
        const out = record.quantity_available === 0;
        return (
          <Tag
            style={{
              borderRadius: 20,
              fontSize: 11,
              fontFamily: "'Poppins', sans-serif",
              border: "none",
              background: out
                ? "rgba(220,60,60,0.1)"
                : low
                ? "rgba(230,168,23,0.12)"
                : "rgba(34,160,80,0.1)",
              color: out ? "#b83232" : low ? "#a06800" : "#1a8a40",
            }}
          >
            {out ? "Out of Stock" : low ? "Low Stock" : "In Stock"}
          </Tag>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, record) => (
        <div className="flex items-center gap-2 justify-end">
          <Tooltip title="Edit">
            <button
              onClick={() => openEdit(record)}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: "rgba(187,161,79,0.1)",
                border: "1px solid rgba(187,161,79,0.25)",
                color: "#BBA14F",
                cursor: "pointer",
              }}
            >
              <FiEdit2 size={13} />
            </button>
          </Tooltip>

          <Popconfirm
            title="Delete Record"
            description="This action cannot be undone."
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <button
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: "rgba(220,60,60,0.07)",
                  border: "1px solid rgba(220,60,60,0.2)",
                  color: "#e05555",
                  cursor: "pointer",
                }}
              >
                <FiTrash2 size={13} />
              </button>
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div style={{ animation: "fadeInUp 0.45s ease both" }} className="space-y-7">
      {msgCtx}

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
        <div
          className="absolute right-0 top-0 h-full w-1/3 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 80% 50%, rgba(187,161,79,0.13), transparent 70%)",
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
              Inventory
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Poppins', sans-serif" }}
            >
              Track stock levels and reorder points for your products
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="px-4 py-2 rounded-xl text-center"
              style={{
                background: "rgba(187,161,79,0.15)",
                border: "1px solid rgba(187,161,79,0.25)",
              }}
            >
              <p
                className="text-lg font-bold"
                style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}
              >
                {Array.isArray(inventoryData) ? inventoryData.length : inventoryData?.results?.length ?? 0}
              </p>
              <p
                className="text-[10px] uppercase tracking-widest mt-0.5"
                style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Poppins', sans-serif" }}
              >
                Records
              </p>
            </div>
            <Button
              icon={<FiPlus />}
              className={`${GOLD_BTN} !rounded-xl !h-10 !px-5 !font-medium !text-sm shrink-0`}
              onClick={openCreate}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Add Record
            </Button>
          </div>
        </div>
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
          placeholder="Search by product name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#c8b88a] w-full"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ color: "#987554", background: "none", border: "none", cursor: "pointer", lineHeight: 1, fontSize: 18 }}
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
          border: "1px solid rgba(187,161,79,0.18)",
          boxShadow: "0 2px 12px rgba(39,39,39,0.06)",
        }}
      >
        <Table
          dataSource={inventory}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 12, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{
            emptyText: (
              <div
                className="flex flex-col items-center justify-center py-16 gap-3"
                style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
              >
                <FiArchive size={34} style={{ opacity: 0.3 }} />
                <p className="text-sm">
                  {search ? "No records match your search" : "No inventory records yet — add your first one!"}
                </p>
                {!search && (
                  <Button
                    icon={<FiPlus />}
                    className={`${GOLD_BTN} !rounded-xl !h-9 !px-5 !text-sm`}
                    onClick={openCreate}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    Add Record
                  </Button>
                )}
              </div>
            ),
          }}
          style={{ fontFamily: "'Poppins', sans-serif" }}
        />
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        centered
        width={520}
        closable={false}
        styles={{
          content: { padding: 0, borderRadius: 20, overflow: "hidden" },
          mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.5)" },
        }}
      >
        {/* Modal Header */}
        <div
          className="relative overflow-hidden px-6 pt-6 pb-5"
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
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #BBA14F, #987554)",
                  boxShadow: "0 4px 14px rgba(187,161,79,0.4)",
                }}
              >
                <FiArchive size={18} color="#fff" />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                >
                  {editTarget ? "Update" : "New Record"}
                </p>
                <h3
                  className="text-base font-bold text-white leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {editTarget ? "Edit Inventory" : "Add Inventory"}
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

        {/* Modal Body */}
        <div className="px-6 py-6" style={{ background: "#FDFAF5" }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => {
              const qty = values.quantity_available;
              const reorder = values.reorder_level;
              if (qty != null && reorder != null && reorder > qty) {
                form.setFields([{
                  name: "reorder_level",
                  errors: ["Reorder level cannot exceed quantity available"],
                }]);
                return;
              }
              saveMutation.mutate(values);
            }}
          >
            <InventoryFormFields
              products={productData}
              isEdit={!!editTarget}
            />
            <div className="flex justify-end gap-3 mt-5">
              <Button
                onClick={closeModal}
                className="!rounded-xl !h-10 !px-5"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                loading={saveMutation.isPending}
                className={`${GOLD_BTN} !rounded-xl !h-10 !px-7 !font-medium`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {editTarget ? "Save Changes" : "Add Record"}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
