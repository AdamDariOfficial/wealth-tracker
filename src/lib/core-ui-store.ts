import { create } from "zustand";

export type CoreComposerTab = "account" | "asset" | "transaction" | "market-data";

type CoreUiState = {
  paletteOpen: boolean;
  togglePalette: (open?: boolean) => void;
  composerOpen: boolean;
  composerTab: CoreComposerTab;
  openComposer: (tab?: CoreComposerTab) => void;
  closeComposer: () => void;
};

export const useCoreUI = create<CoreUiState>((set) => ({
  paletteOpen: false,
  togglePalette: (open) => set((state) => ({ paletteOpen: open ?? !state.paletteOpen })),
  composerOpen: false,
  composerTab: "transaction",
  openComposer: (tab = "transaction") => set({ composerOpen: true, composerTab: tab }),
  closeComposer: () => set({ composerOpen: false }),
}));
