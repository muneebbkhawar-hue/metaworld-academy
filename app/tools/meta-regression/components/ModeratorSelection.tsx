"use client";

import { useMemo } from 'react';
import type { MetaRegDataRow, SelectedModerator, ModeratorType } from '../lib/types';

interface ModeratorSelectionProps {
  rows: MetaRegDataRow[];
  selected: SelectedModerator[];
  setSelected: (v: SelectedModerator[]) => void;
}

export default function ModeratorSelection({ rows, selected, setSelected }: ModeratorSelectionProps) {
  const availableColumns = useMemo(
    () => Array.from(new Set(rows.flatMap(r => (r.moderators ? Object.keys(r.moderators) : [])))).sort(),
    [rows]
  );

  function detectedType(name: string): ModeratorType {
    const values = rows.map(r => r.moderators?.[name]).filter((v): v is string => v !== undefined);
    if (values.length === 0) return "categorical";
    return values.every(v => v.trim() !== "" && Number.isFinite(Number(v))) ? "continuous" : "categorical";
  }

  function categoriesFor(name: string): string[] {
    return Array.from(new Set(rows.map(r => r.moderators?.[name]).filter((v): v is string => v !== undefined))).sort();
  }

  function addModerator(name: string) {
    if (selected.some(s => s.name === name)) return;
    const type = detectedType(name);
    const cats = categoriesFor(name);
    setSelected([...selected, { name, type, reference: type === "categorical" ? (cats[0] ?? null) : null }]);
  }

  function removeModerator(name: string) {
    setSelected(selected.filter(s => s.name !== name));
  }

  function updateModerator(name: string, patch: Partial<SelectedModerator>) {
    setSelected(selected.map(s => s.name === name ? { ...s, ...patch } : s));
  }

  if (rows.length === 0) return null;

  if (availableColumns.length === 0) {
    return (
      <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6">
        <h3 className="text-white font-semibold text-sm mb-2">Moderator Selection</h3>
        <p className="text-slate-500 text-sm">No potential moderator columns were detected in the uploaded data. Add extra columns beyond the required outcome columns (e.g. Age, Region, Dose) to use meta-regression.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#151722] border border-indigo-900/20 rounded-2xl p-6 space-y-4">
      <div>
        <h3 className="text-white font-semibold text-sm">Moderator Selection</h3>
        <p className="text-slate-500 text-xs mt-1">
          {selected.length === 0 ? "Select one moderator for univariable meta-regression, or several for multivariable meta-regression." :
            selected.length === 1 ? "Univariable meta-regression (1 moderator)." : `Multivariable meta-regression (${selected.length} moderators).`}
          {" "}You control which columns are used - none are added automatically.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {availableColumns.map(col => {
          const isSelected = selected.some(s => s.name === col);
          return (
            <button key={col} onClick={() => isSelected ? removeModerator(col) : addModerator(col)}
              className={`px-3 py-1.5 rounded-lg text-xs border ${isSelected ? "bg-indigo-950/60 border-indigo-500 text-indigo-300" : "bg-[#0b0c10] border-slate-800 text-slate-400 hover:text-slate-200"}`}>
              {isSelected ? "✓ " : "+ "}{col}
            </button>
          );
        })}
      </div>

      {selected.map(mod => (
        <div key={mod.name} className="bg-[#0b0c10] border border-slate-800 rounded-lg p-4 grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Moderator</label>
            <div className="text-white font-semibold text-sm">{mod.name}</div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Moderator type</label>
            <select value={mod.type} onChange={e => updateModerator(mod.name, {
              type: e.target.value as ModeratorType,
              reference: e.target.value === "categorical" ? (categoriesFor(mod.name)[0] ?? null) : null,
            })} className="w-full bg-[#151722] border border-slate-700 rounded px-2 py-2 text-sm text-white">
              <option value="continuous">Continuous</option>
              <option value="categorical">Categorical</option>
            </select>
          </div>
          {mod.type === "categorical" ? (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Reference category</label>
              <select value={mod.reference ?? ""} onChange={e => updateModerator(mod.name, { reference: e.target.value })} className="w-full bg-[#151722] border border-slate-700 rounded px-2 py-2 text-sm text-white">
                {categoriesFor(mod.name).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ) : <div />}
        </div>
      ))}
    </div>
  );
}
