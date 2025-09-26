import { USER_SERVICE_URL } from "@/constants";
import type { User } from "@/types";
import { createContext, useContext, useEffect, useState } from "react";

export type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // On app load, check for existing token and if so, use it to fetch user info
  useEffect(() => {
    (async () => {
      const tokenName = "access_token";
      const token = localStorage.getItem(tokenName);
      if (!token) return;

      try {
        const userInfo = await fetch(`${USER_SERVICE_URL}/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: User = await userInfo.json();
        setUser(data);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(tokenName);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await fetch(`${USER_SERVICE_URL}/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const data = await response.json();
    localStorage.setItem("access_token", data.access_token);
    setUser(data.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
