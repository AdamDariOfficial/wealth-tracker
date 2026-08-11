import { useQuery } from "@tanstack/react-query";
import { advancedV2Keys } from "@/data/query-keys";
import { useAuth } from "@/lib/auth-store";
import { advancedV2Repository } from "@/lib/v2-runtime";

export function useAdvancedState() {
  const userId = useAuth((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: advancedV2Keys.state(userId ?? "signed-out"),
    queryFn: () => advancedV2Repository.loadState(),
    enabled: userId !== null,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
