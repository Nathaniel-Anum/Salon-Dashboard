import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { message, Modal } from "antd";
import { FiTag, FiUsers, FiGift, FiRefreshCw, FiPauseCircle, FiPlayCircle, FiPlus } from "react-icons/fi";
import _axios from "../src/api/_axios";

const normalizeList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const getCollectionCount = (raw) => {
  if (typeof raw?.count === "number") return raw.count;
  return normalizeList(raw).length;
};

const makeIdempotencyKey = () => {
  const rand = Math.random().toString(36).slice(2, 10);
  return `campaign-${Date.now()}-${rand}`;
};

const TRIGGER_TYPE_OPTIONS = [
  "account_registered",
  "account_verified",
  "booking_completed",
  "order_completed",
  "code_claimed",
  "referral_qualified",
  "scheduled",
  "manual",
];

const slugifyCode = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const toIsoDateTime = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export default function CampaignsPage() {
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [actionReason, setActionReason] = useState("");
  const [publishVersion, setPublishVersion] = useState(1);
  const [optimisticPublishedIds, setOptimisticPublishedIds] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    description: "",
    enrollment_enabled: true,
    issuance_enabled: true,
    effective_at: "",
    ends_at: "",
    trigger_type: "account_registered",
    booking_percentage: "15.00",
    commerce_percentage: "15.00",
  });

  const {
    data: campaignsRaw,
    isLoading: campaignsLoading,
    refetch: refetchCampaigns,
  } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => _axios.get("/api/portal/v1/campaigns/").then((r) => r.data),
  });

  const campaigns = useMemo(() => normalizeList(campaignsRaw), [campaignsRaw]);

  const fallbackCampaignId = campaigns[0]?.public_id || campaigns[0]?.id || null;
  const effectiveCampaignId = selectedCampaignId || fallbackCampaignId;

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => String(c.public_id || c.id) === String(effectiveCampaignId)),
    [campaigns, effectiveCampaignId]
  );

  const campaignPublicId = selectedCampaign?.public_id || effectiveCampaignId;

  const { data: campaignDetailRaw, isLoading: detailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ["campaign-detail", campaignPublicId],
    queryFn: () => _axios.get(`/api/portal/v1/campaigns/${campaignPublicId}/`).then((r) => r.data),
    enabled: !!campaignPublicId,
  });

  const { data: enrollmentsRaw, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["campaign-enrollments", campaignPublicId],
    queryFn: () => _axios.get(`/api/portal/v1/campaigns/${campaignPublicId}/enrollments/`).then((r) => r.data),
    enabled: !!campaignPublicId,
  });

  const { data: grantsRaw, isLoading: grantsLoading } = useQuery({
    queryKey: ["campaign-grants", campaignPublicId],
    queryFn: () => _axios.get(`/api/portal/v1/campaigns/${campaignPublicId}/grants/`).then((r) => r.data),
    enabled: !!campaignPublicId,
  });

  const campaignDetail = campaignDetailRaw || selectedCampaign || null;
  const enrollments = normalizeList(enrollmentsRaw);
  const grants = normalizeList(grantsRaw);

  const statusText = String(campaignDetail?.status || "").toLowerCase();
  const publicationStatusText = String(campaignDetail?.publication_status || "").toLowerCase();
  const selectedIsOptimisticallyPublished = optimisticPublishedIds.some((id) => String(id) === String(campaignPublicId));
  const isPublished =
    selectedIsOptimisticallyPublished ||
    statusText.includes("published") ||
    statusText.includes("active") ||
    publicationStatusText.includes("published") ||
    campaignDetail?.is_published === true ||
    campaignDetail?.published === true ||
    campaignDetail?.is_active === true ||
    Boolean(campaignDetail?.published_at) ||
    Number.isFinite(Number(campaignDetail?.published_version)) ||
    Number.isFinite(Number(campaignDetail?.active_version));

  const isPaused =
    statusText.includes("paused") ||
    campaignDetail?.is_paused === true ||
    campaignDetail?.active === false;

  const publishCampaign = useMutation({
    mutationFn: (publicId) =>
      _axios.post(`/api/portal/v1/campaigns/${publicId}/publish/`, {
        reason: actionReason.trim() || "Campaign published from settings",
        idempotency_key: makeIdempotencyKey(),
        version: Number(publishVersion || 1),
      }),
    onSuccess: () => {
      message.success("Campaign published");
      setActionReason("");
      setOptimisticPublishedIds((prev) => {
        if (!campaignPublicId) return prev;
        return prev.some((id) => String(id) === String(campaignPublicId))
          ? prev
          : [...prev, campaignPublicId];
      });
      refetchCampaigns();
      refetchDetail();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to publish campaign");
    },
  });

  const pauseCampaign = useMutation({
    mutationFn: (publicId) =>
      _axios.post(`/api/portal/v1/campaigns/${publicId}/pause/`, {
        reason: actionReason.trim() || "Campaign paused from settings",
        idempotency_key: makeIdempotencyKey(),
      }),
    onSuccess: () => {
      message.success("Campaign paused");
      setActionReason("");
      refetchCampaigns();
      refetchDetail();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to pause campaign");
    },
  });

  const resumeCampaign = useMutation({
    mutationFn: (publicId) =>
      _axios.post(`/api/portal/v1/campaigns/${publicId}/resume/`, {
        reason: actionReason.trim() || "Campaign resumed from settings",
        idempotency_key: makeIdempotencyKey(),
      }),
    onSuccess: () => {
      message.success("Campaign resumed");
      setActionReason("");
      refetchCampaigns();
      refetchDetail();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to resume campaign");
    },
  });

  const createCampaign = useMutation({
    mutationFn: (payload) => _axios.post("/api/portal/v1/campaigns/", payload),
    onSuccess: (res) => {
      message.success("Campaign created");
      const created = res?.data || {};
      const nextId = created.public_id || created.id || null;
      refetchCampaigns();
      if (nextId) setSelectedCampaignId(nextId);
      setCreateOpen(false);
      setCreateForm({
        code: "",
        name: "",
        description: "",
        enrollment_enabled: true,
        issuance_enabled: true,
        effective_at: "",
        ends_at: "",
        trigger_type: "account_registered",
        booking_percentage: "15.00",
        commerce_percentage: "15.00",
      });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to create campaign");
    },
  });

  const actionBusy = publishCampaign.isPending || pauseCampaign.isPending || resumeCampaign.isPending;

  const handleCreateCampaign = () => {
    const trimmedName = createForm.name.trim();
    if (!trimmedName) {
      message.error("Campaign name is required");
      return;
    }

    const effectiveAt = toIsoDateTime(createForm.effective_at);
    const endsAt = toIsoDateTime(createForm.ends_at);
    if (!effectiveAt || !endsAt) {
      message.error("Please provide valid effective and end date/time");
      return;
    }

    const generatedCode = slugifyCode(createForm.code || trimmedName);
    if (!generatedCode) {
      message.error("Please provide a valid campaign code or name");
      return;
    }

    const bookingPct = Number(createForm.booking_percentage || 0);
    const commercePct = Number(createForm.commerce_percentage || 0);
    if (!Number.isFinite(bookingPct) || !Number.isFinite(commercePct)) {
      message.error("Offer percentages must be valid numbers");
      return;
    }

    const payload = {
      code: generatedCode,
      name: trimmedName,
      description: createForm.description?.trim() || "",
      enrollment_enabled: !!createForm.enrollment_enabled,
      issuance_enabled: !!createForm.issuance_enabled,
      version: {
        effective_at: effectiveAt,
        ends_at: endsAt,
        triggers: [
          {
            trigger_type: createForm.trigger_type,
          },
        ],
        offers: [
          {
            code: `${generatedCode}-booking-${String(bookingPct).replace(/[^0-9]/g, "") || "0"}`,
            name: `${bookingPct}% off bookings`,
            offer_type: "percentage",
            scope: "booking",
            percentage: bookingPct.toFixed(2),
          },
          {
            code: `${generatedCode}-commerce-${String(commercePct).replace(/[^0-9]/g, "") || "0"}`,
            name: `${commercePct}% off shopping`,
            offer_type: "percentage",
            scope: "commerce",
            percentage: commercePct.toFixed(2),
          },
        ],
      },
    };

    createCampaign.mutate(payload);
  };

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7" style={{ background: "#FDFAF5", minHeight: "100vh" }}>
      <div
        className="relative overflow-hidden rounded-3xl p-5 sm:p-6 mb-5"
        style={{
          background: "linear-gradient(120deg, #272727 0%, #3a2e1e 62%, #5a4728 100%)",
          boxShadow: "0 12px 34px rgba(39,39,39,0.18)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative z-10 flex items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}>
              Settings
            </p>
            <h1 className="text-xl sm:text-2xl leading-none" style={{ color: "#fff", fontFamily: "'Playfair Display', serif", margin: 0 }}>
              Campaigns
            </h1>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "rgba(255,255,255,0.82)", fontFamily: "'Poppins', sans-serif", margin: 0 }}>
              Manage campaign details, enrollments, grants, and lifecycle.
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetchCampaigns()}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs sm:text-sm"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#fff",
              fontFamily: "'Poppins', sans-serif",
              cursor: "pointer",
            }}
          >
            <FiRefreshCw size={13} /> Refresh
          </button>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs sm:text-sm"
            style={{
              background: "linear-gradient(135deg, #BBA14F, #987554)",
              border: "none",
              color: "#fff",
              fontFamily: "'Poppins', sans-serif",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(187,161,79,0.35)",
            }}
          >
            <FiPlus size={13} /> Create Campaign
          </button>
        </div>
      </div>

      <Modal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        centered
        title="Create Campaign"
      >
        <div className="pt-2" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#987554", fontWeight: 700, marginBottom: 4 }}>Campaign Name</label>
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="New Customer Welcome Discount"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(187,161,79,0.3)" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, color: "#987554", fontWeight: 700, marginBottom: 4 }}>Campaign Code</label>
            <input
              value={createForm.code}
              onChange={(e) => setCreateForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="new-customer-welcome"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(187,161,79,0.3)" }}
            />
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#987554" }}>
              Code is generated from name if left empty. No ID is appended.
            </p>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, color: "#987554", fontWeight: 700, marginBottom: 4 }}>Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Optional campaign description"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(187,161,79,0.3)", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#987554", fontWeight: 700, marginBottom: 4 }}>Effective At</label>
              <input
                type="datetime-local"
                value={createForm.effective_at}
                onChange={(e) => setCreateForm((p) => ({ ...p, effective_at: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid rgba(187,161,79,0.3)" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#987554", fontWeight: 700, marginBottom: 4 }}>Ends At</label>
              <input
                type="datetime-local"
                value={createForm.ends_at}
                onChange={(e) => setCreateForm((p) => ({ ...p, ends_at: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid rgba(187,161,79,0.3)" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, color: "#987554", fontWeight: 700, marginBottom: 4 }}>Trigger Type</label>
            <select
              value={createForm.trigger_type}
              onChange={(e) => setCreateForm((p) => ({ ...p, trigger_type: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(187,161,79,0.3)" }}
            >
              {TRIGGER_TYPE_OPTIONS.map((trigger) => (
                <option key={trigger} value={trigger}>{trigger}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#987554", fontWeight: 700, marginBottom: 4 }}>Booking %</label>
              <input
                value={createForm.booking_percentage}
                onChange={(e) => setCreateForm((p) => ({ ...p, booking_percentage: e.target.value }))}
                placeholder="15.00"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid rgba(187,161,79,0.3)" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#987554", fontWeight: 700, marginBottom: 4 }}>Commerce %</label>
              <input
                value={createForm.commerce_percentage}
                onChange={(e) => setCreateForm((p) => ({ ...p, commerce_percentage: e.target.value }))}
                placeholder="15.00"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ border: "1px solid rgba(187,161,79,0.3)" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#272727" }}>
              <input
                type="checkbox"
                checked={createForm.enrollment_enabled}
                onChange={(e) => setCreateForm((p) => ({ ...p, enrollment_enabled: e.target.checked }))}
              />
              Enrollment Enabled
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#272727" }}>
              <input
                type="checkbox"
                checked={createForm.issuance_enabled}
                onChange={(e) => setCreateForm((p) => ({ ...p, issuance_enabled: e.target.checked }))}
              />
              Issuance Enabled
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ border: "1px solid rgba(187,161,79,0.3)", background: "#fff", color: "#987554", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={createCampaign.isPending}
              onClick={handleCreateCampaign}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ border: "none", background: "linear-gradient(135deg, #BBA14F, #987554)", color: "#fff", cursor: "pointer", opacity: createCampaign.isPending ? 0.7 : 1 }}
            >
              {createCampaign.isPending ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 sm:gap-5">
        <aside className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid rgba(187,161,79,0.18)", boxShadow: "0 4px 14px rgba(39,39,39,0.05)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest" style={{ margin: 0, color: "#987554", fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>
              All Campaigns
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(187,161,79,0.12)", color: "#7a6030", fontFamily: "'Poppins', sans-serif" }}>
              {campaigns.length}
            </span>
          </div>

          {campaignsLoading ? (
            <p style={{ margin: 0, color: "#987554", fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <p style={{ margin: 0, color: "#987554", fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>No campaigns found.</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[56vh] overflow-y-auto pr-1">
              {campaigns.map((campaign) => {
                const id = campaign.public_id || campaign.id;
                const isActive = String(id) === String(campaignPublicId);
                return (
                  <button
                    key={String(id)}
                    type="button"
                    onClick={() => setSelectedCampaignId(id)}
                    className="w-full text-left px-3 py-2.5 rounded-xl"
                    style={{
                      background: isActive ? "linear-gradient(135deg, rgba(187,161,79,0.2), rgba(152,117,84,0.14))" : "#fff",
                      border: isActive ? "1px solid rgba(187,161,79,0.5)" : "1px solid rgba(187,161,79,0.16)",
                      cursor: "pointer",
                    }}
                  >
                    <p className="text-sm font-semibold mb-0.5 truncate" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}>
                      {campaign.name || campaign.title || "Untitled Campaign"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="rounded-2xl p-4 sm:p-5" style={{ background: "#fff", border: "1px solid rgba(187,161,79,0.18)", boxShadow: "0 4px 14px rgba(39,39,39,0.05)" }}>
          {!campaignPublicId ? (
            <p style={{ margin: 0, color: "#987554", fontFamily: "'Poppins', sans-serif" }}>Select a campaign to view details.</p>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif", fontWeight: 700 }}>
                  Campaign Detail
                </p>
                <h2 className="text-lg sm:text-xl mb-1" style={{ color: "#272727", fontFamily: "'Playfair Display', serif" }}>
                  {campaignDetail?.name || campaignDetail?.title || "Campaign"}
                </h2>
                <p className="text-xs sm:text-sm" style={{ margin: 0, color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                  {campaignDetail?.description || "No description provided."}
                </p>
                {detailLoading && (
                  <p className="text-[11px] mt-1" style={{ marginBottom: 0, color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                    Refreshing campaign details...
                  </p>
                )}
              </div>

              <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(187,161,79,0.08)", border: "1px solid rgba(187,161,79,0.2)" }}>
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ margin: 0, color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                  Campaign Lifecycle
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_130px_auto] gap-2">
                  <input
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={isPublished ? "Reason for pause/resume" : "Reason for publish"}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{
                      border: "1px solid rgba(187,161,79,0.35)",
                      fontFamily: "'Poppins', sans-serif",
                      color: "#272727",
                    }}
                  />

                  <input
                    type="number"
                    min={1}
                    value={publishVersion}
                    onChange={(e) => setPublishVersion(Number(e.target.value || 1))}
                    placeholder="Version"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{
                      border: "1px solid rgba(187,161,79,0.35)",
                      fontFamily: "'Poppins', sans-serif",
                      color: "#272727",
                    }}
                  />

                  {!isPublished ? (
                    <button
                      type="button"
                      onClick={() => publishCampaign.mutate(campaignPublicId)}
                      disabled={actionBusy || Number(publishVersion || 0) < 1}
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg,#4f7aa8,#2d5a84)",
                        color: "#fff",
                        border: "none",
                        fontFamily: "'Poppins', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">Publish Campaign</span>
                    </button>
                  ) : isPaused ? (
                    <button
                      type="button"
                      onClick={() => resumeCampaign.mutate(campaignPublicId)}
                      disabled={actionBusy}
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg,#4fa87a,#2d845a)",
                        color: "#fff",
                        border: "none",
                        fontFamily: "'Poppins', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5"><FiPlayCircle size={14} /> Resume Campaign</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pauseCampaign.mutate(campaignPublicId)}
                      disabled={actionBusy}
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg,#a84f4f,#842d2d)",
                        color: "#fff",
                        border: "none",
                        fontFamily: "'Poppins', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5"><FiPauseCircle size={14} /> Pause Campaign</span>
                    </button>
                  )}
                </div>
                {!isPublished && (
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                    Publish this campaign first. Pause/Resume becomes available after publishing.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl p-3" style={{ background: "rgba(187,161,79,0.08)", border: "1px solid rgba(187,161,79,0.2)" }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ margin: 0, color: "#987554" }}>Campaigns</p>
                  <div className="flex items-center gap-2"><FiTag size={14} style={{ color: "#7a6030" }} /><p className="text-lg font-semibold" style={{ margin: 0, color: "#272727", fontFamily: "'Poppins', sans-serif" }}>{campaigns.length}</p></div>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(79,122,168,0.08)", border: "1px solid rgba(79,122,168,0.2)" }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ margin: 0, color: "#4f7aa8" }}>Enrollments</p>
                  <div className="flex items-center gap-2"><FiUsers size={14} style={{ color: "#2d5a84" }} /><p className="text-lg font-semibold" style={{ margin: 0, color: "#272727", fontFamily: "'Poppins', sans-serif" }}>{enrollmentsLoading ? "..." : getCollectionCount(enrollmentsRaw)}</p></div>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(79,168,122,0.08)", border: "1px solid rgba(79,168,122,0.2)" }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ margin: 0, color: "#2d845a" }}>Grants</p>
                  <div className="flex items-center gap-2"><FiGift size={14} style={{ color: "#2d845a" }} /><p className="text-lg font-semibold" style={{ margin: 0, color: "#272727", fontFamily: "'Poppins', sans-serif" }}>{grantsLoading ? "..." : getCollectionCount(grantsRaw)}</p></div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ border: "1px solid rgba(79,122,168,0.2)", background: "#fff" }}>
                  <p className="text-xs font-semibold mb-2" style={{ marginTop: 0, color: "#2d5a84", fontFamily: "'Poppins', sans-serif" }}>Enrollments ({getCollectionCount(enrollmentsRaw)})</p>
                  {enrollmentsLoading ? <p style={{ margin: 0, color: "#987554", fontSize: 12 }}>Loading enrollments...</p> : enrollments.length === 0 ? <p style={{ margin: 0, color: "#987554", fontSize: 12 }}>No enrollments.</p> : (
                    <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                      {enrollments.map((row, idx) => (
                        <div key={String(row.id || row.public_id || idx)} className="rounded-lg px-2.5 py-2" style={{ background: "rgba(79,122,168,0.06)", border: "1px solid rgba(79,122,168,0.14)" }}>
                          <p className="text-xs font-medium mb-0.5" style={{ margin: 0, color: "#272727", fontFamily: "'Poppins', sans-serif" }}>{row.customer_name || row.name || row.user_name || row.email || "Enrollment"}</p>
                          <p className="text-[11px]" style={{ margin: 0, color: "#987554", fontFamily: "'Poppins', sans-serif" }}>{row.public_id || row.id || "-"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl p-3" style={{ border: "1px solid rgba(79,168,122,0.2)", background: "#fff" }}>
                  <p className="text-xs font-semibold mb-2" style={{ marginTop: 0, color: "#2d845a", fontFamily: "'Poppins', sans-serif" }}>Grants ({getCollectionCount(grantsRaw)})</p>
                  {grantsLoading ? <p style={{ margin: 0, color: "#987554", fontSize: 12 }}>Loading grants...</p> : grants.length === 0 ? <p style={{ margin: 0, color: "#987554", fontSize: 12 }}>No grants.</p> : (
                    <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                      {grants.map((row, idx) => (
                        <div key={String(row.id || row.public_id || idx)} className="rounded-lg px-2.5 py-2" style={{ background: "rgba(79,168,122,0.06)", border: "1px solid rgba(79,168,122,0.14)" }}>
                          <p className="text-xs font-medium mb-0.5" style={{ margin: 0, color: "#272727", fontFamily: "'Poppins', sans-serif" }}>{row.title || row.name || row.customer_name || "Grant"}</p>
                          <p className="text-[11px]" style={{ margin: 0, color: "#987554", fontFamily: "'Poppins', sans-serif" }}>{row.public_id || row.id || "-"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}