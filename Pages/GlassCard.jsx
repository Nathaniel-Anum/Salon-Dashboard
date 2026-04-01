export function GlassCard({ title, value, icon, trend, trendLabel, accent = "#BBA14F" }) {
  const positive = trend >= 0;
  return (
    <div
      className="relative p-6 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        background: "#FDFAF5",
        border: "1px solid rgba(187,161,79,0.2)",
        boxShadow: "0 4px 24px rgba(39,39,39,0.06)",
      }}
    >
      {/* corner accent */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-[0.07]"
        style={{ background: accent }}
      />

      <div className="flex items-start justify-between mb-4">
        <p
          className="text-sm font-medium text-[#987554] tracking-wide"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {title}
        </p>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: `${accent}18`, color: accent }}
        >
          {icon}
        </div>
      </div>

      <h2
        className="text-2xl font-bold text-[#272727] mb-2"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {value}
      </h2>

      {trend !== undefined && (
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              color: positive ? "#22863a" : "#cb2431",
              background: positive ? "rgba(34,134,58,0.1)" : "rgba(203,36,49,0.1)",
            }}
          >
            {positive ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
          {trendLabel && (
            <span className="text-xs text-[#b5a47a]" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {trendLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
