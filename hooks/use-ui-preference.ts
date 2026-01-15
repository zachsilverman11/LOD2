"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

export type UIPreference = "classic" | "new";

const STORAGE_KEY = "lead-detail-ui-preference";
const DEFAULT_PREFERENCE: UIPreference = "new";

export function useUIPreference() {
  const searchParams = useSearchParams();
  const [preference, setPreferenceState] = useState<UIPreference>(DEFAULT_PREFERENCE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "classic" || stored === "new") {
      setPreferenceState(stored);
    }
    setIsLoaded(true);
  }, []);

  // Check URL param override (safely handle null searchParams during SSR/build)
  const urlOverride = searchParams?.get("ui") ?? null;
  const effectivePreference: UIPreference =
    urlOverride === "v2" || urlOverride === "new"
      ? "new"
      : urlOverride === "classic"
      ? "classic"
      : preference;

  // Save preference to localStorage
  const setPreference = useCallback((newPreference: UIPreference) => {
    setPreferenceState(newPreference);
    localStorage.setItem(STORAGE_KEY, newPreference);
  }, []);

  // Toggle between preferences
  const togglePreference = useCallback(() => {
    const newPreference = preference === "classic" ? "new" : "classic";
    setPreference(newPreference);
  }, [preference, setPreference]);

  return {
    preference: effectivePreference,
    setPreference,
    togglePreference,
    isLoaded,
    isOverriddenByUrl: urlOverride !== null,
  };
}
