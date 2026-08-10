export const financialV2Keys = Object.freeze({
  all: ["financial-v2"] as const,
  state: (userId: string) => ["financial-v2", "state", userId] as const,
});
