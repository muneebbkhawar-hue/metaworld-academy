"use client";

import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { Group, NumbersAtRiskRow } from "../lib/types";

interface Props {
  groups: Group[];
  rows: NumbersAtRiskRow[];
  enabled: boolean;
  onSetEnabled: (enabled: boolean) => void;
  onChange: (rows: NumbersAtRiskRow[]) => void;
}

export default function NumbersAtRiskPanel({ groups, rows, enabled, onSetEnabled, onChange }: Props) {
  function addRow() {
    const lastTime = rows.length ? rows[rows.length - 1].time : 0;
    onChange([...rows, { time: lastTime + 12, valuesByGroupId: Object.fromEntries(groups.map((g) => [g.id, null])) }]);
  }
  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }
  function updateTime(index: number, time: number) {
    onChange(rows.map((r, i) => (i === index ? { ...r, time } : r)));
  }
  function updateValue(index: number, groupId: string, value: string) {
    const num = value === "" ? null : Number(value);
    onChange(rows.map((r, i) => (i === index ? { ...r, valuesByGroupId: { ...r.valuesByGroupId, [groupId]: num === null || Number.isNaN(num) ? null : num } } : r)));
  }

  // Sensible-value validation: non-negative, and each group's risk count should not increase over time (a soft warning, not a hard block - digitized/manually-entered data can have minor irregularities).
  const warnings: string[] = [];
  for (const g of groups) {
    let prev: number | null = null;
    for (const r of rows) {
      const v = r.valuesByGroupId[g.id];
      if (v !== null && v !== undefined) {
        if (v < 0) warnings.push(`${g.name}: negative number at risk at time ${r.time}.`);
        if (prev !== null && v > prev) warnings.push(`${g.name}: number at risk increased from ${prev} to ${v} at time ${r.time} - risk sets normally only decrease.`);
        prev = v;
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
        <input type="checkbox" checked={enabled} onChange={(e) => onSetEnabled(e.target.checked)} />
        Enter a numbers-at-risk table
      </label>
      <p className="text-xs text-[var(--text-secondary)] max-w-xl">
        Strongly recommended: the numbers-at-risk table lets the reconstruction use the validated Guyot et al. (2012) algorithm to
        estimate individual event/censoring times. Without it, you&apos;ll still get the digitized curve, but not a reconstructed
        dataset.
      </p>

      {enabled && (
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left pr-4 pb-2 text-[var(--text-secondary)] font-medium">Time</th>
                {groups.map((g) => (
                  <th key={g.id} className="text-left pr-4 pb-2 text-[var(--text-secondary)] font-medium">
                    {g.name}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="pr-4 pb-2">
                    <input
                      type="number"
                      value={row.time}
                      onChange={(e) => updateTime(i, Number(e.target.value))}
                      className="w-20 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-2 py-1"
                    />
                  </td>
                  {groups.map((g) => (
                    <td key={g.id} className="pr-4 pb-2">
                      <input
                        type="number"
                        value={row.valuesByGroupId[g.id] ?? ""}
                        onChange={(e) => updateValue(i, g.id, e.target.value)}
                        className="w-20 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-void)] px-2 py-1"
                      />
                    </td>
                  ))}
                  <td>
                    <button type="button" onClick={() => removeRow(i)} className="p-1 text-[var(--text-secondary)] hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addRow}
            className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--purple-bright)] transition"
          >
            <Plus size={14} /> Add time point
          </button>
          {warnings.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-500 flex items-center gap-2">
                  <AlertTriangle size={12} /> {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {!enabled && (
        <p className="text-xs text-amber-500 flex items-center gap-2 max-w-xl">
          <AlertTriangle size={13} /> Continuing without a numbers-at-risk table: reconstruction will return the digitized curve only,
          not a reconstructed pseudo-IPD dataset.
        </p>
      )}
    </div>
  );
}
