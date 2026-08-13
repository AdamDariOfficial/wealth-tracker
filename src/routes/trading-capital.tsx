import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/trading-capital")({
  beforeLoad: () => {
    throw redirect({ to: "/trading", search: { tab: "capital" } });
  },
});
