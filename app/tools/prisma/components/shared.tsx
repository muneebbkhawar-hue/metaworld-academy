"use client";

// Small shared building blocks for the PRISMA tool's input panel, styled to
// match the rest of the app (indigo/dark tool-page theme — the site's
// design tokens are fine here, since this is chrome around the diagram,
// not the diagram itself, which stays PRISMA-colored).
export function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#151722] border border-white/10 rounded-xl p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function CountRow({
  name, value, onChange, onRemove, onNameChange,
}: {
  name: string;
  value: number | null;
  onChange: (v: number | null) => void;
  onRemove?: () => void;
  onNameChange?: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {onNameChange ? (
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Custom source name"
          className="flex-1 bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400"
        />
      ) : (
        <span className="flex-1 text-sm text-white/80">{name}</span>
      )}
      <input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value === null ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="n ="
        className="w-24 bg-[#0b0c10] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-right focus:outline-none focus:border-indigo-400"
        aria-label={`Records identified for ${name || "this source"}`}
      />
      {onRemove && (
        <button onClick={onRemove} aria-label={`Remove ${name}`} className="text-white/30 hover:text-rose-400 text-sm px-1">
          ✕
        </button>
      )}
    </div>
  );
}

export function NumberField({
  label, value, onChange, id,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-white/50 mb-1">{label}</label>
      <input
        id={id}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={value === null ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-400"
      />
    </div>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-white/20 bg-[#0b0c10] accent-indigo-500"
      />
      {label}
    </label>
  );
}

export function TotalLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
      <span className="text-white/60">{label}</span>
      <span className="font-semibold text-white tabular-nums">{value.toLocaleString("en-US")}</span>
    </div>
  );
}
