import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
  { name: "Dashboard", icon: <FiHome />, path: "/" },
  { name: "Calendar", icon: <FiCalendar />, path: "/calendar" },
  { name: "Clients", icon: <FiUsers />, path: "/clients" },
  { name: "Services", icon: <FiScissors />, path: "/services" },
  { name: "Analytics", icon: <FiBarChart2 />, path: "/analytics" },
  { name: "Staff", icon: <FaUserAlt />, path: "/staff" },
  { name: "Role Management", icon: <MdManageAccounts />, path: "/role-management" },
  { name: "Blocked Days", icon: <FiSlash />, path: "/blocked-days" },
  { name: "Settings", icon: <FiSettings />, path: "/settings" },
];

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

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

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* ── Logo ── */}
      <div
        className={`flex items-center  gap-3 px-5 py-6 border-b`}
        style={{ borderColor: "rgba(187,161,79,0.2)" }}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "#fff", border: "1.5px solid rgba(187,161,79,0.5)" }}
        >
          <img src={pic1} alt="logo" className="w-7 h-7 object-contain" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden">
            <h1
              className="text-base font-semibold leading-none text-white"
              style={{ fontFamily: "'Playfair Display', serif", letterSpacing: "0.03em" }}
            >
              CBK Beauty
            </h1>
            <p
              className="text-[10px] mt-0.5 tracking-[0.28em] uppercase"
              style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
            >
              Dashboard
            </p>
          </div>
        )}
        {isMobile && (
          <button
            className="ml-auto  text-white/60 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <FiX size={18} />
          </button>
        )}
      </div>

      {/* ── Menu ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="flex  flex-col gap-1">
          {menuItems.map((item) => (
            <Tooltip
              key={item.name}   
              title={collapsed && !isMobile ? item.name : ""}
              placement="right"
            >
              <NavLink
                to={item.path}
                onClick={() => isMobile && setMobileOpen(false)}
                className={({ isActive }) =>
                  `group relative flex items-center rounded-xl transition-all duration-250 no-underline
                  ${collapsed && !isMobile ? "justify-center px-0 py-3" : "gap-3 px-4 py-2.5"}`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background: "linear-gradient(90deg, #BBA14F 0%, #c9ae5e 100%)",
                        boxShadow: "0 4px 14px rgba(187,161,79,0.35)",
                        fontWeight: 600,
                        color: "#272727",
                      }
                    : {
                        background: "transparent",
                        color: "rgba(255,255,255,0.78)",
                      }
                }
              >
                {({ isActive }) => (
                  <>
                    {/* left accent bar */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                        style={{ background: "#272727", opacity: 0.4 }}
                      />
                    )}

                    <span
                      className={`text-[17px] flex-shrink-0 transition-transform duration-200 ${
                        !isActive ? "group-hover:scale-110" : ""
                      }`}
                    >
                      {item.icon}
                    </span>

                    {(!collapsed || isMobile) && (
                      <span
                        className="text-sm tracking-wide"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        {item.name}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </Tooltip>
          ))}
        </div>
      </nav>

      {/* ── Bottom ── */}
      <div
        className="px-3 py-5 border-t"
        style={{ borderColor: "rgba(187,161,79,0.2)" }}
      >
        <button
          onClick={handleLogout}
          className={`w-full cursor-pointer flex items-center rounded-xl transition-all duration-200
            hover:bg-white/10 px-4 py-2.5 gap-3
            ${collapsed && !isMobile ? "justify-center px-0" : ""}`}
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
            <span className="text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Logout
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile hamburger ── */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden flex items-center justify-center w-9 h-9 rounded-full shadow-lg"
        style={{ background: "#272727", border: "1px solid rgba(187,161,79,0.4)" }}
        onClick={() => setMobileOpen(true)}
      >
        <FiMenu size={16} style={{ color: "#BBA14F" }} />
      </button>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className="fixed top-0 left-0 h-full z-50 lg:hidden transition-transform duration-300"
        style={{
          width: 270,
          background: "linear-gradient(180deg, #1c1a15 0%, #272727 60%, #2e2318 100%)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <SidebarContent isMobile />
      </div>

      {/* ── Desktop sidebar ── */}
      <div
        className="hidden lg:flex flex-col relative transition-all duration-400"
        style={{
          width: collapsed ? 80 : 260,
          height: "100vh",
          position: "sticky",
          top: 0,
          flexShrink: 0,
          background: "linear-gradient(180deg, #1c1a15 0%, #272727 60%, #2e2318 100%)",
          borderRight: "1px solid rgba(187,161,79,0.15)",
          zIndex: 40,
        }}
      >
        <SidebarContent />

        {/* collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-16 w-7 h-7 cursor-pointer rounded-full flex items-center justify-center shadow-lg z-50 transition-all duration-200 hover:scale-110"
          style={{
            background: "linear-gradient(135deg, #BBA14F, #a08340)",
            border: "2px solid #1c1a15",
          } }
        >
          {collapsed ? (
            <FiChevronRight size={12} color="#fff" />
          ) : (
            <FiChevronLeft size={12} color="#fff" />
          )}
        </button>
      </div>
    </>
  );
};

export default Sidebar;