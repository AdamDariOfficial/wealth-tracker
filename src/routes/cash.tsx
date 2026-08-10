import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cash")({
  beforeLoad: () => {
    throw redirect({ to: "/investments", search: { view: "fiat", q: "", asset: "" } });
  },
  component: () => null,
});
