import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/etf")({
  beforeLoad: () => {
    throw redirect({ to: "/investments", search: { view: "etf", q: "", asset: "" } });
  },
  component: () => null,
});
