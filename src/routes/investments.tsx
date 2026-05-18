import { createFileRoute } from "@tanstack/react-router";
import { Investments } from "@/components/HoldingsPage";

export const Route = createFileRoute("/investments")({ component: Investments });
