import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Profile = { id: string; display_name: string | null; avatar_url: string | null; currency: string; onboarded: boolean };

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

let initialized = false;

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  init: async () => {
    if (initialized) return;
    initialized = true;
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        setTimeout(() => get().refreshProfile(), 0);
      } else {
        set({ profile: null });
      }
    });
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, loading: false });
    if (data.session?.user) await get().refreshProfile();
  },
  refreshProfile: async () => {
    const u = get().user;
    if (!u) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
    if (data) set({ profile: data as Profile });
  },
  signIn: async (email, password) => {
    const maxAttempts = 3;
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          lastError = error;
          // Don't retry on real auth failures (bad credentials, etc.)
          const status = (error as any).status;
          const isTransient = !status || status === 404 || status === 0 || status >= 500;
          if (!isTransient) throw error;
          // Clear potentially stale session before retry
          try { await supabase.auth.signOut({ scope: "local" } as any); } catch {}
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 400 * attempt));
            continue;
          }
          throw error;
        }
        if (data?.session) return;
        lastError = new Error("No session returned");
      } catch (err: any) {
        lastError = err;
        const status = err?.status;
        const isTransient =
          err?.name === "AuthRetryableFetchError" ||
          /fetch|network|failed to fetch|404/i.test(err?.message ?? "") ||
          status === 404 || status === 0 || (typeof status === "number" && status >= 500);
        if (!isTransient || attempt === maxAttempts) throw err;
        try { await supabase.auth.signOut({ scope: "local" } as any); } catch {}
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    }
    throw lastError ?? new Error("Sign in failed");
  },
  signUp: async (email, password, displayName) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { display_name: displayName } },
    });
    if (error) throw error;
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },
}));
