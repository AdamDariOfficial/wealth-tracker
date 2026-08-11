import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/audit")({
  beforeLoad: () => {
    throw redirect({ to: "/transactions", search: { q: "", state: "all" } });
  },
  component: () => null,
});
