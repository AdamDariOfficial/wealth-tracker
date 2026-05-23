import { create } from "zustand";
import type { Transaction } from "@/hooks/use-ledger";

type TxType = Transaction["transaction_type"];

type UIState = {
  paletteOpen: boolean;
  togglePalette: (open?: boolean) => void;

  /** Global transaction modal — driven from anywhere (palette, quick actions). */
  txModalOpen: boolean;
  txDefaults: { type?: TxType; accountId?: string } | null;
  txEdit: Transaction | null;
  openTxModal: (defaults?: { type?: TxType; accountId?: string }) => void;
  openTxEdit: (tx: Transaction) => void;
  closeTxModal: () => void;
};

export const useUI = create<UIState>((set) => ({
  paletteOpen: false,
  togglePalette: (open) => set((s) => ({ paletteOpen: open ?? !s.paletteOpen })),

  txModalOpen: false,
  txDefaults: null,
  txEdit: null,
  openTxModal: (defaults) => set({ txModalOpen: true, txDefaults: defaults ?? null, txEdit: null }),
  openTxEdit: (tx) => set({ txModalOpen: true, txEdit: tx, txDefaults: null }),
  closeTxModal: () => set({ txModalOpen: false, txEdit: null, txDefaults: null }),
}));
