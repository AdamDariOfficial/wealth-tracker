import { useQuery } from "@tanstack/react-query";
import { loadValidatedFinancialState } from "@/application/services";
import { buildWealthOverview } from "@/application/view-models";
import { financialV2Keys } from "@/data/query-keys";
import { useAuth } from "@/lib/auth-store";
import { financialV2Repository } from "@/lib/v2-runtime";

export function useFinancialState() {
  const userId = useAuth((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: financialV2Keys.state(userId ?? "signed-out"),
    queryFn: async () =>
      buildWealthOverview(await loadValidatedFinancialState(financialV2Repository)),
    enabled: userId !== null,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
