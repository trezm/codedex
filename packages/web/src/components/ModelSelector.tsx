import { useState, useCallback, useEffect } from "react";

const MODELS = [
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
] as const;

const STORAGE_KEY = "syl-selected-model";
const DEFAULT_MODEL = MODELS[0].id;

export function useSelectedModel() {
  const [model, setModel] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_MODEL;
    } catch {
      return DEFAULT_MODEL;
    }
  });

  const selectModel = useCallback((id: string) => {
    setModel(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  return { model, selectModel };
}

export default function ModelSelector({
  model,
  onSelect,
}: {
  model: string;
  onSelect: (model: string) => void;
}) {
  return (
    <select
      value={model}
      onChange={(e) => onSelect(e.target.value)}
      className="bg-gray-800 text-gray-300 text-xs border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-purple-500"
    >
      {MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
