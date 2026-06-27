"use client";

import { useSettingsContext } from "@/context/SettingsContext";

export function useSettings() {
  return useSettingsContext();
}
