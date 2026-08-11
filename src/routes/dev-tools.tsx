import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dev-tools")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
