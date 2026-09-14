"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/libs/firebase/auth";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const INITIAL_STATE: AuthState = { user: null, isAdmin: false, loading: true };

const AuthContext = createContext<AuthState>(INITIAL_STATE);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setState({ user, isAdmin: user !== null, loading: false });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
