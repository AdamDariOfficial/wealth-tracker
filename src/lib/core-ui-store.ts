import { create } from "zustand";

export type CoreComposerTab = "account" | "asset" | "transaction" | "market-data";
export type CoreComposerMode = "single" | "general";

type CoreUiState = {
  paletteOpen: boolean;
  togglePalette: (open?: boolean) => void;
  composerOpen: boolean;
  composerTab: CoreComposerTab;
  composerMode: CoreComposerMode;
  openComposer: (tab?: CoreComposerTab, mode?: CoreComposerMode) => void;
  closeComposer: () => void;
};

export const useCoreUI = create<CoreUiState>((set) => ({
  paletteOpen: false,
  togglePalette: (open) => set((state) => ({ paletteOpen: open ?? !state.paletteOpen })),
  composerOpen: false,
  composerTab: "transaction",
  composerMode: "single",
  openComposer: (tab = "transaction", mode = "single") =>
    set({ composerOpen: true, composerTab: tab, composerMode: mode }),
  closeComposer: () => set({ composerOpen: false }),
}));
