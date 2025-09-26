import { ACCESS_TOKEN, USER_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import type { User } from "@/types";
import { LoaderCircle } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(true);

  // On app load, check for existing token and if so, use it to fetch user info
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem(ACCESS_TOKEN);
      if (!token) return setIsLoading(false);

      try {
        const response = await authFetch(`${USER_SERVICE_URL}/user`);
        const user: User = await response.json();
        setUser(user);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(ACCESS_TOKEN);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // this is necessary so that the authenticated routes check AFTER we have checked for existing token
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoaderCircle className="animate-spin text-gray-600" size={48} />
      </div>
    );
  }

  const login = async (email: string, password: string) => {
    let response: Response;
    try {
      // not using authFetch as we shouldn't have a token yet
      response = await fetch(`${USER_SERVICE_URL}/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch (error) {
      console.error("Login error:", error);
      throw new Error("An error has occurred. Please try again.");
    }

    if (!response.ok) {
      throw new Error("Invalid username or password.");
    }

    const data = await response.json();
    localStorage.setItem(ACCESS_TOKEN, data.data.accessToken);
    setUser(data.data.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem(ACCESS_TOKEN);
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
