import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile } from "@/application/profile";
import { supabase } from "@/integrations/supabase/client";
import { financialV2Repository } from "@/lib/v2-runtime";

export type AuthProfile = UserProfile &
  Readonly<{
    id: string;
    display_name: string | null;
    currency: string;
    avatar_url: string | null;
  }>;

function adaptProfile(user: User, profile: UserProfile | null): AuthProfile | null {
  if (!profile) return null;

  return Object.freeze({
    ...profile,
    id: user.id,
    display_name: profile.displayName,
    currency: profile.baseCurrency?.toString() ?? "USD",
    avatar_url: null,
  });
}

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  loading: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Redirects to Google; the session arrives back on the app origin. */
  signInWithGoogle: () => Promise<void>;
  /**
   * Resolves with whether the project requires the address to be confirmed
   * before a session can exist, so the UI can give accurate next steps
   * instead of assuming immediate access.
   */
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
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

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      const current = get();
      const currentUserId = current.user?.id ?? null;
      const nextUserId = nextUser?.id ?? null;

      if (!nextUser) {
        set({ session: null, user: null, profile: null, loading: false });
        return;
      }

      const sameUser = currentUserId === nextUserId;
      if (sameUser) {
        set({ session, user: nextUser });
        if (current.profile) return;
      } else {
        set({ session, user: nextUser, profile: null, loading: true });
      }

      const expectedUserId = nextUser.id;
      window.setTimeout(() => {
        void get()
          .refreshProfile()
          .catch((error) => console.error("Profile refresh failed", error))
          .finally(() => {
            if (get().user?.id === expectedUserId) {
              set({ loading: false });
            }
          });
      }, 0);
    });

    let initializationUserId: string | null = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const user = data.session?.user ?? null;
      initializationUserId = user?.id ?? null;
      set({ session: data.session, user, profile: null });
      if (user) await get().refreshProfile();
    } catch (error) {
      authListener.subscription.unsubscribe();
      initialized = false;
      throw error;
    } finally {
      const currentUserId = get().user?.id ?? null;
      if (currentUserId === initializationUserId || currentUserId === null) {
        set({ loading: false });
      }
    }
  },

  refreshProfile: async () => {
    if (!get().user) {
      set({ profile: null });
      return;
    }
    const user = get().user;
    if (!user) {
      set({ profile: null });
      return;
    }

    const state = await financialV2Repository.loadState();
    if (get().user?.id !== user.id) return;
    set({ profile: adaptProfile(user, state.profile) });
  },

  signIn: async (email, password) => {
    const maxAttempts = 3;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          lastError = error;
          const status = error.status;
          const isTransient = !status || status === 404 || status === 0 || status >= 500;
          if (!isTransient) throw error;
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // Best-effort local cleanup before retrying a transient auth failure.
          }
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
            continue;
          }
          throw error;
        }
        if (data.session) return;
        lastError = new Error("No session returned");
      } catch (error) {
        lastError = error;
        const candidate = error as { status?: number; name?: string; message?: string };
        const status = candidate.status;
        const isTransient =
          candidate.name === "AuthRetryableFetchError" ||
          /fetch|network|failed to fetch|404/i.test(candidate.message ?? "") ||
          status === 404 ||
          status === 0 ||
          (typeof status === "number" && status >= 500);
        if (!isTransient || attempt === maxAttempts) throw error;
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // Best-effort local cleanup before retrying a transient auth failure.
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Sign in failed");
  },

  signUp: async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName },
      },
    });
    if (error) throw error;
    return { requiresEmailConfirmation: data.session === null };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, session: null, profile: null, loading: false });
  },
}));
