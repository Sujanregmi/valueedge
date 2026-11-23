"use client";

import {
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/lib/AuthContext";


export default function RegisterPage() {
  const {
    register,
    refresh,
  } = useAuth();

  const router = useRouter();

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [error, setError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError(null);

    const cleanName = name.trim();

    const cleanEmail = email
      .trim()
      .toLowerCase();

    if (!cleanName) {
      setError(
        "Please enter your name"
      );
      return;
    }

    if (!cleanEmail) {
      setError(
        "Please enter your email"
      );
      return;
    }

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters"
      );
      return;
    }

    if (
      password !== confirmPassword
    ) {
      setError(
        "Passwords don't match"
      );
      return;
    }

    setSubmitting(true);

    try {
      const result = await register(
        cleanName,
        cleanEmail,
        password
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Confirm that the session cookie is
      // available before entering a protected page.
      await refresh();

      router.replace("/dashboard");
      router.refresh();

    } catch (registrationError) {
      console.error(
        "Registration failed:",
        registrationError
      );

      setError(
        "Unable to create your account. Please try again."
      );

    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs font-mono font-bold tracking-widest text-green-600 uppercase">
            EdgePulse
          </p>

          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Create an account
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4"
        >
          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg"
            >
              {error}
            </div>
          )}

          <label className="block">
            <span className="text-sm text-gray-600">
              Name
            </span>

            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              disabled={submitting}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">
              Email
            </span>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              disabled={submitting}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">
              Password
            </span>

            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              disabled={submitting}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">
              Confirm password
            </span>

            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              disabled={submitting}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg py-2.5 text-sm font-semibold transition"
          >
            {submitting
              ? "Creating account…"
              : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}

          <Link
            href="/login"
            className="text-green-600 font-semibold hover:text-green-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}