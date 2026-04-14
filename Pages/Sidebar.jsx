import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiCalendar,
  FiUsers,
  FiScissors,
  FiBarChart2,
  FiSettings,
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiX,
  FiMenu,
  FiSlash,
} from "react-icons/fi";
import { FaUserAlt } from "react-icons/fa";
import { MdManageAccounts } from "react-icons/md";
import pic1 from "../src/9.svg";
import { useMutation } from "@tanstack/react-query";
import { LoadingOutlined } from "@ant-design/icons";
import _axios from "../src/api/_axios";
import { Spin, Tooltip } from "antd";

const menuItems = [
  { name: "Dashboard",    icon: <FiHome />,      path: "/" },
  { name: "Calendar",     icon: <FiCalendar />,  path: "/calendar" },
  { name: "Services",     icon: <FiScissors />,  path: "/services" },
  { name: "Analytics",    icon: <FiBarChart2 />, path: "/analytics" },
  { name: "Blocked Days", icon: <FiSlash />,     path: "/blocked-days" },
  { name: "Settings",     icon: <FiSettings />,  path: "/settings" },
];

const USER_MGMT_PATHS = ["/staff", "/role-management", "/clients"];

const userMgmtItems = [
  { name: "Staff",           icon: <FaUserAlt size={14} />,        path: "/staff" },
  { name: "Role Management", icon: <MdManageAccounts size={16} />, path: "/role-management" },
  { name: "Clients",         icon: <FiUsers size={14} />,          path: "/clients" },
];

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMgmtOpen, setUserMgmtOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isUserMgmtActive = USER_MGMT_PATHS.some((p) => location.pathname === p);

  const logoutMutation = useMutation({
    mutationFn: (refresh) =>
      _axios.post("/api/portal/v1/accounts/logout/", { refresh }),
    onSuccess: () => {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("refresh");
      localStorage.removeItem("access");
      navigate("/login");
    },
    onError: () => {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("refresh");
      localStorage.removeItem("access");
      navigate("/login");
    },
  });

  const handleLogout = () => logoutMutation.mutate(localStorage.getItem("refresh"));

  const renderNavLink = (item, isMobile, isCollapsed) => (
    <Tooltip key={item.name} title={isCollapsed && !isMobile ? item.name : ""} placement="right">
      <NavLink
        to={item.path}
        onClick={() => isMobile && setMobileOpen(false)}
        className={`group relative flex items-center rounded-xl transition-all duration-200 no-underline ${isCollapsed && !isMobile ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5"}`}
        style={({ isActive }) =>
          isActive
            ? { background: "linear-gradient(90deg,#BBA14F 0%,#c9ae5e 100%)", boxShadow: "0 4px 14px rgba(187,161,79,0.35)", fontWeight: 600, color: "#272727" }
            : { background: "transparent", color: "rgba(255,255,255,0.78)" }
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full" style={{ background: "#272727", opacity: 0.4 }} />
            )}
            <span className={`text-[17px] shrink-0 transition-transform duration-200 ${!isActive ? "group-hover:scale-110" : ""}`}>
              {item.icon}
            </span>
            {(!isCollapsed || isMobile) && (
              <span className="text-sm tracking-wide" style={{ fontFamily: "'Poppins',sans-serif" }}>{item.name}</span>
            )}
          </>
        )}
      </NavLink>
    </Tooltip>
  );

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-6 border-b" style={{ borderColor: "rgba(187,161,79,0.2)" }}>
        <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#fff", border: "1.5px solid rgba(187,161,79,0.5)" }}>
          <img src={pic1} alt="logo" className="w-7 h-7 object-contain" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden">
            <h1 className="text-base font-semibold leading-none text-white" style={{ fontFamily: "'Playfair Display',serif", letterSpacing: "0.03em" }}>CBK Beauty</h1>
            <p className="text-[10px] mt-0.5 tracking-[0.28em] uppercase" style={{ color: "#BBA14F", fontFamily: "'Poppins',sans-serif" }}>Dashboard</p>
          </div>
        )}
        {isMobile && (
          <button className="ml-auto text-white/60 hover:text-white" onClick={() => setMobileOpen(false)}>
            <FiX size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="flex flex-col gap-1">

          {menuItems.slice(0, 4).map((item) => renderNavLink(item, isMobile, collapsed))}

          <div>
            <Tooltip title={collapsed && !isMobile ? "User Management" : ""} placement="right">
              <button
                onClick={() => {
                  if (collapsed && !isMobile) { setCollapsed(false); setUserMgmtOpen(true); }
                  else { setUserMgmtOpen((v) => !v); }
                }}
                className={`w-full group flex items-center rounded-xl transition-all duration-200 ${collapsed && !isMobile ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5"}`}
                style={{
                  background: isUserMgmtActive ? "rgba(187,161,79,0.12)" : "transparent",
                  color: isUserMgmtActive ? "#BBA14F" : "rgba(255,255,255,0.78)",
                  border: isUserMgmtActive ? "1px solid rgba(187,161,79,0.25)" : "1px solid transparent",
                  fontFamily: "'Poppins',sans-serif",
                  cursor: "pointer",
                }}
              >
                <span className={`text-[17px] shrink-0 transition-transform duration-200 ${!isUserMgmtActive ? "group-hover:scale-110" : ""}`}>
                  <FiUsers />
                </span>
                {(!collapsed || isMobile) && (
                  <>
                    <span className="text-sm tracking-wide flex-1 text-left">User Management</span>
                    <FiChevronDown
                      size={14}
                      style={{
                        transition: "transform 0.2s ease",
                        transform: userMgmtOpen || isUserMgmtActive ? "rotate(180deg)" : "rotate(0deg)",
                        color: isUserMgmtActive ? "#BBA14F" : "rgba(255,255,255,0.45)",
                      }}
                    />
                  </>
                )}
              </button>
            </Tooltip>

            {(!collapsed || isMobile) && (userMgmtOpen || isUserMgmtActive) && (
              <div style={{ marginLeft: 14, paddingLeft: 14, borderLeft: "1.5px solid rgba(187,161,79,0.25)", marginTop: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                {userMgmtItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => isMobile && setMobileOpen(false)}
                    className="group relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 no-underline"
                    style={({ isActive }) =>
                      isActive
                        ? { background: "linear-gradient(90deg,#BBA14F 0%,#c9ae5e 100%)", boxShadow: "0 4px 14px rgba(187,161,79,0.3)", fontWeight: 600, color: "#272727" }
                        : { background: "transparent", color: "rgba(255,255,255,0.72)" }
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`text-[15px] shrink-0 transition-transform duration-200 ${!isActive ? "group-hover:scale-110" : ""}`}>
                          {item.icon}
                        </span>
                        <span className="text-sm tracking-wide" style={{ fontFamily: "'Poppins',sans-serif" }}>{item.name}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {menuItems.slice(4).map((item) => renderNavLink(item, isMobile, collapsed))}

        </div>
      </nav>

      <div className="px-3 py-5 border-t" style={{ borderColor: "rgba(187,161,79,0.2)" }}>
        <button
          onClick={handleLogout}
          className={`w-full cursor-pointer flex items-center rounded-xl transition-all duration-200 hover:bg-white/10 px-4 py-2.5 gap-3 ${collapsed && !isMobile ? "justify-center px-0" : ""}`}
          style={{ color: "rgba(255,255,255,0.7)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
        >
          {logoutMutation.isPending ? (
            <Spin indicator={<LoadingOutlined spin style={{ color: "#BBA14F" }} />} size="small" />
          ) : (
            <FiLogOut size={17} />
          )}
          {(!collapsed || isMobile) && (
            <span className="text-sm" style={{ fontFamily: "'Poppins',sans-serif" }}>Logout</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 lg:hidden flex items-center justify-center w-9 h-9 rounded-full shadow-lg"
        style={{ background: "#272727", border: "1px solid rgba(187,161,79,0.4)" }}
        onClick={() => setMobileOpen(true)}
      >
        <FiMenu size={16} style={{ color: "#BBA14F" }} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setMobileOpen(false)} />
      )}

      <div
        className="fixed top-0 left-0 h-full z-50 lg:hidden transition-transform duration-300"
        style={{ width: 270, background: "linear-gradient(180deg,#1c1a15 0%,#272727 60%,#2e2318 100%)", transform: mobileOpen ? "translateX(0)" : "translateX(-100%)" }}
      >
        <SidebarContent isMobile />
      </div>

      <div
        className="hidden lg:flex flex-col relative transition-all duration-300"
        style={{ width: collapsed ? 80 : 260, height: "100vh", position: "sticky", top: 0, flexShrink: 0, background: "linear-gradient(180deg,#1c1a15 0%,#272727 60%,#2e2318 100%)", borderRight: "1px solid rgba(187,161,79,0.15)", zIndex: 40 }}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-16 w-7 h-7 cursor-pointer rounded-full flex items-center justify-center shadow-lg z-50 transition-all duration-200 hover:scale-110"
          style={{ background: "linear-gradient(135deg,#BBA14F,#a08340)", border: "2px solid #1c1a15" }}
        >
          {collapsed ? <FiChevronRight size={12} color="#fff" /> : <FiChevronLeft size={12} color="#fff" />}
        </button>
      </div>
    </>
  );
};

export default Sidebar;