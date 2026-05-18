import { createFileRoute } from "@tanstack/react-router";
import { ETF } from "@/components/HoldingsPage";

export const Route = createFileRoute("/etf")({ component: ETF });
