"use client";

import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import type { Group } from "../lib/types";

interface Props {
  groups: Group[];
  activeGroupId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisible: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export default function GroupsPanel({ groups, activeGroupId, onSelect, onRename, onToggleVisible, onAdd, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => (
        <div
          key={g.id}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
            g.id === activeGroupId ? "border-[var(--purple-bright)] bg-[var(--bg-elevated)]" : "border-[var(--border-subtle)]"
          }`}
          onClick={() => onSelect(g.id)}
        >
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: g.color }} />
          <input
            value={g.name}
            onChange={(e) => onRename(g.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none min-w-0"
          />
          <span className="text-xs text-[var(--text-secondary)] shrink-0">{g.points.length} pts</span>
          <button
            type="button"
            title={g.visible ? "Hide curve" : "Show curve"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible(g.id);
            }}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {g.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          {groups.length > 1 && (
            <button
              type="button"
              title="Delete group"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(g.id);
              }}
              className="p-1 text-[var(--text-secondary)] hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 justify-center rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--purple-bright)] transition"
      >
        <Plus size={14} /> Add group
      </button>
    </div>
  );
}
