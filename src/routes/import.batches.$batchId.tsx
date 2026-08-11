import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/import/batches/$batchId")({
  beforeLoad: () => {
    throw redirect({ to: "/import" });
  },
  component: () => null,
});
