// A large number with a small label beneath it. No card, no border, no
// background - just the two type primitives from globals.css stacked.
interface StatBlockProps {
  value: string;
  label: string;
}

export default function StatBlock({ value, label }: StatBlockProps) {
  return (
    <div>
      <p className="display-heading">{value}</p>
      <p className="label-text mt-2">{label}</p>
    </div>
  );
}
