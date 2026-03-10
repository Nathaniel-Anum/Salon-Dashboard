export function Header() {
  return (
    <div
      className="
      sticky 
      backdrop-blur-lg
      bg-white/40
      border border-white/20
      
      shadow-md
      px-6 py-5
      flex justify-between
      items-center
      "
    >
      <h1 className="text-xl font-semibold">
         Dashboard
      </h1>

      <input
        placeholder="Search..."
        className="
        px-4 py-2
        rounded-lg
        bg-white/50
        outline-none
        "
      />
    </div>
  );
}