"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Heart } from "@/components/heart";
import { ErrorMessage } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("That email and password did not match. Please try again.");
      setBusy(false);
      return;
    }

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) {
      setError("We could not verify your sign-in. Please try again.");
      setBusy(false);
      return;
    }
    if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((item) => item.status === "verified");
      if (factorsError || !factor) {
        setError("Two-factor authentication is required, but no verified authenticator is available.");
        setBusy(false);
        return;
      }
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (challengeError) {
        setError("Could not start two-factor verification. Please try again.");
        setBusy(false);
        return;
      }
      setFactorId(factor.id);
      setChallengeId(challenge.id);
      setBusy(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: verifyError } = await createClient().auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That verification code was not accepted.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center gap-5 px-7 py-12">
      <div className="flex flex-col items-center text-center">
        <Heart />
        <h1 className="mt-3 text-3xl font-bold">Our little corner</h1>
        <p className="mt-2 text-ink-soft">Just two keys exist. Yours and mine.</p>
      </div>
      {factorId ? (
        <form className="space-y-4" onSubmit={verifyCode}>
          <label className="field-label">
            <span>Authenticator code</span>
            <input
              className="field-input"
              name="code"
              placeholder="6-digit code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={8}
            />
          </label>
          <button className="primary-button w-full" disabled={busy}>
            {busy ? "Checking…" : "Verify and open our memories"}
          </button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={signIn}>
          <label className="field-label">
            <span>Email</span>
            <input
              className="field-input"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            <span>Password</span>
            <PasswordInput
              autoComplete="current-password"
              placeholder="Your secret word"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="primary-button w-full" disabled={busy}>
            {busy ? "Opening…" : "Open our memories"}
          </button>
        </form>
      )}
      <ErrorMessage>{error}</ErrorMessage>
      <p className="text-center text-sm text-ink-soft">Private and invite-only. No sign-ups.</p>
    </main>
  );
}
