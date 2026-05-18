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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
