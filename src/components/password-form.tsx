"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <label className="field-label">
        <span>New password</span>
        <PasswordInput name="password" required minLength={12} maxLength={128} autoComplete="new-password" />
      </label>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.success ? <p role="status" className="text-sm font-bold text-primary">{state.success}</p> : null}
      <SubmitButton>{pending ? "Updating…" : "Change password"}</SubmitButton>
    </form>
  );
}
