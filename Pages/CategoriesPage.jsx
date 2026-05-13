/**
 * CategoriesPage.jsx
 * ──────────────────
 * Full CRUD page for commerce categories.
 *
 * Endpoints:
 *   GET    /api/portal/v1/commerce/categories/        → list
 *   POST   /api/portal/v1/commerce/categories/        → create
 *   PATCH  /api/portal/v1/commerce/categories/{id}/   → update
 *   DELETE /api/portal/v1/commerce/categories/{id}/   → delete
 *
 * Design: cream / gold palette — matches the rest of the dashboard.
 */

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  Switch,
  Button,
  Upload,
  message,
  Popconfirm,
  Tooltip,
} from "antd";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiTag, FiGrid, FiUpload } from "react-icons/fi";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../src/api/commerce";

const GOLD_BTN = "!bg-[#BBA14F] !border-none hover:!bg-[#a08340] !text-white";

/* ─────────────────────────────────────────────
   FORM FIELDS  (module-level → avoids focus-
   steal re-mount on every render)
───────────────────────────────────────────── */
function CategoryFormFields({ isEdit = false }) {
  return (
    <>
      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true, message: "Category name is required" }]}
      >
        <Input placeholder="e.g. Hair Care" className="!rounded-xl" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input.TextArea
          rows={3}
          placeholder="Brief description of the category…"
          className="!rounded-xl"
        />
      </Form.Item>

      <div className="flex flex-col sm:flex-row gap-4">
        {isEdit ? (
          <Form.Item name="image" label="Image URL" className="flex-1">
            <Input placeholder="https://example.com/image.png" className="!rounded-xl" />
          </Form.Item>
        ) : (
          <Form.Item
            name="image"
            label="Image"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            className="flex-1"
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
                Upload Image
              </Button>
            </Upload>
          </Form.Item>
        )}

        {isEdit ? (
          <Form.Item name="icon" label="Icon" className="flex-1">
            <Input placeholder="e.g. ✂️ or SVG URL" className="!rounded-xl" />
          </Form.Item>
        ) : (
          <Form.Item
            name="icon"
            label="Icon (SVG file)"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
            className="flex-1"
          >
            <Upload
              accept=".svg,image/svg+xml"
              beforeUpload={() => false}
              maxCount={1}
              listType="text"
            >
              <Button
                icon={<FiUpload size={13} />}
                className="!rounded-xl !border-[rgba(187,161,79,0.4)] !text-[#987554] hover:!border-[#BBA14F] hover:!text-[#BBA14F]"
              >
                Upload SVG
              </Button>
            </Upload>
          </Form.Item>
        )}
      </div>

      <Form.Item name="is_active" label="Active" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );
}

