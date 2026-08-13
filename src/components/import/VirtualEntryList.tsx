/**
 * Virtualized preview list for large imports (Phase D — Performance).
 *
 * Renders a windowed view of parsed entries so 1000+ rows scroll smoothly
 * without freezing the main thread. Falls back to a plain map for small
 * batches where virtualization overhead is not worth it.
 */
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ParsedEntry, ImportIssue } from "@/lib/import-parser";

interface Props {
  entries: ParsedEntry[];
  height?: number;
  estimateSize?: number;
  renderRow: (e: ParsedEntry, index: number) => React.ReactNode;
  overrides: Record<number, unknown>;
  rowIssues: (e: ParsedEntry) => ImportIssue[];
}

/**
 * Threshold below which virtualization overhead exceeds its benefit — the
 * caller falls back to a plain map in that case.
 */
export const VIRTUALIZE_THRESHOLD = 100;

export function VirtualEntryList({ entries, height = 480, estimateSize = 56, renderRow }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="overflow-auto" style={{ height, contain: "strict" }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((v) => {
          const e = entries[v.index];
          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${v.start}px)`,
              }}
            >
              {renderRow(e, v.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
