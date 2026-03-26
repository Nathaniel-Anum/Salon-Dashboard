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
} from "react-icons/fi";
import pic1 from "../src/9.svg";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useMutation } from "@tanstack/react-query";
import { LoadingOutlined } from "@ant-design/icons";
import _axios from "../src/api/_axios";
import { Spin } from "antd";
import { MdManageAccounts } from "react-icons/md";

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);

  const navigate = useNavigate();

  const menuItems = [
    { name: "Dashboard", icon: <FiHome />, path: "/" },
    { name: "Appointments", icon: <FiCalendar />, path: "/appointments" },
    { name: "Clients", icon: <FiUsers />, path: "/clients" },
    { name: "Services", icon: <FiScissors />, path: "/services" },
    { name: "Analytics", icon: <FiBarChart2 />, path: "/analytics" },
    { name: "Settings", icon: <FiSettings />, path: "/settings" },
    { name: "Role Management", icon: <MdManageAccounts />, path: "/role-management" },
  ];

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

  const handleLogout = () => {
    const refresh = localStorage.getItem("refresh");
    logoutMutation.mutate(refresh);
  };

  return (
    <div
      className={`
        relative
        ${collapsed ? "w-[90px]" : "w-[270px]"}
        transition-all duration-500 ease-in-out
        flex flex-col justify-between
        bg-gradient-to-b from-[#f5efe6] via-[#efe6d8] to-[#e6dccb]
        border-r border-[#e4d9c6]
        min-h-screen
      `}
    >
      {/* Top Section */}
      <div>
        {/* Logo */}
        <div className="px-6 py-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm">
            <img src={pic1} alt="logo" className="object-cover w-full h-full" />
          </div>

          {!collapsed && (
            <div className="leading-tight">
              <h1 className="text-[18px] font-medium text-[#2a2a2a] tracking-wide">
                Salon
              </h1>
              <p className="text-[11px] tracking-[0.25em] text-[#bfa46f] uppercase">
                Dashboard
              </p>
            </div>
          )}
        </div>

        {/* Menu */}
        <div className="mt-8 flex flex-col gap-2 px-3">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              title={collapsed ? item.name : ""}
              className={({ isActive }) =>
                `group flex items-center relative
                ${collapsed ? "justify-center" : "gap-4"}
                px-4 py-3 rounded-xl 
                transition-all duration-300 ease-in-out
                font-medium tracking-wide text-sm
                text-white no-underline
                ${
                  isActive
                    ? "bg-[#c6a96b] text-white border-l-4 border-black shadow-sm"
                    : "hover:bg-white/30 hover:text-white hover:no-underline"
                }`
              }
            >
              {/* Hover Glow */}
              <span
                className="
                  absolute inset-0 rounded-xl
                  opacity-0 group-hover:opacity-100
                  bg-white/20 transition duration-300
                "
              />

              {/* Icon */}
              <span
                className={`text-[18px] transition-all duration-300
                  ${collapsed ? "" : "group-hover:translate-x-[2px]"}`}
              >
                {item.icon}
              </span>

              {/* Text */}
              {!collapsed && (
                <span className="transition-all duration-200">
                  {item.name}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="px-6 py-8 border-t border-[#e4d9c6] flex flex-col items-center gap-6">
        {/* Logout */}
        <div
          onClick={handleLogout}
          className="flex items-center gap-2 hover:text-[#bfa46f] 
                     transition-all duration-300 cursor-pointer"
        >
          {logoutMutation.isPending ? (
            <Spin
              indicator={<LoadingOutlined spin style={{ color: "#bfa46f" }} />}
              size="small"
            />
          ) : (
            <FiLogOut />
          )}

          {!collapsed && (
            <span className="text-sm font-medium tracking-wide">
              Logout
            </span>
          )}
        </div>
      </div>

      
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="
          absolute -right-0 top-8
          w-9 h-9
          flex items-center justify-center
          rounded-full
          bg-gradient-to-br from-[#c6a96b] to-[#bfa46f]
          text-white
          shadow-md
          cursor-pointer
          hover:scale-105 transition-all duration-300
        "
      >
        {collapsed ? <FaArrowRight size={12} /> : <FaArrowLeft size={12} />}
      </div>
    </div>
  );
};

export default Sidebar;