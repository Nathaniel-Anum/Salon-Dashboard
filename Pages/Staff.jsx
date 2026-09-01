import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Drawer, Form, Input, Select, Button, Switch, Checkbox, message, Tag, Tooltip } from "antd";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiGrid, FiList, FiScissors, FiChevronDown, FiChevronRight, FiMail } from "react-icons/fi";
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

const permLabel = (permission) =>
  typeof permission === "object" && permission !== null
    ? permission.label || permission.name || permission.description || permission.codename || permission.code || `#${permission.id}`
    : String(permission);

const INVITED_STAFF_STORAGE_KEY = "salon-dashboard.invited-staff-emails";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

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
  const [inviteForm] = Form.useForm();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitedEmails, setInvitedEmails] = useState(() => {
    try {
      const raw = globalThis.localStorage?.getItem(INVITED_STAFF_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeEmail).filter(Boolean) : [];
    } catch {
      return [];
    }
  });

  // Assign-services modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignStaff, setAssignStaff] = useState(null);
  const [assignServiceIds, setAssignServiceIds] = useState([]);
  const [collapsedCategoryKeys, setCollapsedCategoryKeys] = useState({});

  // --- FETCH STAFF ---
  const { data: staffRaw, isLoading: staffLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/staff/").then((r) => r.data),
  });

  // --- FETCH SERVICES (for assign-services modal) ---
  const { data: servicesRaw } = useQuery({
    queryKey: ["services"],
    queryFn: () => _axios.get("/api/portal/v1/booking/services/").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const servicesData = useMemo(
    () => (Array.isArray(servicesRaw) ? servicesRaw : servicesRaw?.results || []),
    [servicesRaw]
  );

  const getServiceAssignedStaffRefs = (svc) => {
    const fromIds = svc?.assigned_staff_ids ?? svc?.staff_ids ?? [];
    const fromAssignedStaffArray = Array.isArray(svc?.assigned_staff)
      ? svc.assigned_staff.map((x) => x?.id ?? x?.user_id ?? x?.account_id ?? x)
      : [];
    const fromAssignedStaffSingle =
      svc?.assigned_staff && !Array.isArray(svc.assigned_staff)
        ? [svc.assigned_staff?.id ?? svc.assigned_staff?.user_id ?? svc.assigned_staff?.account_id ?? svc.assigned_staff]
        : [];
    const fromStaffArray = Array.isArray(svc?.staff)
      ? svc.staff.map((x) => x?.id ?? x?.user_id ?? x?.account_id ?? x)
      : [];
    const fromStaffSingle =
      svc?.staff && !Array.isArray(svc.staff)
        ? [svc.staff?.id ?? svc.staff?.user_id ?? svc.staff?.account_id ?? svc.staff]
        : [];
    const scalarIds = [svc?.assigned_staff_id, svc?.staff_id];

    return [
      ...fromIds,
      ...fromAssignedStaffArray,
      ...fromAssignedStaffSingle,
      ...fromStaffArray,
      ...fromStaffSingle,
      ...scalarIds,
    ]
      .filter((x) => x !== null && x !== undefined && x !== "")
      .map(String);
  };

  const servicesByCategory = useMemo(() => {
    const grouped = new Map();
    servicesData.forEach((svc) => {
      const categoryId = svc.category ?? "__uncategorized__";
      const categoryName = svc.category_name || (svc.category != null ? `Category ${svc.category}` : "Uncategorised");
      const key = String(categoryId);
      if (!grouped.has(key)) {
        grouped.set(key, { key, id: categoryId, name: categoryName, services: [] });
      }
      grouped.get(key).services.push(svc);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.key === "__uncategorized__") return 1;
      if (b.key === "__uncategorized__") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [servicesData]);

  // --- FETCH ROLES — normalise to array regardless of API shape ---
  const { data: rolesRaw, isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/roles/").then((r) => r.data),
  });

  const staffData = useMemo(
    () => (Array.isArray(staffRaw) ? staffRaw : staffRaw?.results || []),
    [staffRaw]
  );
  const invitedEmailSet = useMemo(() => new Set(invitedEmails), [invitedEmails]);
  const rolesData = useMemo(
    () => (Array.isArray(rolesRaw) ? rolesRaw : rolesRaw?.results || []),
    [rolesRaw]
  );

  const roleOptions = useMemo(
    () => rolesData.map((r) => ({ label: r.name, value: r.id })),
    [rolesData]
  );

  const { data: permissionsRaw, isLoading: permissionsLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/permissions/").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const permissionsData = useMemo(
    () => (Array.isArray(permissionsRaw) ? permissionsRaw : permissionsRaw?.results || []),
    [permissionsRaw]
  );

  const portalAccessPermission = useMemo(
    () =>
      permissionsData.find(
        (permission) =>
          permission?.codename === "portal_access.view" ||
          permission?.code === "portal_access.view"
      ) || null,
    [permissionsData]
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

  // --- ASSIGN SERVICES TO STAFF ---
  const assignServices = useMutation({
    mutationFn: ({ staff, service_ids }) =>
      _axios.patch("/api/portal/v1/booking/services/assign-staff/", {
        staff_id: staff.id,
        service_ids,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries(["services"]);
      closeAssignDrawer();
      message.success("Services assignment updated successfully");
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to update services assignment");
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

  const inviteStaff = useMutation({
    mutationFn: (values) => {
      if (!portalAccessPermission?.id) {
        throw new Error("Portal access permission is missing. Please reload permissions and try again.");
      }

      const permissionIds = Array.from(
        new Set([portalAccessPermission.id, ...(values.extra_permission_ids || [])])
      )
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));

      return _axios.post("/api/portal/v1/accounts/staff/invite/", {
        email: values.email,
        full_name: values.full_name,
        phone: values.phone || "",
        account_type: "staff",
        permission_ids: permissionIds,
      });
    },
    onSuccess: (_, values) => {
      const nextEmail = normalizeEmail(values?.email);
      if (nextEmail) {
        setInvitedEmails((prev) => {
          const next = prev.includes(nextEmail) ? prev : [...prev, nextEmail];
          try {
            globalThis.localStorage?.setItem(INVITED_STAFF_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Ignore local storage failures; UI can still rely on backend fields when present.
          }
          return next;
        });
      }
      message.success("Staff invitation sent successfully");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setInviteOpen(false);
      inviteForm.resetFields();
    },
    onError: (err) => {
      const msg =
        err?.message ||
        err?.response?.data?.detail ||
        err?.response?.data?.email?.[0] ||
        Object.values(err?.response?.data ?? {})?.[0]?.[0] ||
        "Failed to send invitation";
      message.error(msg);
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

  // --- HANDLE ASSIGN SERVICES ---
  const handleAssignServices = (staff) => {
    setAssignStaff(staff);
    // Pre-populate with services already assigned to this staff member
    const currentIds = servicesData
      .filter((svc) => {
        const ids = getServiceAssignedStaffRefs(svc);
        return ids.some(
          (id) =>
            String(id) === String(staff.id) ||
            String(id) === String(staff.user) ||
            String(id) === String(staff.user_id) ||
            String(id) === String(staff.account_id)
        );
      })
      .map((svc) => String(svc.id));
    setAssignServiceIds(currentIds);
    setAssignOpen(true);
  };

  const toggleServiceSelection = (serviceId, checked) => {
    const serviceIdStr = String(serviceId);
    setAssignServiceIds((prev) => {
      if (checked) return prev.some((id) => String(id) === serviceIdStr) ? prev : [...prev, serviceIdStr];
      return prev.filter((id) => String(id) !== serviceIdStr);
    });
  };

  const toggleCategorySelection = (category, checked) => {
    const ids = category.services.map((svc) => svc.id);
    setAssignServiceIds((prev) => {
      const prevSet = new Set(prev.map((x) => String(x)));
      if (checked) {
        ids.forEach((id) => prevSet.add(String(id)));
      } else {
        ids.forEach((id) => prevSet.delete(String(id)));
      }
      return Array.from(prevSet);
    });
  };

  const handleSaveAssignedServices = () => {
    if (!assignStaff?.id) return;
    const normalizedServiceIds = assignServiceIds.map((id) => {
      const raw = String(id);
      const n = Number(raw);
      return Number.isFinite(n) && String(n) === raw ? n : raw;
    });
    assignServices.mutate({
      staff: assignStaff,
      service_ids: normalizedServiceIds,
    });
  };

  const toggleCategoryCollapsed = (categoryKey) => {
    setCollapsedCategoryKeys((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
  };

  // --- HANDLE EDIT ---
  const handleEdit = (staff) => {
    setEditStaff(staff);
    editForm.setFieldsValue({
      full_name: staff.full_name,
      email: staff.email,
      phone: staff.phone,
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

  // Checks multiple API field patterns to identify staff who joined via invitation
  const isInvitedStaff = (staff) => {
    const invitationStatus = String(
      staff?.invitation_status ||
      staff?.invite_status ||
      staff?.status ||
      ""
    ).toLowerCase();
    const emailMarkedInvited = invitedEmailSet.has(normalizeEmail(staff?.email));

    return !!(
      emailMarkedInvited ||
      staff?.is_invited ||
      staff?.via_invite ||
      staff?.invited ||
      staff?.invited_at ||
      staff?.invitation_sent_at ||
      staff?.invite_sent_at ||
      staff?.pending_invite ||
      staff?.invitation?.id ||
      staff?.invitation_accepted === false ||
      invitationStatus.includes("invite") ||
      invitationStatus.includes("pending")
    );
  };

  const closeAssignDrawer = () => {
    setAssignOpen(false);
    setAssignStaff(null);
    setAssignServiceIds([]);
  };

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

          {/* invite button */}
          <button
            onClick={() => setInviteOpen(true)}
            className="flex cursor-pointer items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #5a3a20, #3d2510)",
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 4px 14px rgba(90,58,32,0.3)",
            }}
          >
            <FiMail size={14} />
            Invite
          </button>

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
              style={isInvitedStaff(staff) ? {
                background: "linear-gradient(145deg, #ead1ac, #d9b27e)",
                border: "1px solid rgba(122,78,32,0.45)",
                boxShadow: "0 8px 24px rgba(90,55,15,0.18)",
              } : {
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
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 14,
                      color: isInvitedStaff(staff) ? "#4a2d14" : "#272727",
                    }}
                  >
                    {staff.full_name}
                  </h3>
                  <p
                    className="text-xs text-[#987554] truncate"
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      color: isInvitedStaff(staff) ? "#6f4821" : "#987554",
                    }}
                  >
                    {staff.email}
                  </p>
                </div>

                {/* status badges */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: staff.is_active ? "rgba(34,160,80,0.12)" : "rgba(200,50,50,0.1)",
                      color: staff.is_active ? "#1a8a40" : "#c43232",
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {staff.is_active ? "Active" : "Inactive"}
                  </span>
                  {isInvitedStaff(staff) && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: "rgba(140,90,40,0.2)",
                        color: "#7a4e20",
                        border: "1px solid rgba(140,90,40,0.3)",
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      Invited
                    </span>
                  )}
                </div>
              </div>

              {/* phone */}
              {staff.phone && (
                <p
                  className="text-xs text-[#987554] mb-3"
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    color: isInvitedStaff(staff) ? "#6f4821" : "#987554",
                  }}
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
                      style={isInvitedStaff(staff) ? {
                        background: "rgba(122,78,32,0.14)",
                        color: "#6f4821",
                        border: "1px solid rgba(122,78,32,0.18)",
                        fontFamily: "'Poppins', sans-serif",
                      } : {
                        background: "rgba(187,161,79,0.12)",
                        color: "#8a6f2e",
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {r.name}
                    </Tag>
                  ))
                ) : (
                  <span
                    className="text-[10px] text-[#c8b890]"
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      color: isInvitedStaff(staff) ? "#8b673f" : "#c8b890",
                    }}
                  >
                    No roles assigned
                  </span>
                )}
              </div>

              {/* divider */}
              <div
                className="h-px mb-3"
                style={{ background: isInvitedStaff(staff) ? "rgba(122,78,32,0.18)" : "rgba(187,161,79,0.15)" }}
              />

              {/* actions */}
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <button
                  onClick={() => handleAssignServices(staff)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80 cursor-pointer"
                  style={isInvitedStaff(staff) ? {
                    color: "#6f4821",
                    background: "rgba(122,78,32,0.12)",
                    border: "1px solid rgba(122,78,32,0.18)",
                    fontFamily: "'Poppins', sans-serif",
                  } : {
                    color: "#BBA14F",
                    background: "rgba(187,161,79,0.1)",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  <FiScissors size={12} />
                  Services
                </button>
                <button
                  onClick={() => handleEdit(staff)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80 cursor-pointer"
                  style={isInvitedStaff(staff) ? {
                    color: "#5f3915",
                    background: "rgba(95,57,21,0.1)",
                    border: "1px solid rgba(95,57,21,0.14)",
                    fontFamily: "'Poppins', sans-serif",
                  } : {
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
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80 cursor-pointer"
                  style={isInvitedStaff(staff) ? {
                    color: "#8a2f2f",
                    background: "rgba(170,70,55,0.1)",
                    border: "1px solid rgba(170,70,55,0.12)",
                    fontFamily: "'Poppins', sans-serif",
                  } : {
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
                      background: isInvitedStaff(staff)
                        ? "rgba(184,136,72,0.12)"
                        : idx % 2 === 0 ? "#FDFAF5" : "rgba(187,161,79,0.03)",
                      boxShadow: isInvitedStaff(staff) ? "inset 4px 0 0 #8a5a2b" : "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isInvitedStaff(staff) ? "rgba(184,136,72,0.2)" : "rgba(187,161,79,0.07)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isInvitedStaff(staff) ? "rgba(184,136,72,0.12)" : idx % 2 === 0 ? "#FDFAF5" : "rgba(187,161,79,0.03)")}
                  >
                    {/* # */}
                    <td className="px-4 py-3 text-xs text-[#c8b890]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {idx + 1}
                    </td>

                    {/* Staff member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StaffAvatar name={staff.full_name} size={34} />
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="text-sm font-semibold text-[#272727] whitespace-nowrap"
                            style={{ fontFamily: "'Poppins', sans-serif" }}
                          >
                            {staff.full_name}
                          </span>
                          {isInvitedStaff(staff) && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                              style={{
                                background: "rgba(140,90,40,0.2)",
                                color: "#7a4e20",
                                border: "1px solid rgba(140,90,40,0.3)",
                                fontFamily: "'Poppins', sans-serif",
                              }}
                            >
                              Invited
                            </span>
                          )}
                        </div>
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
                      <div className="flex flex-col gap-1 items-start">
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
                        {isInvitedStaff(staff) && (
                          <span
                            className="text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
                            style={{
                              background: "rgba(140,90,40,0.2)",
                              color: "#7a4e20",
                              border: "1px solid rgba(140,90,40,0.3)",
                              fontFamily: "'Poppins', sans-serif",
                            }}
                          >
                            Invited
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleAssignServices(staff)}
                          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-200 hover:opacity-80 whitespace-nowrap"
                          style={{
                            color: "#BBA14F",
                            background: "rgba(187,161,79,0.1)",
                            fontFamily: "'Poppins', sans-serif",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          <FiScissors size={11} />
                          Services
                        </button>
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

      {/* ── Assign Services Drawer ── */}
      <Drawer
        title={null}
        placement="right"
        width={560}
        open={assignOpen}
        onClose={closeAssignDrawer}
        closable={false}
        styles={{
          body: { padding: 0, background: "#FDFAF5" },
          mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.45)" },
        }}
      >
        <div
          className="relative overflow-hidden px-6 pt-6 pb-5"
          style={{ background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}>
                Assign Services
              </p>
              <h3 className="text-base font-bold text-white leading-none" style={{ fontFamily: "'Playfair Display', serif" }}>
                {assignStaff?.full_name || "Staff"}
              </h3>
            </div>
            <button
              onClick={closeAssignDrawer}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-70"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
            Choose services by category. Tick a category checkbox to select all services under that category.
          </p>

          <div className="flex flex-col gap-3" style={{ maxHeight: "calc(100vh - 250px)", overflowY: "auto", paddingRight: 2 }}>
            {servicesByCategory.map((category) => {
              const categoryIds = category.services.map((svc) => String(svc.id));
              const selectedCount = categoryIds.filter((id) => assignServiceIds.map(String).includes(id)).length;
              const allSelected = categoryIds.length > 0 && selectedCount === categoryIds.length;
              const partiallySelected = selectedCount > 0 && selectedCount < categoryIds.length;
              const isCollapsed = !!collapsedCategoryKeys[category.key];

              return (
                <div
                  key={category.key}
                  className="rounded-2xl p-4"
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(187,161,79,0.2)",
                    boxShadow: "0 2px 8px rgba(39,39,39,0.04)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleCategoryCollapsed(category.key)}
                        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md"
                        style={{
                          border: "1px solid rgba(187,161,79,0.3)",
                          background: "rgba(187,161,79,0.07)",
                          color: "#8a6f2e",
                          fontFamily: "'Poppins', sans-serif",
                          cursor: "pointer",
                        }}
                      >
                        {isCollapsed ? <FiChevronRight size={12} /> : <FiChevronDown size={12} />}
                        {isCollapsed ? "Expand" : "Collapse"}
                      </button>

                      <div className="flex items-center gap-2 ml-1">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={partiallySelected}
                          onChange={(e) => toggleCategorySelection(category, e.target.checked)}
                        />
                        <p className="text-sm font-semibold m-0" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}>
                          {category.name}
                        </p>
                      </div>
                    </div>

                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(187,161,79,0.12)",
                        color: "#8a6f2e",
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {selectedCount}/{category.services.length} selected
                    </span>
                  </div>

                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {category.services.map((svc) => {
                      const checked = assignServiceIds.some((id) => String(id) === String(svc.id));
                      return (
                        <label
                          key={svc.id}
                          className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                          style={{
                            background: checked ? "rgba(187,161,79,0.12)" : "rgba(187,161,79,0.04)",
                            border: checked ? "1px solid rgba(187,161,79,0.35)" : "1px solid rgba(187,161,79,0.15)",
                            cursor: "pointer",
                          }}
                        >
                          <Checkbox
                            checked={checked}
                            onChange={(e) => toggleServiceSelection(svc.id, e.target.checked)}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold m-0 truncate" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}>
                              {svc.name}
                            </p>
                            <p className="text-[11px] m-0" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                              {svc.duration ? `${svc.duration} mins` : "Duration —"}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 mt-5 pt-4" style={{ borderTop: "1px solid rgba(187,161,79,0.16)" }}>
            <Button onClick={closeAssignDrawer}>Cancel</Button>
            <Button
              type="primary"
              loading={assignServices.isPending}
              className={goldBtn}
              onClick={handleSaveAssignedServices}
            >
              Save Services
            </Button>
          </div>
        </div>
      </Drawer>

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

      {/* ── Invite Staff Modal ── */}
      <Modal
        open={inviteOpen}
        onCancel={() => { setInviteOpen(false); inviteForm.resetFields(); }}
        footer={null}
        centered
        width={500}
        closable={false}
        styles={{
          content: { padding: 0, borderRadius: 20, overflow: "hidden" },
          mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.45)" },
        }}
      >
        <div
          className="relative overflow-hidden px-6 pt-6 pb-5"
          style={{ background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)" }}
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
                style={{ background: "linear-gradient(135deg, #BBA14F, #987554)", boxShadow: "0 4px 14px rgba(187,161,79,0.4)" }}
              >
                <FiMail size={18} color="#fff" />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                >
                  Staff Invitation
                </p>
                <h3
                  className="text-base font-bold text-white leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Invite Staff Member
                </h3>
              </div>
            </div>
            <button
              onClick={() => { setInviteOpen(false); inviteForm.resetFields(); }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-70"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5" style={{ background: "#FDFAF5" }}>
          <Form
            form={inviteForm}
            layout="vertical"
            onFinish={(values) => inviteStaff.mutate(values)}
          >
            <Form.Item name="full_name" label="Full Name" rules={[{ required: true, message: "Required" }]}>
              <Input placeholder="e.g. Amara Johnson" className="rounded-xl!" />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, type: "email", message: "Valid email required" }]}
            >
              <Input placeholder="name@example.com" className="rounded-xl!" />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input placeholder="+234 000 000 0000" className="rounded-xl!" />
            </Form.Item>

            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: "rgba(187,161,79,0.06)", border: "1px solid rgba(187,161,79,0.2)" }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: "#7D5D37", fontFamily: "'Poppins', sans-serif" }}>
                Permissions
              </p>
              <div
                className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
                style={{ background: "rgba(187,161,79,0.15)", border: "1px solid rgba(187,161,79,0.35)" }}
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center text-white shrink-0 text-[10px] font-bold"
                  style={{ background: "#BBA14F" }}
                >
                  ✓
                </span>
                <span className="text-xs font-semibold flex-1" style={{ color: "#7D5D37", fontFamily: "'Poppins', sans-serif" }}>
                  {portalAccessPermission ? permLabel(portalAccessPermission) : "View Portal Access"}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(187,161,79,0.25)", color: "#8a6f2e", fontFamily: "'Poppins', sans-serif" }}
                >
                  Always on
                </span>
              </div>
              <Form.Item name="extra_permission_ids" label="Additional Permissions" className="mb-0">
                <Select
                  mode="multiple"
                  placeholder="Select additional permissions…"
                  allowClear
                  loading={permissionsLoading}
                  options={permissionsData
                    .filter((p) => p.id !== portalAccessPermission?.id)
                    .map((p) => ({
                      label: permLabel(p),
                      value: p.id,
                    }))}
                  className="w-full"
                />
              </Form.Item>
            </div>

            <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid rgba(187,161,79,0.15)" }}>
              <Button
                onClick={() => { setInviteOpen(false); inviteForm.resetFields(); }}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={inviteStaff.isPending}
                className={goldBtn}
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Send Invitation
              </Button>
            </div>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
