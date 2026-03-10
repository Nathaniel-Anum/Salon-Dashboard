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
  FiMenu
} from "react-icons/fi";
import { GiHairStrands } from "react-icons/gi";
import pic1 from '../src/9.svg'
import { FaArrowLeft, FaArrowRight  } from "react-icons/fa";

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
  ];

  const handleLogout = () => {
    console.log("Logging out...")
    navigate('/login')
      setIsAuthenticated(false);
  localStorage.removeItem("isAuthenticated");
  }

return (
  <div
    className={`
      ${collapsed ? "w-[80px]" : "w-[260px]"}
      transition-all duration-300
      flex flex-col justify-between
      bg-[#e5d3b3]
      min-h-screen
    `}
  >
    {/* Top Section */}
    <div>
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10">
          <img src={pic1} alt="logo" />
        </div>

        {!collapsed && (
          <div>
            <h1 className="elegant-font text-xl">Salon</h1>
            <p className="text-sm text-[#BBA14F]">Dashboard</p>
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="mt-6 flex flex-col gap-2 px-3">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            title={collapsed ? item.name : ""}
            className={({ isActive }) =>
              `flex items-center ${
                collapsed ? "justify-center" : "gap-3"
              } px-4 py-3 rounded-xl transition-all duration-300
                ${
                  isActive
                    ? "bg-[#BBA14F] text-white"
                    : "hover:bg-white/20 hover:translate-x-1"
                }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {!collapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </div>
    </div>

    {/* Bottom Section */}
    <div className="p-6 border-t border-white/10 flex flex-col items-center gap-3">
      {/* Collapse Arrow */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="cursor-pointer text-lg hover:scale-110 transition"
      >
        {collapsed ? <FaArrowRight /> : <FaArrowLeft />}
      </div>

      {/* Logout */}
      <div
        onClick={handleLogout}
        className="flex items-center gap-2 cursor-pointer hover:text-[#BBA14F]"
      >
        
         
        <FiLogOut />
        
        {!collapsed && <span>Logout</span>}
      </div>
    </div>
  </div>
);

};

export default Sidebar;