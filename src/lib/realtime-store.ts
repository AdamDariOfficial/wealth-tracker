import { create } from "zustand";

export type RealtimeStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected"
  | "syncing";

type Store = {
  channels: Record<string, RealtimeStatus>;
  pendingNew: number;
  lastEventAt: number | null;
  setChannel: (name: string, status: RealtimeStatus) => void;
  removeChannel: (name: string) => void;
  notifyNewItem: () => void;
  clearPending: () => void;
};

export const useRealtimeStore = create<Store>((set) => ({
  channels: {},
  pendingNew: 0,
  lastEventAt: null,
  setChannel: (name, status) =>
    set((s) => ({ channels: { ...s.channels, [name]: status } })),
  removeChannel: (name) =>
    set((s) => {
      const next = { ...s.channels };
      delete next[name];
      return { channels: next };
    }),
  notifyNewItem: () =>
    set((s) => ({ pendingNew: s.pendingNew + 1, lastEventAt: Date.now() })),
  clearPending: () => set({ pendingNew: 0 }),
}));

/** Aggregate the global connection status from all live channels. */
export function selectConnectionStatus(s: Store): RealtimeStatus {
  const values = Object.values(s.channels);
  if (values.length === 0) return "connecting";
  if (values.some((v) => v === "disconnected")) return "disconnected";
  if (values.some((v) => v === "reconnecting")) return "reconnecting";
  if (values.some((v) => v === "connecting")) return "connecting";
  return "connected";
}