"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Hook to handle Zustand persist hydration in Next.js
 * Returns true when the store has been hydrated from localStorage
 */
export function useCartHydration(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
