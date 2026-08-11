export const advancedV2Keys = Object.freeze({
  all: ["advanced-v2"] as const,
  state: (userId: string) => ["advanced-v2", "state", userId] as const,
});