/* ─────────────────────────────────────────────
   CATEGORY CARD
───────────────────────────────────────────── */
function CategoryCard({ cat, onEdit, onDelete, deleting }) {
  return (
    <div
      className="relative group rounded-2xl overflow-hidden"
      style={{
        background: "#fff",
        border: "1px solid rgba(187,161,79,0.18)",
        boxShadow: "0 2px 12px rgba(39,39,39,0.06)",
        transition: "box-shadow 0.22s, transform 0.22s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 10px 32px rgba(187,161,79,0.2)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 12px rgba(39,39,39,0.06)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Gold top accent bar */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #BBA14F, #c9ae5e)" }} />

      {/* Image / icon area */}
      <div
        className="flex items-center justify-center py-7"
        style={{ background: "linear-gradient(135deg, #FDFAF5 0%, #F5EFE6 100%)" }}
      >
        {cat.image ? (
          <img
            src={cat.image}
            alt={cat.name}
            className="w-16 h-16 rounded-xl object-cover"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}
          />
        ) : (
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(187,161,79,0.12), rgba(152,117,84,0.08))",
              border: "1.5px dashed rgba(187,161,79,0.35)",
            }}
          >
            {cat.icon ? (
              <span style={{ fontSize: 30 }}>{cat.icon}</span>
            ) : (
              <FiTag size={26} style={{ color: "#BBA14F", opacity: 0.65 }} />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 pb-5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3
            className="font-semibold text-sm leading-snug line-clamp-1 text-[#272727]"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {cat.name}
          </h3>
          <span
            className="shrink-0 text-[10px] px-2.5 py-0.5 rounded-full font-medium"
            style={{
              background: cat.is_active
                ? "rgba(34,160,80,0.1)"
                : "rgba(200,60,60,0.1)",
              color: cat.is_active ? "#1a8a40" : "#b83232",
            }}
          >
            {cat.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        {cat.description && (
          <p
            className="text-xs line-clamp-2"
            style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
          >
            {cat.description}
          </p>
        )}
      </div>

      {/* Hover overlay with actions */}
      <div
        className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl"
        style={{ background: "rgba(39,39,39,0.58)", backdropFilter: "blur(4px)" }}
      >
        <Tooltip title="Edit">
          <button
            onClick={() => onEdit(cat)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <FiEdit2 size={15} />
          </button>
        </Tooltip>

        <Popconfirm
          title="Delete Category"
          description="This action cannot be undone."
          onConfirm={() => onDelete(cat.id)}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Tooltip title="Delete">
            <button
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: "rgba(220,60,60,0.2)",
                border: "1px solid rgba(220,60,60,0.4)",
                color: "#ff8080",
                cursor: "pointer",
              }}
            >
              <FiTrash2 size={15} />
            </button>
          </Tooltip>
        </Popconfirm>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function CategoriesPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [editTarget, setEditTarget] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [messageApi, msgCtx] = message.useMessage();

  /* ── Data ── */
  const { data, isLoading } = useQuery({
    queryKey: ["commerce-categories"],
    queryFn: getCategories,
  });

  const categories = useMemo(() => {
    const list = Array.isArray(data) ? data : data?.results ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [data, search]);

  /* ── Modal helpers ── */
  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    form.setFieldValue("is_active", true);
    setModalOpen(true);
  };

  const openEdit = (cat) => {
    setEditTarget(cat);
    form.setFieldsValue({ ...cat });
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
        ? updateCategory(editTarget.id, values)
        : createCategory(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-categories"] });
      messageApi.success(editTarget ? "Category updated!" : "Category created!");
      closeModal();
    },
    onError: () => messageApi.error("Something went wrong. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commerce-categories"] });
      messageApi.success("Category deleted.");
    },
    onError: () => messageApi.error("Could not delete category."),
  });

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
              Categories
            </h1>
            <p
              className="text-sm mt-1"
              style={{
                color: "rgba(255,255,255,0.55)",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Organise your products into categories
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
                {Array.isArray(data) ? data.length : data?.results?.length ?? 0}
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
              Add Category
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
          placeholder="Search categories…"
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

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl h-52"
              style={{ background: "rgba(187,161,79,0.08)" }}
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl"
          style={{
            background: "#fff",
            border: "1px dashed rgba(187,161,79,0.3)",
            color: "#987554",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <FiGrid size={38} style={{ opacity: 0.3 }} />
          <p className="text-sm">
            {search ? "No categories match your search" : "No categories yet — add your first one!"}
          </p>
          {!search && (
            <Button
              icon={<FiPlus />}
              className={`${GOLD_BTN} !rounded-xl !h-9 !px-5 !text-sm`}
              onClick={openCreate}
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Add Category
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        centered
        width={500}
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
                <FiTag size={18} color="#fff" />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                >
                  {editTarget ? "Update" : "New Category"}
                </p>
                <h3
                  className="text-base font-bold text-white leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {editTarget ? "Edit Category" : "Add Category"}
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
              if (editTarget) {
                saveMutation.mutate(values);
              } else {
                const fd = new FormData();
                fd.append("name", values.name ?? "");
                if (values.description) fd.append("description", values.description);
                const imageFile = values.image?.[0]?.originFileObj;
                if (imageFile) fd.append("image", imageFile);
                fd.append("is_active", values.is_active ?? true);
                const iconFile = values.icon?.[0]?.originFileObj;
                if (iconFile) fd.append("icon", iconFile);
                saveMutation.mutate(fd);
              }
            }}
          >
            <CategoryFormFields isEdit={!!editTarget} />
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
                {editTarget ? "Save Changes" : "Create Category"}
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
