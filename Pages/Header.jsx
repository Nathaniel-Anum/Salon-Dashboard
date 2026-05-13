import React, { useState, useRef, useEffect } from "react";
import { FiBell, FiSearch, FiAlertTriangle } from "react-icons/fi";
import { Popover } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotifications } from "../src/context/NotificationsContext";

const ALL_PAGES = [
  { label: "Dashboard",            path: "/" },
  { label: "Calendar",             path: "/calendar" },
  { label: "Clients",              path: "/clients" },
  { label: "Services",             path: "/services" },
  { label: "Analytics",            path: "/analytics" },
  { label: "Staff",                path: "/staff" },
  { label: "Role Management",      path: "/role-management" },
  { label: "Blocked Days",         path: "/blocked-days" },
  { label: "Commerce – Categories",path: "/commerce/categories" },
  { label: "Commerce – Products",  path: "/commerce/products" },
  { label: "Commerce – Orders",    path: "/commerce/orders" },
  { label: "Commerce – Inventory", path: "/commerce/inventory" },
  { label: "Settings",             path: "/settings" },
];

const routeTitles = {
  "/": "Dashboard",
  "/appointments": "Appointments",
  "/clients": "Clients",
  "/services": "Services",
  "/analytics": "Analytics",
  "/staff": "Staff",
  "/role-management": "Role Management",
  "/settings": "Settings",
};

function relativeTime(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
}

function NotificationsPopover({ alerts, removeAlert, clearAll }) {
  return (
    <div style={{ width: 320, fontFamily: "'Poppins', sans-serif" }}>
      {/* header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px 10px",
          borderBottom: "1px solid rgba(187,161,79,0.18)",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: "#272727" }}>
          Notifications
          {alerts.length > 0 && (
            <span
              style={{
                marginLeft: 8,
                background: "#e53e3e",
                color: "#fff",
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
              }}
            >
              {alerts.length}
            </span>
          )}
        </span>
        {alerts.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              fontSize: 11,
              color: "#BBA14F",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* list */}
      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {alerts.length === 0 ? (
          <div
            style={{
              padding: "36px 16px",
              textAlign: "center",
              color: "#b5a47a",
              fontSize: 12,
            }}
          >
            <FiBell
              size={26}
              style={{ margin: "0 auto 10px", display: "block", opacity: 0.35 }}
            />
            No notifications yet
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid rgba(187,161,79,0.08)",
                background: "#fffbf0",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "rgba(230,168,23,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <FiAlertTriangle size={13} style={{ color: "#a06800" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#272727",
                    fontWeight: 500,
                  }}
                >
                  {alert.title}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 11,
                    color: "#987554",
                    lineHeight: 1.4,
                  }}
                >
                  {alert.message}
                </p>
                <p
                  style={{ margin: "3px 0 0", fontSize: 10, color: "#b5a47a" }}
                >
                  {relativeTime(alert.timestamp)}
                </p>
              </div>
              <button
                onClick={() => removeAlert(alert.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#b5a47a",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "0 0 0 4px",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = routeTitles[location.pathname] || "Dashboard";
  const { alerts, removeAlert, clearAll } = useNotifications();
  const [bellOpen, setBellOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const filteredPages = searchQuery.trim()
    ? ALL_PAGES.filter((p) =>
        p.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : ALL_PAGES;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handlePageSelect(path) {
    navigate(path);
    setSearchQuery("");
    setSearchOpen(false);
  }

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-8 py-0"
      style={{
        height: 70,
        background: "rgba(252,249,245,0.88)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(187,161,79,0.18)",
        boxShadow: "0 1px 16px rgba(39,39,39,0.06)",
      }}
    >
      {/* left — page title (with left offset on mobile for hamburger) */}
      <div className="pl-10 lg:pl-0">
        <h1
          className="text-xl font-semibold text-[#272727] leading-none"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {pageTitle}
        </h1>
        <p
          className="text-[11px] mt-0.5 tracking-[0.2em] uppercase"
          style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
        >
          CBK Beauty
        </p>
      </div>

      {/* right */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* search — hidden on very small screens */}
        <div className="hidden sm:block relative" ref={searchRef}>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: "#F5EFE6",
              border: "1px solid rgba(187,161,79,0.25)",
            }}
          >
            <FiSearch size={14} style={{ color: "#987554" }} />
            <input
              placeholder="Search pages…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#b5a47a] w-36"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            />
          </div>

          {/* Dropdown */}
          {searchOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                width: 240,
                background: "#FDFAF5",
                border: "1px solid rgba(187,161,79,0.25)",
                borderRadius: 14,
                boxShadow: "0 8px 28px rgba(39,39,39,0.11)",
                overflow: "hidden",
                zIndex: 1200,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {filteredPages.length === 0 ? (
                <div style={{ padding: "14px 16px", fontSize: 12, color: "#b5a47a", textAlign: "center" }}>
                  No pages found
                </div>
              ) : (
                filteredPages.map((page) => (
                  <button
                    key={page.path}
                    onMouseDown={() => handlePageSelect(page.path)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 16px",
                      fontSize: 13,
                      color: location.pathname === page.path ? "#BBA14F" : "#272727",
                      background: location.pathname === page.path
                        ? "rgba(187,161,79,0.08)"
                        : "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: location.pathname === page.path ? 600 : 400,
                      borderBottom: "1px solid rgba(187,161,79,0.07)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(187,161,79,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        location.pathname === page.path
                          ? "rgba(187,161,79,0.08)"
                          : "transparent";
                    }}
                  >
                    {page.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* notification bell */}
        <Popover
          content={
            <NotificationsPopover
              alerts={alerts}
              removeAlert={removeAlert}
              clearAll={clearAll}
            />
          }
          title={null}
          trigger="click"
          open={bellOpen}
          onOpenChange={setBellOpen}
          placement="bottomRight"
          overlayInnerStyle={{
            padding: 0,
            borderRadius: 16,
            border: "1px solid rgba(187,161,79,0.25)",
            boxShadow: "0 8px 32px rgba(39,39,39,0.12)",
            overflow: "hidden",
          }}
          overlayStyle={{ zIndex: 1100 }}
        >
          <button
            className="relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:scale-105"
            style={{
              background: bellOpen ? "#EDE3D5" : "#F5EFE6",
              border: "1px solid rgba(187,161,79,0.25)",
              cursor: "pointer",
            }}
          >
            <FiBell size={16} style={{ color: "#987554" }} />
            {alerts.length > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                style={{
                  minWidth: 18,
                  height: 18,
                  fontSize: 9,
                  background: "#e53e3e",
                  fontFamily: "'Poppins', sans-serif",
                  padding: "0 4px",
                  lineHeight: "18px",
                }}
              >
                {alerts.length > 9 ? "9+" : alerts.length}
              </span>
            )}
          </button>
        </Popover>

        {/* avatar */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow"
            style={{
              background: "linear-gradient(135deg, #BBA14F, #987554)",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            A
          </div>
          <div className="hidden md:block">
            <p
              className="text-sm font-medium text-[#272727] leading-none"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Admin
            </p>
            <p
              className="text-[10px] text-[#987554] mt-0.5"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Manager
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
