import { SupabaseV2AdvancedRepository, SupabaseV2FinancialRepository } from "@/data/supabase/v2";

export const financialV2Repository = new SupabaseV2FinancialRepository();
export const advancedV2Repository = new SupabaseV2AdvancedRepository();
