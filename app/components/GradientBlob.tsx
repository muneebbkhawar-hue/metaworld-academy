// Reusable ambient background glow. Pure CSS (no client JS needed) - the
// drift animation is defined in globals.css (.gradient-blob) and respects
// prefers-reduced-motion there. Kept subtle (15-25% opacity) and purely
// decorative (aria-hidden), positioned absolutely so it never affects
// layout/flow of the section it sits behind.
export default function GradientBlob({
  className = "",
  variant = "primary",
}: {
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const gradient =
    variant === "primary"
      ? "radial-gradient(circle at 30% 30%, #8B5CF6 0%, #6D28D9 45%, transparent 70%)"
      : "radial-gradient(circle at 70% 70%, #C084FC 0%, #8B5CF6 45%, transparent 70%)";

  return (
    <div
      aria-hidden="true"
      className={`gradient-blob pointer-events-none absolute rounded-full blur-3xl opacity-20 ${className}`}
      style={{ background: gradient }}
    />
  );
}
