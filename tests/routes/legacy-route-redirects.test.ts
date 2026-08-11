import { describe, expect, test } from "bun:test";
import { Route as ActivityRoute } from "../../src/routes/activity";
import { Route as AnalyticsRoute } from "../../src/routes/analytics";
import { Route as AuditRoute } from "../../src/routes/audit";
import { Route as DevToolsRoute } from "../../src/routes/dev-tools";
import { Route as ImportBatchRoute } from "../../src/routes/import.batches.$batchId";
import { Route as TimelineRoute } from "../../src/routes/timeline";

type RedirectOptions = {
  to: string;
  search?: Record<string, string>;
  statusCode: number;
};

function captureRedirect(beforeLoad: unknown): RedirectOptions {
  expect(typeof beforeLoad).toBe("function");

  try {
    (beforeLoad as (context: unknown) => unknown)({});
  } catch (error) {
    return (error as { options: RedirectOptions }).options;
  }

  throw new Error("Expected route beforeLoad to throw a redirect");
}

describe("pre-repolish legacy route closure", () => {
  test.each([
    ["activity", ActivityRoute.options.beforeLoad, { to: "/", statusCode: 307 }],
    [
      "analytics",
      AnalyticsRoute.options.beforeLoad,
      {
        to: "/investments",
        search: { view: "all", q: "", asset: "" },
        statusCode: 307,
      },
    ],
    [
      "audit",
      AuditRoute.options.beforeLoad,
      { to: "/transactions", search: { q: "", state: "all" }, statusCode: 307 },
    ],
    [
      "timeline",
      TimelineRoute.options.beforeLoad,
      { to: "/transactions", search: { q: "", state: "all" }, statusCode: 307 },
    ],
    ["dev-tools", DevToolsRoute.options.beforeLoad, { to: "/", statusCode: 307 }],
    ["import batch", ImportBatchRoute.options.beforeLoad, { to: "/import", statusCode: 307 }],
  ])("redirects %s to its canonical destination", (_name, beforeLoad, expected) => {
    expect(captureRedirect(beforeLoad)).toEqual(expected);
  });
});
