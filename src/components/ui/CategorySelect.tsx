"use client";
import { useRef, useState } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/utils";
import { useCustomCategories } from "@/lib/use-custom-categories";

const ADD_SENTINEL = "__add_custom__";

interface Props {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export default function CategorySelect({ value, onChange, className = "" }: Props) {
  const { custom, addCategory, removeCategory } = useCustomCategories();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const allCategories = [...EXPENSE_CATEGORIES, ...custom];

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === ADD_SENTINEL) {
      setAdding(true);
      // Give the input time to mount before focusing
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      onChange(e.target.value);
    }
  }

  function confirmAdd() {
    const trimmed = draft.trim();
    if (!trimmed) { cancelAdd(); return; }
    addCategory(trimmed);
    onChange(trimmed);
    setDraft("");
    setAdding(false);
  }

  function cancelAdd() {
    setDraft("");
    setAdding(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); confirmAdd(); }
    if (e.key === "Escape") cancelAdd();
  }

  const baseInput =
    "w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400";

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your category..."
          className={`${baseInput} flex-1`}
        />
        <button
          type="button"
          onClick={confirmAdd}
          className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition"
        >
          Add
        </button>
        <button
          type="button"
          onClick={cancelAdd}
          className="px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl text-sm transition"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select
        value={value}
        onChange={handleSelectChange}
        className={`${baseInput} ${className}`}
      >
        <optgroup label="Built-in categories">
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </optgroup>

        {custom.length > 0 && (
          <optgroup label="Your custom categories">
            {custom.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
        )}

        <optgroup label="">
          <option value={ADD_SENTINEL}>+ Add your own category...</option>
        </optgroup>
      </select>

      {/* Show delete button for custom categories */}
      {custom.includes(value) && (
        <button
          type="button"
          onClick={() => {
            removeCategory(value);
            onChange(EXPENSE_CATEGORIES[0]);
          }}
          className="text-xs text-red-400 hover:text-red-600 transition"
        >
          Remove &quot;{value}&quot; from my categories
        </button>
      )}
    </div>
  );
}
