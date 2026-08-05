import React from "react";
import { Link } from "react-router-dom";
import { FiSettings, FiUser, FiGlobe, FiCreditCard, FiTarget, FiLifeBuoy } from "react-icons/fi";

const SECTIONS = [
  {
    icon: <FiUser size={20} />,
    title: "Profile",
    desc: "Update your salon's name, photo and contact details.",
  },
  {
    icon: <FiCreditCard size={20} />,
    title: "Deposit Rules",
    desc: "Configure deposit amounts and payment policies for bookings.",
  },
  {
    icon: <FiGlobe size={20} />,
    title: "Schedules",
    desc: "Set working hours, breaks and availability for your salon.",
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen px-6 py-8" style={{ background: "#FDFAF5", fontFamily: "'Poppins', sans-serif" }}>
      <div
        className="rounded-3xl p-6 sm:p-7 mb-6"
        style={{
          background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
          boxShadow: "0 16px 40px rgba(39,39,39,0.16)",
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#BBA14F,#987554)" }}
          >
            <FiSettings size={20} color="#fff" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ margin: 0, color: "#BBA14F" }}>Salon Config</p>
            <h1 className="text-2xl" style={{ margin: 0, color: "#fff", fontFamily: "'Playfair Display', serif" }}>Settings</h1>
          </div>
        </div>
        <p className="text-sm" style={{ margin: 0, color: "rgba(255,255,255,0.82)" }}>
          Manage your salon setup and open dedicated campaign controls from here.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {SECTIONS.map(({ icon, title, desc }) => (
          <div
            key={title}
            className="flex flex-col items-start gap-3 p-5 rounded-2xl"
            style={{
              background: "#fff",
              border: "1px solid rgba(187,161,79,0.15)",
              boxShadow: "0 2px 12px rgba(39,39,39,0.04)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(187,161,79,0.18), rgba(152,117,84,0.12))",
                color: "#BBA14F",
              }}
            >
              {icon}
            </div>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "#272727" }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "#987554" }}>{desc}</p>
            </div>
          </div>
        ))}

        <Link
          to="/settings/campaigns"
          className="no-underline"
          style={{ color: "inherit" }}
        >
          <div
            className="h-full flex flex-col items-start gap-3 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, rgba(79,122,168,0.15), rgba(79,168,122,0.1))",
              border: "1px solid rgba(79,122,168,0.25)",
              boxShadow: "0 4px 16px rgba(79,122,168,0.15)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#4f7aa8,#2d5a84)", color: "#fff" }}
            >
              <FiTarget size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "#1d3f61" }}>Campaigns</p>
              <p className="text-xs leading-relaxed" style={{ color: "#355f89" }}>
                Open campaign details, enrollments, grants, and pause/resume actions.
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/settings/support"
          className="no-underline"
          style={{ color: "inherit" }}
        >
          <div
            className="h-full flex flex-col items-start gap-3 p-5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, rgba(79,122,168,0.12), rgba(86,136,180,0.08))",
              border: "1px solid rgba(79,122,168,0.24)",
              boxShadow: "0 4px 16px rgba(79,122,168,0.12)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg,#355f89,#2d5a84)", color: "#fff" }}
            >
              <FiLifeBuoy size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "#1d3f61" }}>Support</p>
              <p className="text-xs leading-relaxed" style={{ color: "#355f89" }}>
                View ticket messages and send replies to customer support requests.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
