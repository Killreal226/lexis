import { create } from "zustand";
import { auth as authApi } from "./endpoints";
import { tokenStorage } from "./api";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  error: string | null;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  error: null,

  async init() {
    const token = tokenStorage.get();
    if (!token) {
      set({ status: "unauthenticated", user: null });
      return;
    }
    set({ status: "loading" });
    try {
      const me = await authApi.me();
      set({ user: me.user, status: "authenticated", error: null });
    } catch {
      tokenStorage.clear();
      set({ user: null, status: "unauthenticated" });
    }
  },

  async login(email, password) {
    set({ error: null });
    const res = await authApi.login(email, password);
    tokenStorage.set(res.access_token);
    set({ user: res.user, status: "authenticated", error: null });
  },

  async register(email, password) {
    set({ error: null });
    const res = await authApi.register(email, password);
    tokenStorage.set(res.access_token);
    set({ user: res.user, status: "authenticated", error: null });
  },

  logout() {
    tokenStorage.clear();
    set({ user: null, status: "unauthenticated", error: null });
    void authApi.logout().catch(() => {
      /* сервер всё равно ничего не хранит */
    });
  },
}));
