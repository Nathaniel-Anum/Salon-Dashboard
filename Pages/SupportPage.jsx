import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Empty, Input, Modal, Select, Tabs, Tag, message } from "antd";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLifeBuoy,
  FiMoreVertical,
  FiPaperclip,
  FiRefreshCw,
  FiSend,
  FiXCircle,
} from "react-icons/fi";
import {
  addSupportTicketNote,
  assignSupportTicket,
  closeSupportTicket,
  downloadSupportTicketAttachment,
  getSupportAssignees,
  getSupportTicket,
  getSupportTicketAttachments,
  getSupportTicketMessages,
  getSupportTicketNotes,
  getSupportTickets,
  reopenSupportTicket,
  replyToSupportTicket,
  resolveSupportTicket,
  updateSupportTicketPriority,
} from "../src/api/support";

const normalizeList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const makeIdempotencyKey = (prefix = "support") => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

const RESOLUTION_CODES = [
  "answered",
  "booking_resolved",
  "payment_resolved",
  "order_resolved",
  "account_resolved",
  "technical_resolved",
  "duplicate",
  "no_action_required",
  "other",
];

const PERMISSION_KEYS = {
  view: "support_tickets.view",
  reply: "support_replies.create",
  note: "support_internal_notes.create",
  assign: "support_assignments.edit",
  priority: "support_priorities.edit",
  resolve: "support_resolutions.edit",
  close: "support_closures.edit",
  reopen: "support_reopens.edit",
  attachments: "support_attachments.view",
};

const getTicketPublicId = (ticket) =>
  String(ticket?.public_id || ticket?.reference || ticket?.id || "");

const getTicketReference = (ticket) =>
  ticket?.reference || ticket?.public_id || ticket?.ticket_number || ticket?.id || "—";

const getTicketSubject = (ticket) => ticket?.subject || ticket?.title || "Untitled ticket";

const collectTicketPermissions = (ticket) => {
  const raw = ticket?.permissions || ticket?.available_permissions || ticket?.allowed_actions;
  if (!raw) return new Set();

  if (Array.isArray(raw)) {
    return new Set(
      raw
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object") return item.codename || item.code || item.name;
          return null;
        })
        .filter(Boolean),
    );
  }

  if (typeof raw === "object") {
    return new Set(Object.keys(raw).filter((key) => raw[key]));
  }

  return new Set();
};

const extractTicketFromMutation = (raw) => {
  const data = raw?.data ?? raw;
  if (!data || typeof data !== "object") return null;

  const isTicketLike = (obj) => obj && typeof obj === "object" && (obj.public_id || obj.status || obj.reference);
  if (isTicketLike(data)) return data;

  const candidates = [data.ticket, data.result, data.data];
  return candidates.find(isTicketLike) || null;
};

const getStatusColor = (status) => {
  const key = String(status || "").toLowerCase();
  if (key === "waiting_for_staff") return "gold";
  if (key === "waiting_for_customer") return "blue";
  if (key === "resolved") return "green";
  if (key === "closed") return "default";
  return "default";
};

const field = (obj, ...keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "—";
};

const BROWN_BTN_STYLE = {
  background: "linear-gradient(135deg,#BBA14F,#987554)",
  border: "none",
  color: "#fff",
  fontFamily: "'Poppins', sans-serif",
  boxShadow: "0 4px 14px rgba(187,161,79,0.25)",
};

const RESOLVE_BTN_STYLE = {
  background: "linear-gradient(135deg,#2f9e44,#1f7a33)",
  border: "none",
  color: "#fff",
  fontFamily: "'Poppins', sans-serif",
  boxShadow: "0 4px 14px rgba(47,158,68,0.28)",
};

const CLOSE_BTN_STYLE = {
  background: "linear-gradient(135deg,#cf3f3f,#a92a2a)",
  border: "none",
  color: "#fff",
  fontFamily: "'Poppins', sans-serif",
  boxShadow: "0 4px 14px rgba(207,63,63,0.28)",
};

const BROWN_BTN_CLASS = "rounded-xl!";

const getActionButtonStyle = (baseStyle, disabled) => {
  if (!disabled) return baseStyle;
  return {
    ...baseStyle,
    opacity: 0.45,
    boxShadow: "none",
    cursor: "not-allowed",
    pointerEvents: "none",
  };
};

const getDisabledControlStyle = (disabled) =>
  disabled
    ? { opacity: 0.45, pointerEvents: "none", filter: "grayscale(0.25)" }
    : undefined;

