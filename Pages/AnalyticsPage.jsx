import React from "react";
import {
  FiBarChart2,
  FiTrendingUp,
  FiPieChart,
  FiActivity,
} from "react-icons/fi";

const FEATURES = [
  {
    icon: <FiTrendingUp size={22} />,
    title: "Revenue Trends",
    desc: "Daily, weekly and monthly revenue breakdowns at a glance.",
  },
  {
    icon: <FiPieChart size={22} />,
    title: "Service Insights",
    desc: "See which services drive the most bookings and income.",
  },
  {
    icon: <FiActivity size={22} />,
    title: "Staff Performance",
    desc: "Track individual stylist productivity and utilisation rates.",
  },
  {
    icon: <FiBarChart2 size={22} />,
    title: "Customer Retention",
    desc: "Monitor repeat visits and client lifetime value over time.",
  },
];

export default function AnalyticsPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ background: "#FDFAF5", fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Illustration container */}
      <div
        className="relative flex items-center justify-center w-40 h-40 rounded-3xl mb-8"
        style={{
          background: "linear-gradient(135deg, #272727 0%, #3a2e1e 100%)",
          boxShadow: "0 20px 60px rgba(187,161,79,0.25)",
        }}
      >
        {/* Decorative dots */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(187,161,79,0.25) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />
        {/* Animated bar chart illustration */}
        <div className="relative z-10 flex items-end gap-3 h-16">
          {[40, 65, 50, 80, 55].map((h, i) => (
            <div
              key={i}
              className="w-4 rounded-t-md"
              style={{
                height: `${h}%`,
                background:
                  i % 2 === 0
                    ? "linear-gradient(180deg,#BBA14F,#987554)"
                    : "rgba(187,161,79,0.35)",
                animation: `pulse 2s ease-in-out ${i * 0.2}s infinite alternate`,
              }}
            />
          ))}
        </div>
        {/* Pulsing ring */}
        <div
          className="absolute -inset-3 rounded-[2rem] pointer-events-none"
          style={{
            border: "2px dashed rgba(187,161,79,0.3)",
            animation: "spin 18s linear infinite",
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
        Coming Soon
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
        Analytics
      </h1>
      <p
        className="text-sm text-center max-w-md mb-10"
        style={{ color: "#987554", lineHeight: 1.8 }}
      >
        We're building powerful insights for your salon. Soon you'll have
        everything you need to track growth, performance and customer trends —
        all in one place.
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
        {FEATURES.map(({ icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-4 p-5 rounded-2xl"
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
              <p
                className="text-sm font-semibold mb-0.5"
                style={{ color: "#272727" }}
              >
                {title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#987554" }}>
                {desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
