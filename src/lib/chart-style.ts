/**
 * Shared Recharts tooltip styling so every chart tooltip in the app has
 * proper dark-on-light contrast over the charcoal/cyan theme.
 *
 *   <Tooltip {...chartTooltipProps} />
 */
export const chartTooltipProps = {
  contentStyle: {
    background: "oklch(0.18 0.008 240 / 0.96)",
    border: "1px solid oklch(0.35 0.02 220)",
    borderRadius: 12,
    fontSize: 12,
    color: "oklch(0.96 0 0)",
    backdropFilter: "blur(6px)",
    boxShadow: "0 8px 24px -8px oklch(0 0 0 / 0.5)",
    padding: "8px 12px",
  } as const,
  itemStyle: { color: "oklch(0.96 0 0)" } as const,
  labelStyle: {
    color: "oklch(0.75 0 0)",
    fontSize: 11,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  } as const,
  cursor: { fill: "oklch(0.82 0.15 210 / 0.06)" } as const,
  wrapperStyle: { outline: "none" } as const,
  animationDuration: 180,
};
