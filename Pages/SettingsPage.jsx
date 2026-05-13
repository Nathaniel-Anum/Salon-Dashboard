import React from "react";
import {
  FiSettings,
  FiUser,
  FiGlobe,
  FiCreditCard,
} from "react-icons/fi";

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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ background: "#FDFAF5", fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Illustration */}
      <div
        className="relative flex items-center justify-center w-40 h-40 rounded-3xl mb-8"
        style={{
          background: "linear-gradient(135deg, #272727 0%, #3a2e1e 100%)",
          boxShadow: "0 20px 60px rgba(187,161,79,0.25)",
        }}
      >
        {/* Dot pattern */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(187,161,79,0.22) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />
        {/* Gear icon with subtle spin */}
        <div
          className="relative z-10"
          style={{
            color: "#BBA14F",
            filter: "drop-shadow(0 0 14px rgba(187,161,79,0.5))",
            animation: "slowspin 12s linear infinite",
          }}
        >
          <FiSettings size={64} strokeWidth={1.2} />
        </div>
        {/* Dashed ring */}
        <div
          className="absolute -inset-3 rounded-[2rem] pointer-events-none"
          style={{
            border: "2px dashed rgba(187,161,79,0.3)",
            animation: "reversespin 20s linear infinite",
          }}
        />
      </div>

      {/* Badge */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-[0.18em] mb-5"
        style={{
          background: "rgba(187,161,79,0.12)",
          border: "1px solid rgba(187,161,79,0.3)",
          color: "#987554",
        }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: "#BBA14F" }}
        />
        Under Construction
      </div>

      {/* Heading */}
      <h1
        className="text-4xl font-bold text-center mb-3"
        style={{
          color: "#272727",
          fontFamily: "'Playfair Display', serif",
          letterSpacing: "-0.01em",
        }}
      >
        Settings
      </h1>
      <p
        className="text-sm text-center max-w-md mb-10"
        style={{ color: "#987554", lineHeight: 1.8 }}
      >
        We're crafting a sleek settings experience for you. All your
        preferences, security options and integrations will live here very soon.
      </p>

      {/* Section cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-2xl">
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
                background:
                  "linear-gradient(135deg, rgba(187,161,79,0.18), rgba(152,117,84,0.12))",
                color: "#BBA14F",
              }}
            >
              {icon}
            </div>
            <div>
              <p
                className="text-sm font-semibold mb-0.5"
                style={{ color: "#272727" }}
              >
                {title}
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "#987554" }}
              >
                {desc}
              </p>
            </div>
            {/* Placeholder bar */}
            <div
              className="w-full h-1.5 rounded-full mt-1"
              style={{ background: "rgba(187,161,79,0.12)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: "40%",
                  background:
                    "linear-gradient(90deg, rgba(187,161,79,0.5), rgba(187,161,79,0.15))",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slowspin    { to { transform: rotate(360deg); } }
        @keyframes reversespin { to { transform: rotate(-360deg); } }
      `}</style>
    </div>
  );
}
