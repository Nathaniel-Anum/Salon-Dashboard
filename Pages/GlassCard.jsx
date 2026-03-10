export function GlassCard({ title, value, icon }) {
  return (
    <div
      className="
      relative
      p-6
      rounded-2xl
      backdrop-blur-lg
      bg-white/40
      border border-white/30
      shadow-lg
      hover:scale-[1.03]
      transition-all duration-300
      overflow-hidden
      "
    >
      {/* Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#BBA14F]/10 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#987554]">{title}</p>
          <h2 className="text-2xl font-semibold text-[#272727] mt-1">
            {value}
          </h2>
        </div>

        <div className="text-3xl text-[#BBA14F]">{icon}</div>
      </div>
    </div>
  );
}