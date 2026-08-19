import { afterEach, describe, expect, test } from "bun:test";
import { useCoreUI } from "../../src/lib/core-ui-store";

function resetStore() {
  useCoreUI.setState({
    paletteOpen: false,
    composerOpen: false,
    composerTab: "transaction",
    composerMode: "single",
  });
}

afterEach(resetStore);

describe("core UI composer mode", () => {
  test("page-specific actions open a single dedicated form by default", () => {
    useCoreUI.getState().openComposer("account");
    const state = useCoreUI.getState();

    expect(state.composerOpen).toBe(true);
    expect(state.composerTab).toBe("account");
    expect(state.composerMode).toBe("single");
  });

  test("global Add record explicitly opens the general composer", () => {
    useCoreUI.getState().openComposer("transaction", "general");
    const state = useCoreUI.getState();

    expect(state.composerOpen).toBe(true);
    expect(state.composerTab).toBe("transaction");
    expect(state.composerMode).toBe("general");
  });
});
