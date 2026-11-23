"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";


const API_URL = "/backend-api";


export type User = {
  id: number;
  name: string;
  email: string;
};


export type AuthResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };


type AuthContextValue = {
  user: User | null;
  loading: boolean;

  login: (
    email: string,
    password: string
  ) => Promise<AuthResult>;

  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<AuthResult>;

  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};


const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);


async function readError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data = await response.json();

    if (
      typeof data.detail === "string"
    ) {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map(
          (item: { msg?: string }) =>
            item.msg ??
            "Invalid information"
        )
        .join(", ");
    }

    return fallback;
  } catch {
    return fallback;
  }
}


export default function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);


  async function refresh(): Promise<void> {
    try {
      const response = await fetch(
        `${API_URL}/auth/me`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        setUser(null);
        return;
      }

      const currentUser: User =
        await response.json();

      setUser(currentUser);
    } catch (error) {
      console.error(
        "Authentication check failed:",
        error
      );

      setUser(null);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void refresh();
  }, []);


  async function login(
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email: email
              .trim()
              .toLowerCase(),
            password,
          }),
        }
      );

      if (!response.ok) {
        return {
          ok: false,
          error: await readError(
            response,
            "Login failed"
          ),
        };
      }

      const loggedInUser: User =
        await response.json();

      setUser(loggedInUser);

      return {
        ok: true,
      };
    } catch (error) {
      console.error(
        "Login request failed:",
        error
      );

      return {
        ok: false,
        error:
          "Cannot connect to the backend",
      };
    }
  }


  async function register(
    name: string,
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email
              .trim()
              .toLowerCase(),
            password,
          }),
        }
      );

      if (!response.ok) {
        return {
          ok: false,
          error: await readError(
            response,
            "Registration failed"
          ),
        };
      }

      const registeredUser: User =
        await response.json();

      setUser(registeredUser);

      return {
        ok: true,
      };
    } catch (error) {
      console.error(
        "Registration request failed:",
        error
      );

      return {
        ok: false,
        error:
          "Cannot connect to the backend",
      };
    }
  }


  async function logout(): Promise<void> {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (error) {
      console.error(
        "Logout request failed:",
        error
      );
    } finally {
      setUser(null);
    }
  }


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}