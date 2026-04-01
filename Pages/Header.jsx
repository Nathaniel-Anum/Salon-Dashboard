import React from "react";
import { FiBell, FiSearch } from "react-icons/fi";
import { useLocation } from "react-router-dom";

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

export function Header() {
  const location = useLocation();
  const pageTitle = routeTitles[location.pathname] || "Dashboard";

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
        <div
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: "#F5EFE6",
            border: "1px solid rgba(187,161,79,0.25)",
          }}
        >
          <FiSearch size={14} style={{ color: "#987554" }} />
          <input
            placeholder="Search…"
            className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#b5a47a] w-36"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          />
        </div>

        {/* notification bell */}
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:scale-105"
          style={{
            background: "#F5EFE6",
            border: "1px solid rgba(187,161,79,0.25)",
          }}
        >
          <FiBell size={16} style={{ color: "#987554" }} />
          {/* badge */}
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: "#BBA14F" }}
          />
        </button>

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
