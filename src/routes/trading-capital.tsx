import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/trading-capital")({
  beforeLoad: () => {
    throw redirect({ to: "/trading", search: { view: "overview", risk: true } });
  },
});
