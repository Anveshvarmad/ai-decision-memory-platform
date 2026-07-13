import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
} from "../lib/api";

import type { User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<void>;
  register: (
    email: string,
    fullName: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext =
  createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "decision_memory_token";

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    getCurrentUser()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function login(
    email: string,
    password: string,
  ) {
    const response = await loginRequest(
      email,
      password,
    );

    localStorage.setItem(
      TOKEN_KEY,
      response.access_token,
    );

    setUser(response.user);
  }

  async function register(
    email: string,
    fullName: string,
    password: string,
  ) {
    const response = await registerRequest(
      email,
      fullName,
      password,
    );

    localStorage.setItem(
      TOKEN_KEY,
      response.access_token,
    );

    setUser(response.user);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(
      "decision_memory_workspace",
    );

    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
    }),
    [user, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}
