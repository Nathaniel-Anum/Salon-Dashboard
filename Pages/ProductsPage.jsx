/**
 * ProductsPage.jsx
 * ────────────────
 * Full CRUD page for commerce products.
 *
 * Endpoints:
 *   GET    /api/portal/v1/commerce/products/        → list
 *   POST   /api/portal/v1/commerce/products/        → create
 *   PATCH  /api/portal/v1/commerce/products/{id}/   → update
 *   DELETE /api/portal/v1/commerce/products/{id}/   → delete (PopConfirm)
 *   GET    /api/portal/v1/commerce/categories/      → for selector
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
  Switch,
  Button,
  Upload,
  Image,
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
  FiPackage,
  FiTag,
  FiImage,
  FiUpload,
} from "react-icons/fi";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
} from "../src/api/commerce";

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

/* ─────────────────────────────────────────────
   FORM FIELDS  (module-level → avoids re-mount)
───────────────────────────────────────────── */
function ProductFormFields({ categories, currentImage = null, isEdit = false }) {
  return (
    <>
      <Form.Item
        name="category"
        label="Category"
        rules={[{ required: true, message: "Please select a category" }]}
      >
        <Select
          placeholder="Select a category"
          className="!rounded-xl"
          options={(Array.isArray(categories) ? categories : categories?.results ?? []).map(
            (c) => ({ label: c.name, value: c.id })
          )}
          showSearch
          filterOption={(input, option) =>
            option?.label?.toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>

      <div className="flex flex-col sm:flex-row gap-4">
        <Form.Item
          name="name"
          label="Product Name"
          className="flex-1"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input placeholder="e.g. Argan Oil Shampoo" className="!rounded-xl" />
        </Form.Item>
        <Form.Item
          name="sku"
          label="SKU"
          className="flex-1"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input placeholder="e.g. SKU-001" className="!rounded-xl" />
        </Form.Item>
      </div>

      <Form.Item name="description" label="Description">
        <Input.TextArea
          rows={3}
          placeholder="Product description…"
          className="!rounded-xl"
        />
      </Form.Item>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex flex-col gap-1.5">
          {isEdit && currentImage && (
            <img
              src={currentImage}
              alt="Current"
              className="w-14 h-14 rounded-xl object-cover"
              style={{ border: "1px solid rgba(187,161,79,0.25)" }}
            />
          )}
          <Form.Item
            name="image"
            label={isEdit && currentImage ? "Replace Image" : "Image"}
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            style={{ marginBottom: 0 }}
          >
            <Upload
              accept="image/*"
              beforeUpload={() => false}
              maxCount={1}
              listType="text"
            >
              <Button
                icon={<FiUpload size={13} />}
                className="!rounded-xl !border-[rgba(187,161,79,0.4)] !text-[#987554] hover:!border-[#BBA14F] hover:!text-[#BBA14F]"
              >
                {isEdit && currentImage ? "Upload New Image" : "Upload Image"}
              </Button>
            </Upload>
          </Form.Item>
        </div>
        <Form.Item
          name="price"
          label="Price (GHS)"
          className="flex-1"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input placeholder="e.g. 49.99" className="!rounded-xl" />
        </Form.Item>
      </div>

      <Form.Item name="is_active" label="Active" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function ProductsPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [editTarget, setEditTarget] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [messageApi, msgCtx] = message.useMessage();

  /* ── Data ── */
  const { data: productData, isLoading } = useQuery({
    queryKey: ["commerce-products"],
    queryFn: getProducts,
  });

  const { data: categoryData } = useQuery({
    queryKey: ["commerce-categories"],
    queryFn: getCategories,
  });

  const categoryMap = useMemo(() => {
    const list = Array.isArray(categoryData)
      ? categoryData
      : categoryData?.results ?? [];
    return Object.fromEntries(list.map((c) => [c.id, c.name]));
  }, [categoryData]);

  const products = useMemo(() => {
    const list = Array.isArray(productData)
      ? productData
      : productData?.results ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        categoryMap[p.category]?.toLowerCase().includes(q)
    );
  }, [productData, search, categoryMap]);

  /* ── Modal helpers ── */
  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    form.setFieldValue("is_active", true);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditTarget(product);
    form.setFieldsValue({
      category: product.category,
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: product.price,
      is_active: product.is_active,
      image: undefined, // file field — don't pre-fill
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
        ? updateProduct(editTarget.id, values)
        : createProduct(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-products"] });
      messageApi.success(editTarget ? "Product updated!" : "Product created!");
      closeModal();
    },
    onError: () => messageApi.error("Something went wrong. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-products"] });
      messageApi.success("Product deleted.");
    },
    onError: () => messageApi.error("Could not delete product."),
  });

  /* ── Table columns ── */
  const columns = [
    {
      title: "Product",
      key: "product",
      render: (_, record) => (
        <div className="flex items-center gap-3">
          {record.image ? (
            <img
              src={record.image}
              alt={record.name}
              onClick={() => setPreviewImage(record.image)}
              className="w-10 h-10 rounded-xl object-cover shrink-0 cursor-zoom-in"
              style={{ border: "1px solid rgba(187,161,79,0.2)" }}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(187,161,79,0.12), rgba(152,117,84,0.08))",
                border: "1.5px dashed rgba(187,161,79,0.3)",
              }}
            >
              <FiImage size={15} style={{ color: "#BBA14F", opacity: 0.6 }} />
            </div>
          )}
          <div>
            <p
              className="text-sm font-semibold text-[#272727] leading-none mb-0.5"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {record.name}
            </p>
            <p
              className="text-xs"
              style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
            >
              SKU: {record.sku ?? "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Category",
      key: "category",
      render: (_, record) => (
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{
            background: "rgba(187,161,79,0.1)",
            color: "#7a6030",
            border: "1px solid rgba(187,161,79,0.22)",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {categoryMap[record.category] ?? "—"}
        </span>
      ),
    },
    {
      title: "Price",
      key: "price",
      render: (_, record) => (
        <span
          className="text-sm font-semibold"
          style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}
        >
          {formatPrice(record.price)}
        </span>
      ),
    },
    {
      title: "Status",
      key: "is_active",
      render: (_, record) => (
        <span
          className="text-xs px-3 py-1 rounded-full font-medium"
          style={{
            background: record.is_active
              ? "rgba(34,160,80,0.1)"
              : "rgba(200,60,60,0.1)",
            color: record.is_active ? "#1a8a40" : "#b83232",
          }}
        >
          {record.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <Tooltip title="Edit">
            <button
              onClick={() => openEdit(record)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
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
            title="Delete Product"
            description="Are you sure you want to delete this product?"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: "rgba(220,60,60,0.08)",
                  border: "1px solid rgba(220,60,60,0.2)",
                  color: "#d94040",
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
              Products
            </h1>
            <p
              className="text-sm mt-1"
              style={{
                color: "rgba(255,255,255,0.55)",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Manage your product catalogue
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
                {Array.isArray(productData)
                  ? productData.length
                  : productData?.results?.length ?? 0}
              </p>
              <p
                className="text-[10px] uppercase tracking-widest mt-0.5"
                style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Poppins', sans-serif" }}
              >
                Total
              </p>
            </div>
            <Button
              icon={<FiPlus />}
              className={`${GOLD_BTN} !rounded-xl !h-10 !px-5 !font-medium !text-sm shrink-0`}
              onClick={openCreate}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Add Product
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
          placeholder="Search by name, SKU or category…"
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
          dataSource={products}
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
                <FiPackage size={36} style={{ opacity: 0.3 }} />
                <p className="text-sm">
                  {search ? "No products match your search" : "No products yet — add your first one!"}
                </p>
                {!search && (
                  <Button
                    icon={<FiPlus />}
                    className={`${GOLD_BTN} !rounded-xl !h-9 !px-5 !text-sm`}
                    onClick={openCreate}
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    Add Product
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
                <FiPackage size={18} color="#fff" />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                >
                  {editTarget ? "Update" : "New Product"}
                </p>
                <h3
                  className="text-base font-bold text-white leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {editTarget ? "Edit Product" : "Add Product"}
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

        {/* Body */}
        <div className="px-6 py-5" style={{ background: "#FDFAF5" }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => {
              const fd = new FormData();
              if (values.category) fd.append("category", values.category);
              fd.append("name", values.name ?? "");
              fd.append("sku", values.sku ?? "");
              if (values.description) fd.append("description", values.description);
              fd.append("price", values.price ?? "");
              fd.append("is_active", values.is_active ?? true);
              const imageFile = values.image?.[0]?.originFileObj;
              if (imageFile) fd.append("image", imageFile);
              saveMutation.mutate(fd);
            }}
          >
            <ProductFormFields
              categories={categoryData}
              isEdit={!!editTarget}
              currentImage={editTarget?.image ?? null}
            />
            <div className="flex justify-end gap-3 mt-2">
              <Button
                onClick={closeModal}
                className="!rounded-xl !h-9"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                loading={saveMutation.isPending}
                className={`${GOLD_BTN} !rounded-xl !h-9 !px-6`}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {editTarget ? "Save Changes" : "Create Product"}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>

      {/* ── Image preview lightbox ── */}
      {previewImage && (
        <Image
          style={{ display: "none" }}
          src={previewImage}
          preview={{
            visible: true,
            onVisibleChange: (v) => { if (!v) setPreviewImage(null); },
          }}
        />
      )}
    </div>
  );
}
