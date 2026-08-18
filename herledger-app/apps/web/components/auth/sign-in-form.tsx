"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ErrorMessage } from "@/components/ui/error-message";
import { runExclusive } from "@/lib/utils/submit-guard";
import { normalizeSignInError } from "@/lib/auth/messages";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // See lib/utils/submit-guard.ts: setLoading() alone can't stop a
  // duplicate request from two submits in the same tick, since the state
  // update hasn't re-rendered (and disabled the button) yet.
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runExclusive(submittingRef, async () => {
      setError(null);
      setLoading(true);
      try {
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(normalizeSignInError(result.error));
        } else {
          router.push("/dashboard");
        }
      } catch {
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setLoading(false);
      }
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate aria-busy={loading}>
      {error && <ErrorMessage message={error} />}

      <FormField
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        required
        autoComplete="email"
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        required
        autoComplete="current-password"
      />

      <SubmitButton loading={loading}>Sign in</SubmitButton>

      <p
        style={{
          textAlign: "center",
          marginTop: "1rem",
          fontSize: "0.875rem",
          color: "var(--muted)",
        }}
      >
        No account?{" "}
        <Link href="/auth/sign-up">Create one</Link>
      </p>
    </form>
  );
}
