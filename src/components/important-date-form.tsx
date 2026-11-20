"use client";

import { useActionState } from "react";
import { createImportantDate } from "@/app/actions";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { initialActionState } from "@/lib/action-state";
import { t } from "@/lib/text";

export function ImportantDateForm() {
  const [state, formAction, pending] = useActionState(createImportantDate, initialActionState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="field-label">
        <span>{t.importantDates.whatLabel}</span>
        <input
          className="field-input"
          name="what"
          type="text"
          placeholder={t.importantDates.whatPlaceholder}
          maxLength={80}
          required
        />
      </label>
      <label className="field-label">
        <span>{t.importantDates.dateLabel}</span>
        <input className="field-input" name="date" type="date" required />
      </label>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.success ? <p className="text-sm font-bold text-primary" role="status">{state.success}</p> : null}
      <SubmitButton>{pending ? t.importantDates.saving : t.importantDates.add}</SubmitButton>
    </form>
  );
}