export default function SupportPage() {
  const qc = useQueryClient();

  const [queueSearch, setQueueSearch] = useState("");
  const [activeTicketId, setActiveTicketId] = useState("");
  const [activeTab, setActiveTab] = useState("messages");
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [reopenMessage, setReopenMessage] = useState("");

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveCode, setResolveCode] = useState("answered");
  const [resolvePublicMessage, setResolvePublicMessage] = useState("");
  const [resolveInternalReason, setResolveInternalReason] = useState("");
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const opKeyRef = useRef({});
  const getOpKey = (name) => {
    if (!opKeyRef.current[name]) {
      opKeyRef.current[name] = makeIdempotencyKey(name);
    }
    return opKeyRef.current[name];
  };
  const clearOpKey = (name) => {
    delete opKeyRef.current[name];
  };

  const ticketFilters = useMemo(() => {
    const base = {};
    if (queueSearch.trim()) base.search = queueSearch.trim();
    return base;
  }, [queueSearch]);

  const {
    data: ticketsRaw,
    isLoading: ticketsLoading,
    isFetching: ticketsFetching,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ["support-tickets", ticketFilters],
    queryFn: () => getSupportTickets(ticketFilters),
  });

  const tickets = useMemo(() => normalizeList(ticketsRaw), [ticketsRaw]);

  useEffect(() => {
    if (!activeTicketId && tickets.length > 0) {
      setActiveTicketId(getTicketPublicId(tickets[0]));
    }
  }, [tickets, activeTicketId]);

  const {
    data: ticket,
    isLoading: ticketLoading,
    refetch: refetchTicket,
  } = useQuery({
    queryKey: ["support-ticket", activeTicketId],
    queryFn: () => getSupportTicket(activeTicketId),
    enabled: !!activeTicketId,
  });

  const {
    data: messagesRaw,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["support-ticket-messages", activeTicketId],
    queryFn: () => getSupportTicketMessages(activeTicketId),
    enabled: !!activeTicketId,
  });

  const {
    data: notesRaw,
    isLoading: notesLoading,
    refetch: refetchNotes,
  } = useQuery({
    queryKey: ["support-ticket-notes", activeTicketId],
    queryFn: () => getSupportTicketNotes(activeTicketId),
    enabled: !!activeTicketId,
  });

  const {
    data: attachmentsRaw,
    isLoading: attachmentsLoading,
    refetch: refetchAttachments,
  } = useQuery({
    queryKey: ["support-ticket-attachments", activeTicketId],
    queryFn: () => getSupportTicketAttachments(activeTicketId),
    enabled: !!activeTicketId,
  });

  const { data: assigneesRaw } = useQuery({
    queryKey: ["support-assignees"],
    queryFn: getSupportAssignees,
  });

  const messagesList = useMemo(() => normalizeList(messagesRaw), [messagesRaw]);
  const notesList = useMemo(() => normalizeList(notesRaw), [notesRaw]);
  const attachmentsList = useMemo(() => normalizeList(attachmentsRaw), [attachmentsRaw]);
  const assignees = useMemo(() => normalizeList(assigneesRaw), [assigneesRaw]);

  const permissionSet = useMemo(() => collectTicketPermissions(ticket), [ticket]);
  const can = (perm) => permissionSet.size === 0 || permissionSet.has(perm);

  const status = String(ticket?.status || "").toLowerCase();
  const isWaiting = status === "waiting_for_staff" || status === "waiting_for_customer";
  const isResolved = status === "resolved";
  const isClosed = status === "closed";

  const canResolveAction = can(PERMISSION_KEYS.resolve);
  const canCloseAction = can(PERMISSION_KEYS.close);
  const canReopenAction = can(PERMISSION_KEYS.reopen);
  const canAssignAction = can(PERMISSION_KEYS.assign);
  const canPriorityAction = can(PERMISSION_KEYS.priority);
  const canReplyAction = can(PERMISSION_KEYS.reply) && !isResolved && !isClosed;
  const canNoteAction = can(PERMISSION_KEYS.note);

  const canResolveNow = canResolveAction && isWaiting;
  const canCloseNow = canCloseAction && isResolved;
  const canReopenNow = canReopenAction && (isResolved || isClosed);

  const refreshWorkspace = () => {
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
    if (activeTicketId) {
      qc.invalidateQueries({ queryKey: ["support-ticket", activeTicketId] });
      qc.invalidateQueries({ queryKey: ["support-ticket-messages", activeTicketId] });
      qc.invalidateQueries({ queryKey: ["support-ticket-notes", activeTicketId] });
      qc.invalidateQueries({ queryKey: ["support-ticket-attachments", activeTicketId] });
    }
  };

  const handleMutationTicketSuccess = (raw) => {
    const updatedTicket = extractTicketFromMutation(raw);
    if (updatedTicket && activeTicketId) {
      qc.setQueryData(["support-ticket", activeTicketId], updatedTicket);
    }
    refreshWorkspace();
  };

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, body }) =>
      replyToSupportTicket(ticketId, {
        body,
        idempotency_key: getOpKey("reply"),
      }),
    onSuccess: (res) => {
      clearOpKey("reply");
      handleMutationTicketSuccess(res, "Reply sent");
      setReplyBody("");
      refetchMessages();
      refetchTicket();
    },
    onError: (err) => {
      const apiMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.body?.[0] ||
        "Failed to send reply";
      message.error(apiMsg);
    },
  });

  const noteMutation = useMutation({
    mutationFn: ({ ticketId, body }) =>
      addSupportTicketNote(ticketId, {
        body,
        idempotency_key: getOpKey("note"),
      }),
    onSuccess: (res) => {
      clearOpKey("note");
      handleMutationTicketSuccess(res, "Internal note added");
      setNoteBody("");
      refetchNotes();
    },
    onError: (err) => {
      message.error(err?.response?.data?.detail || "Failed to add note");
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ ticketId, assignee }) =>
      assignSupportTicket(ticketId, {
        assignee,
        idempotency_key: getOpKey("assign"),
      }),
    onSuccess: (res) => {
      clearOpKey("assign");
      handleMutationTicketSuccess(res, "Assignee updated");
      refetchTicket();
    },
    onError: (err) => {
      message.error(err?.response?.data?.detail || "Failed to assign ticket");
    },
  });

  const priorityMutation = useMutation({
    mutationFn: ({ ticketId, priority }) =>
      updateSupportTicketPriority(ticketId, {
        priority,
        idempotency_key: getOpKey("priority"),
      }),
    onSuccess: (res) => {
      clearOpKey("priority");
      handleMutationTicketSuccess(res, "Priority updated");
      refetchTicket();
    },
    onError: (err) => {
      message.error(err?.response?.data?.detail || "Failed to update priority");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ ticketId, payload }) => resolveSupportTicket(ticketId, payload),
    onSuccess: (res) => {
      clearOpKey("resolve");
      handleMutationTicketSuccess(res, "Ticket resolved");
      setResolveOpen(false);
      setResolveCode("answered");
      setResolvePublicMessage("");
      setResolveInternalReason("");
      refetchMessages();
      refetchNotes();
      refetchTicket();
    },
    onError: (err) => {
      message.error(err?.response?.data?.detail || "Failed to resolve ticket");
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ ticketId, reason }) =>
      closeSupportTicket(ticketId, {
        reason,
        idempotency_key: getOpKey("close"),
      }),
    onSuccess: (res) => {
      clearOpKey("close");
      handleMutationTicketSuccess(res, "Ticket closed");
      setCloseReason("");
      refetchTicket();
    },
    onError: (err) => {
      message.error(err?.response?.data?.detail || "Failed to close ticket");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: ({ ticketId, note }) =>
      reopenSupportTicket(ticketId, {
        message: note,
        idempotency_key: getOpKey("reopen"),
      }),
    onSuccess: (res) => {
      clearOpKey("reopen");
      handleMutationTicketSuccess(res, "Ticket reopened");
      setReopenMessage("");
      refetchTicket();
      refetchMessages();
    },
    onError: (err) => {
      message.error(err?.response?.data?.detail || "Failed to reopen ticket");
    },
  });

  const handleSendReply = () => {
    if (!activeTicketId) return;
    if (isResolved || isClosed) {
      message.warning("Reopen this ticket before sending a public reply");
      return;
    }

    const body = replyBody.trim();
    if (!body) {
      message.warning("Reply body is required");
      return;
    }

    replyMutation.mutate({ ticketId: activeTicketId, body });
  };

  const handleAddNote = () => {
    if (!activeTicketId) return;
    const body = noteBody.trim();
    if (!body) {
      message.warning("Note body is required");
      return;
    }

    noteMutation.mutate({ ticketId: activeTicketId, body });
  };

  const handleResolve = () => {
    if (!activeTicketId) return;
    if (!isWaiting) {
      message.warning("Only waiting tickets can be resolved");
      return;
    }
    if (!resolvePublicMessage.trim()) {
      message.warning("Public response is required");
      return;
    }
    if (!resolveInternalReason.trim()) {
      message.warning("Internal reason is required");
      return;
    }

    resolveMutation.mutate({
      ticketId: activeTicketId,
      payload: {
        resolution_code: resolveCode,
        public_message: resolvePublicMessage.trim(),
        internal_reason: resolveInternalReason.trim(),
        idempotency_key: getOpKey("resolve"),
      },
    });
  };

  const handleClose = () => {
    if (!activeTicketId || !isResolved) {
      message.warning("Only resolved tickets can be closed");
      return;
    }
    closeMutation.mutate({
      ticketId: activeTicketId,
      reason: closeReason.trim() || "Customer did not request further assistance.",
    });
  };

  const handleReopen = () => {
    if (!activeTicketId || (status !== "resolved" && status !== "closed")) {
      message.warning("Only resolved or closed tickets can be reopened");
      return;
    }
    reopenMutation.mutate({
      ticketId: activeTicketId,
      note: reopenMessage.trim() || "Reopening this ticket for additional investigation.",
    });
  };

  const getFilenameFromDisposition = (value) => {
    if (!value) return "";
    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }
    const basicMatch = /filename="?([^";]+)"?/i.exec(value);
    return basicMatch?.[1] || "";
  };

  const getAttachmentName = (fileItem, idx = 0) =>
    fileItem?.name || fileItem?.filename || `Attachment ${idx + 1}`;

  const closePreviewAttachment = () => {
    setPreviewAttachment((current) => {
      if (current?.blobUrl) {
        URL.revokeObjectURL(current.blobUrl);
      }
      return null;
    });
  };

  useEffect(() => () => {
    if (previewAttachment?.blobUrl) {
      URL.revokeObjectURL(previewAttachment.blobUrl);
    }
  }, [previewAttachment?.blobUrl]);

  const handlePreviewAttachment = async (fileItem, idx) => {
    if (!activeTicketId) {
      message.warning("Open a ticket first");
      return;
    }

    const attachmentId = fileItem?.id || fileItem?.public_id;
    if (!attachmentId) {
      message.error("Attachment ID not found");
      return;
    }

    try {
      setDownloadingAttachmentId(String(attachmentId));
      const res = await downloadSupportTicketAttachment(activeTicketId, attachmentId);
      const blob = res?.data;
      if (!(blob instanceof Blob)) {
        message.error("Unable to preview attachment");
        return;
      }

      const headerName = getFilenameFromDisposition(res?.headers?.["content-disposition"]);
      const name = headerName || getAttachmentName(fileItem, idx);
      const mime = blob.type || fileItem?.detected_mime_type || fileItem?.mime_type || "application/octet-stream";
      const blobUrl = URL.createObjectURL(blob);

      setPreviewAttachment({
        attachmentId,
        name,
        mime,
        blobUrl,
      });
    } catch (err) {
      message.error(err?.response?.data?.detail || "Failed to preview attachment");
    } finally {
      setDownloadingAttachmentId("");
    }
  };

  const assigneeOptions = assignees.map((item) => ({
    value: item.id,
    label: item.name || item.full_name || item.username || `Staff #${item.id}`,
  }));

  const canViewWorkspace = can(PERMISSION_KEYS.view);

  const ticketPriority = String(ticket?.priority || "normal").toLowerCase();

  const resolutionCode = field(ticket, "resolution_code");
  const resolvedAt = field(ticket, "resolved_at");
  const reopenDeadline = field(ticket, "reopen_deadline", "reopen_until", "reopen_expires_at");

  const getAuthorInitials = (author) => {
    const parts = String(author || "U")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
  };

  const isSupportSideMessage = (item, author) => {
    const role = String(item?.role || item?.sender_role || item?.author_role || "").toLowerCase();
    const senderType = String(item?.sender_type || item?.message_type || "").toLowerCase();
    const authorText = String(author || "").toLowerCase();

    return (
      item?.is_staff === true ||
      item?.created_by_is_staff === true ||
      role.includes("support") ||
      role.includes("staff") ||
      role.includes("agent") ||
      senderType.includes("support") ||
      senderType.includes("staff") ||
      senderType.includes("agent") ||
      authorText.includes("support") ||
      authorText.includes("staff") ||
      authorText.includes("agent")
    );
  };

  const renderConversationBlock = (item, idx, kind = "public") => {
    const author =
      item.sender_name ||
      item.author_name ||
      item.created_by_name ||
      item.author ||
      item.role ||
      (kind === "note" ? "Internal" : "Support");
    const body = item.body || item.message || item.text || "";
    const when = formatDateTime(item.created_at || item.timestamp || item.updated_at);

    if (kind === "public") {
      const supportSide = isSupportSideMessage(item, author);
      const initials = getAuthorInitials(author);

      return (
        <div
          key={item.public_id || item.id || `${kind}-${idx}`}
          className={`flex gap-2.5 ${supportSide ? "justify-end" : "justify-start"}`}
        >
          {!supportSide && (
            <div
              className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
              style={{
                background: "linear-gradient(135deg, rgba(152,117,84,0.2), rgba(187,161,79,0.28))",
                color: "#7a6030",
                border: "1px solid rgba(187,161,79,0.35)",
                fontFamily: "'Poppins', sans-serif",
              }}
              title={author}
            >
              {initials}
            </div>
          )}

          <div
            className="max-w-[82%] sm:max-w-[72%] rounded-2xl px-3 py-2"
            style={{
              background: supportSide
                ? "linear-gradient(135deg, #BBA14F, #987554)"
                : "#fff",
              color: supportSide ? "#fff" : "#3d3d3d",
              border: supportSide
                ? "1px solid rgba(187,161,79,0.45)"
                : "1px solid rgba(187,161,79,0.2)",
              boxShadow: "0 2px 8px rgba(39,39,39,0.06)",
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <p
                className="text-[11px] font-semibold m-0"
                style={{
                  color: supportSide ? "rgba(255,255,255,0.95)" : "#7a6030",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {author}
              </p>
              {when ? (
                <p
                  className="text-[10px] m-0"
                  style={{ color: supportSide ? "rgba(255,255,255,0.78)" : "#9b8567" }}
                >
                  {when}
                </p>
              ) : null}
            </div>

            <p
              className="text-sm m-0"
              style={{
                color: supportSide ? "#fff" : "#3d3d3d",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {body || "—"}
            </p>
          </div>

          {supportSide && (
            <div
              className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold"
              style={{
                background: "linear-gradient(135deg, #BBA14F, #987554)",
                color: "#fff",
                border: "1px solid rgba(187,161,79,0.45)",
                fontFamily: "'Poppins', sans-serif",
              }}
              title={author}
            >
              {initials}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={item.public_id || item.id || `${kind}-${idx}`}
        className="p-3 rounded-xl"
        style={{
          background:
            kind === "note"
              ? "linear-gradient(135deg, rgba(152,117,84,0.1), rgba(187,161,79,0.08))"
              : "linear-gradient(135deg, rgba(187,161,79,0.1), rgba(152,117,84,0.08))",
          border: "1px solid rgba(187,161,79,0.18)",
        }}
      >
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <p className="text-xs font-semibold m-0" style={{ color: "#2f2f2f" }}>{author}</p>
          {when ? (
            <p className="text-[11px] m-0" style={{ color: "#7b7b7b" }}>{when}</p>
          ) : null}
        </div>
        <p className="text-sm m-0" style={{ color: "#3d3d3d", whiteSpace: "pre-wrap" }}>{body || "—"}</p>
      </div>
    );
  };

  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7" style={{ background: "#FDFAF5", minHeight: "100vh", fontFamily: "'Poppins', sans-serif" }}>
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
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#BBA14F,#987554)" }}
            >
              <FiLifeBuoy size={20} color="#fff" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ margin: 0, color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}>
                Settings
              </p>
              <h1 className="text-xl sm:text-2xl leading-none" style={{ margin: 0, color: "#fff", fontFamily: "'Playfair Display', serif" }}>
                Support
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ margin: 0, color: "rgba(255,255,255,0.82)", fontFamily: "'Poppins', sans-serif" }}>
                Chat-style ticket workspace for replies, notes, assign, priority, close, and reopen.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              refetchTickets();
              if (activeTicketId) {
                refetchTicket();
                refetchMessages();
                refetchNotes();
                refetchAttachments();
              }
            }}
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
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "#fff",
            border: "1px solid rgba(187,161,79,0.15)",
            boxShadow: "0 4px 14px rgba(39,39,39,0.06)",
            minHeight: 640,
          }}
        >
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#987554" }}>People</p>

          <Input
            value={queueSearch}
            onChange={(e) => setQueueSearch(e.target.value)}
            placeholder="Search by subject, ref, customer"
            style={{ marginBottom: 10 }}
          />

          <div className="space-y-2" style={{ maxHeight: 470, overflow: "auto", paddingRight: 2 }}>
            {ticketsLoading || ticketsFetching ? (
              <p className="text-sm" style={{ color: "#987554" }}>Loading queue...</p>
            ) : tickets.length ? (
              tickets.map((queueTicket) => {
                const id = getTicketPublicId(queueTicket);
                const isActive = id === activeTicketId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveTicketId(id);
                      setActiveTab("messages");
                    }}
                    className="w-full text-left p-3 rounded-xl"
                    style={{
                      background: isActive ? "linear-gradient(135deg, rgba(187,161,79,0.2), rgba(152,117,84,0.1))" : "#fff",
                      border: isActive ? "1px solid rgba(187,161,79,0.45)" : "1px solid rgba(187,161,79,0.18)",
                      cursor: "pointer",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold m-0" style={{ color: "#2f2f2f" }}>
                          {field(queueTicket, "customer_name", "customer", "requester_name")}
                        </p>
                        <Tag color={getStatusColor(queueTicket.status)} style={{ marginInlineEnd: 0 }}>
                          {String(queueTicket.status || "unknown").replaceAll("_", " ")}
                        </Tag>
                      </div>
                      <p className="text-xs mt-1 mb-0" style={{ color: "#7a664f" }}>{getTicketReference(queueTicket)}</p>
                      <p className="text-xs mt-1 mb-1" style={{ color: "#6f5a42" }}>
                        {getTicketSubject(queueTicket)}
                      </p>
                      <div className="flex justify-end">
                        <Tag
                          color={String(queueTicket.priority || "normal").toLowerCase() === "urgent" ? "red" : "orange"}
                          style={{ marginInlineEnd: 0 }}
                        >
                          {String(queueTicket.priority || "normal")}
                        </Tag>
                      </div>
                  </button>
                );
              })
            ) : (
              <Empty description="No support conversations" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        </div>

        <div
          className="rounded-2xl p-5"
          style={{
            background: "#fff",
            border: "1px solid rgba(187,161,79,0.2)",
            boxShadow: "0 4px 14px rgba(39,39,39,0.06)",
            minHeight: 640,
          }}
        >
          {!activeTicketId ? (
            <Empty description="Select a ticket from the queue" />
          ) : !canViewWorkspace ? (
            <Empty description="You do not have permission to view ticket details." />
          ) : (
            <>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs m-0" style={{ color: "#987554" }}>
                    {ticketLoading ? "Loading ticket..." : getTicketReference(ticket)}
                  </p>
                  <h2 className="text-lg m-0" style={{ color: "#272727", fontFamily: "'Playfair Display', serif" }}>
                    {ticketLoading ? "Support Ticket" : getTicketSubject(ticket)}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    className={BROWN_BTN_CLASS}
                    style={BROWN_BTN_STYLE}
                    icon={<FiMoreVertical size={14} />}
                    onClick={() => setMoreOptionsOpen(true)}
                  >
                    More Options
                  </Button>
                </div>
              </div>

              {(isResolved || isClosed) && (
                <div className="p-3 rounded-xl mb-4" style={{ border: "1px solid rgba(187,161,79,0.32)", background: "rgba(187,161,79,0.1)" }}>
                  <p className="text-[11px] uppercase tracking-widest m-0" style={{ color: "#8d6f2c" }}>Resolution Summary</p>
                  <p className="text-sm mt-1 mb-0" style={{ color: "#6f5a42" }}>Code: {resolutionCode}</p>
                  <p className="text-xs mt-1 mb-0" style={{ color: "#6f5a42" }}>Resolved At: {resolvedAt}</p>
                  <p className="text-xs mt-1 mb-0" style={{ color: "#6f5a42" }}>Reopen Deadline: {reopenDeadline}</p>
                </div>
              )}

              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                  {
                    key: "messages",
                    label: "Public Conversation",
                    children: (
                      <div className="space-y-3">
                        {messagesLoading ? (
                          <p className="text-sm" style={{ color: "#987554" }}>Loading messages...</p>
                        ) : messagesList.length ? (
                          <div
                            className="space-y-3 rounded-2xl p-3"
                            style={{
                              background: "rgba(187,161,79,0.06)",
                              border: "1px solid rgba(187,161,79,0.18)",
                              maxHeight: 380,
                              overflowY: "auto",
                            }}
                          >
                            {messagesList.map((item, idx) => renderConversationBlock(item, idx, "public"))}
                          </div>
                        ) : (
                          <Empty description="No public messages" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        )}

                        <div className="p-3 rounded-xl" style={{ border: "1px solid rgba(187,161,79,0.18)", background: "#fff" }}>
                          <p className="text-sm font-semibold mb-2" style={{ color: "#6f5a42" }}>Public Reply</p>
                          <Input.TextArea
                            rows={4}
                            value={replyBody}
                            disabled={!can(PERMISSION_KEYS.reply) || isResolved || isClosed}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder={
                              isResolved || isClosed
                                ? "Reopen this ticket before replying"
                                : "Reply to the customer"
                            }
                          />
                          <Button
                            className={`mt-3 ${BROWN_BTN_CLASS}`}
                            style={getActionButtonStyle(BROWN_BTN_STYLE, !canReplyAction)}
                            icon={<FiSend size={14} />}
                            loading={replyMutation.isPending}
                            disabled={!canReplyAction}
                            onClick={handleSendReply}
                          >
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "attachments",
                    label: "Attachments",
                    children: attachmentsLoading ? (
                      <p className="text-sm" style={{ color: "#987554" }}>Loading attachments...</p>
                    ) : attachmentsList.length ? (
                      <div className="space-y-2">
                        {attachmentsList.map((fileItem, idx) => {
                          const name = getAttachmentName(fileItem, idx);
                          const attachmentId = fileItem.id || fileItem.public_id;
                          const isDownloading = String(downloadingAttachmentId) === String(attachmentId);
                          return (
                            <button
                              key={fileItem.id || `${name}-${idx}`}
                              type="button"
                              onClick={() => handlePreviewAttachment(fileItem, idx)}
                              disabled={!attachmentId || isDownloading}
                              className="block p-3 rounded-xl"
                              style={{
                                width: "100%",
                                textAlign: "left",
                                cursor: !attachmentId || isDownloading ? "not-allowed" : "pointer",
                                border: "1px solid rgba(187,161,79,0.24)",
                                background: "rgba(187,161,79,0.08)",
                                color: "#6f5a42",
                                textDecoration: "none",
                                opacity: !attachmentId ? 0.65 : 1,
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                <FiPaperclip size={14} />
                                  <span className="truncate">{isDownloading ? `Opening ${name}...` : name}</span>
                                </div>
                                <span style={{ fontSize: 11, color: "#987554", whiteSpace: "nowrap" }}>Preview</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty description="No attachments" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ),
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>

      <Modal
        title="More Options"
        open={moreOptionsOpen}
        onCancel={() => setMoreOptionsOpen(false)}
        footer={null}
        width={760}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-3 rounded-xl" style={{ border: "1px solid rgba(187,161,79,0.18)", background: "#fff" }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#987554" }}>Assign</p>
            <div style={getDisabledControlStyle(!canAssignAction || assignMutation.isPending)}>
              <Select
                style={{ width: "100%" }}
                options={assigneeOptions}
                value={ticket?.assignee || ticket?.assignee_id}
                placeholder="Select assignee"
                disabled={!canAssignAction || assignMutation.isPending}
                onChange={(value) => assignMutation.mutate({ ticketId: activeTicketId, assignee: value })}
                allowClear
              />
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ border: "1px solid rgba(187,161,79,0.2)", background: "#fff" }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#987554" }}>Priority</p>
            <div style={getDisabledControlStyle(!canPriorityAction || priorityMutation.isPending)}>
              <Select
                style={{ width: "100%" }}
                options={PRIORITY_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                value={ticketPriority}
                disabled={!canPriorityAction || priorityMutation.isPending}
                onChange={(value) => priorityMutation.mutate({ ticketId: activeTicketId, priority: value })}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ border: "1px solid rgba(187,161,79,0.2)", background: "#fff" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "#6f5a42" }}>Internal Note</p>
            <Input.TextArea
              rows={4}
              value={noteBody}
              disabled={!can(PERMISSION_KEYS.note)}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add private note for staff"
            />
            <Button
              className={`mt-3 ${BROWN_BTN_CLASS}`}
              style={getActionButtonStyle(BROWN_BTN_STYLE, !canNoteAction)}
              icon={<FiFileText size={14} />}
              loading={noteMutation.isPending}
              disabled={!canNoteAction}
              onClick={handleAddNote}
            >
              Add Note
            </Button>
          </div>

          <div className="p-3 rounded-xl" style={{ border: "1px solid rgba(187,161,79,0.18)", background: "#fff" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "#6f5a42" }}>Close Reason</p>
            <Input.TextArea
              rows={3}
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="Customer did not request further assistance."
              disabled={!can(PERMISSION_KEYS.close) || !isResolved}
            />
            <Button
              className={`mt-3 ${BROWN_BTN_CLASS}`}
              style={getActionButtonStyle(CLOSE_BTN_STYLE, !canCloseNow)}
              icon={<FiXCircle size={14} />}
              loading={closeMutation.isPending}
              disabled={!canCloseNow}
              onClick={handleClose}
            >
              Close Ticket
            </Button>
          </div>

          <div className="p-3 rounded-xl" style={{ border: "1px solid rgba(187,161,79,0.2)", background: "#fff" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "#6f5a42" }}>Reopen Message</p>
            <Input.TextArea
              rows={3}
              value={reopenMessage}
              onChange={(e) => setReopenMessage(e.target.value)}
              placeholder="Reopening this ticket to investigate additional information."
              disabled={!can(PERMISSION_KEYS.reopen) || (!isResolved && !isClosed)}
            />
            <Button
              className={`mt-3 ${BROWN_BTN_CLASS}`}
              style={getActionButtonStyle(BROWN_BTN_STYLE, !canReopenNow)}
              icon={<FiRefreshCw size={14} />}
              loading={reopenMutation.isPending}
              disabled={!canReopenNow}
              onClick={handleReopen}
            >
              Reopen Ticket
            </Button>
          </div>

          <div className="p-3 rounded-xl" style={{ border: "1px solid rgba(187,161,79,0.2)", background: "#fff" }}>
            <p className="text-sm font-semibold mb-2" style={{ color: "#6f5a42" }}>Resolve</p>
            <p className="text-xs mb-2" style={{ color: "#987554" }}>
              Opens the resolve dialog for resolution code, public response, and internal reason.
            </p>
            <Button
              className={BROWN_BTN_CLASS}
              style={getActionButtonStyle(RESOLVE_BTN_STYLE, !canResolveNow)}
              disabled={!canResolveNow}
              icon={<FiCheckCircle size={14} />}
              onClick={() => {
                setMoreOptionsOpen(false);
                setResolveOpen(true);
              }}
            >
              Resolve Ticket
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={previewAttachment?.name || "Attachment Preview"}
        open={!!previewAttachment}
        onCancel={closePreviewAttachment}
        footer={null}
        width={960}
        centered
        destroyOnClose
      >
        {previewAttachment ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <p style={{ margin: 0, color: "#987554", fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>
                  {previewAttachment.mime || "application/octet-stream"}
                </p>
              </div>
              <Button
                className={BROWN_BTN_CLASS}
                style={BROWN_BTN_STYLE}
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = previewAttachment.blobUrl;
                  link.download = previewAttachment.name;
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                }}
              >
                Download
              </Button>
            </div>

            <div
              style={{
                border: "1px solid rgba(187,161,79,0.18)",
                borderRadius: 16,
                background: "#111",
                overflow: "hidden",
                minHeight: 520,
              }}
            >
              {previewAttachment.mime.startsWith("image/") ? (
                <img
                  src={previewAttachment.blobUrl}
                  alt={previewAttachment.name}
                  style={{ width: "100%", height: "auto", display: "block", background: "#111" }}
                />
              ) : previewAttachment.mime === "application/pdf" ? (
                <iframe
                  title={previewAttachment.name}
                  src={previewAttachment.blobUrl}
                  style={{ width: "100%", height: "72vh", border: "none", background: "#fff" }}
                />
              ) : previewAttachment.mime.startsWith("text/") || previewAttachment.mime.includes("json") ? (
                <iframe
                  title={previewAttachment.name}
                  src={previewAttachment.blobUrl}
                  style={{ width: "100%", height: "72vh", border: "none", background: "#fff" }}
                />
              ) : (
                <iframe
                  title={previewAttachment.name}
                  src={previewAttachment.blobUrl}
                  style={{ width: "100%", height: "72vh", border: "none", background: "#fff" }}
                />
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Resolve Ticket"
        open={resolveOpen}
        onCancel={() => setResolveOpen(false)}
        onOk={handleResolve}
        okText="Confirm Resolve"
        confirmLoading={resolveMutation.isPending}
        okButtonProps={{
          className: BROWN_BTN_CLASS,
          style: BROWN_BTN_STYLE,
        }}
      >
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#987554" }}>Resolution Code</p>
            <Select
              style={{ width: "100%" }}
              value={resolveCode}
              onChange={setResolveCode}
              options={RESOLUTION_CODES.map((code) => ({ value: code, label: code }))}
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#987554" }}>Public Response</p>
            <Input.TextArea
              rows={3}
              value={resolvePublicMessage}
              onChange={(e) => setResolvePublicMessage(e.target.value)}
              placeholder="Visible to customer"
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#987554" }}>Internal Reason</p>
            <Input.TextArea
              rows={3}
              value={resolveInternalReason}
              onChange={(e) => setResolveInternalReason(e.target.value)}
              placeholder="Visible to staff only"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
