"use client";
import { useEffect, useState } from "react";

const LS_KEY = "moneymate-custom-categories";

export function useCustomCategories() {
  const [custom, setCustom] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setCustom(JSON.parse(saved));
    } catch {
      // ignore malformed data
    }
  }, []);

  function addCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed || custom.includes(trimmed)) return;
    const updated = [...custom, trimmed];
    setCustom(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  }

  function removeCategory(name: string) {
    const updated = custom.filter((c) => c !== name);
    setCustom(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  }

  return { custom, addCategory, removeCategory };
}
