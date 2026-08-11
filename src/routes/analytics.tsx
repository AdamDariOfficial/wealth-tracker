import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/investments", search: { view: "all", q: "", asset: "" } });
  },
  component: () => null,
});
