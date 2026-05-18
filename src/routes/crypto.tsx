import { createFileRoute } from "@tanstack/react-router";
import { Crypto } from "@/components/HoldingsPage";

export const Route = createFileRoute("/crypto")({ component: Crypto });
