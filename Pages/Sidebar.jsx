import React from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiCalendar,
  FiUsers,
  FiScissors,
  FiBarChart2,
  FiSettings,
  FiLogOut
} from "react-icons/fi";
import { GiHairStrands } from "react-icons/gi";
import pic1 from '../src/9.svg'

const Sidebar = () => {

  const menuItems = [
    { name: "Dashboard", icon: <FiHome />, path: "/" },
    { name: "Appointments", icon: <FiCalendar />, path: "/appointments" },
    { name: "Clients", icon: <FiUsers />, path: "/clients" },
    { name: "Services", icon: <FiScissors />, path: "/services" },
    { name: "Analytics", icon: <FiBarChart2 />, path: "/analytics" },
    { name: "Settings", icon: <FiSettings />, path: "/settings" },
  ];

  return (
    <div className="w-[260px] text-white flex flex-col justify-between bg-[#e5d3b3]">

      {/* Top Section */}
      <div>
        {/* Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          {/* <GiHairStrands size={32} className="text-[#BBA14F]" /> */}

            <div className=" w-15">
                      
                    <img src={pic1} alt="" />
                    </div>
          <div>
            <h1 className="elegant-font text-lgtext-[#BBA14F]">Salon </h1>
            <p className="text-sm text-[#BBA14F]">Dashboard</p>
          </div>
        </div>

        {/* Menu */}
        <div className="mt-6 flex flex-col gap-2 px-4">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                ${
                  isActive
                    ? "bg-[#BBA14F]  font-semibold"
                    : "hover:bg-white/10 text-white"
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Bottom Profile */}
      <div className="p-6 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Emily</p>
            <p className="text-sm text-[#BBA14F]">Salon Manager</p>
          </div>
          <FiLogOut className="cursor-pointer hover:text-[#BBA14F]" />
        </div>
      </div>

    </div>
  );
};

export default Sidebar;