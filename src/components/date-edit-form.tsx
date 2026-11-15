"use client";

import { useActionState } from "react";
import { reviseDate, updateDate } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { ErrorMessage, Field, SubmitButton } from "@/components/ui";

export function DateEditForm({
  date,
  revised = false,
}: {
  date: { id: string; name: string | null; day: string; start_time: string; time_label: string | null };
  revised?: boolean;
}) {
  const [state, formAction, pending] = useActionState(revised ? reviseDate : updateDate, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="date_id" value={date.id} />
      <Field label="Date name" name="name" defaultValue={date.name ?? ""} maxLength={80} />
      <Field label="Day" name="day" type="date" defaultValue={date.day.slice(0, 10)} required />
      <Field label="Time" name="start_time" type="time" defaultValue={date.start_time.slice(0, 5)} required />
      <Field label="Time of day" name="time_label" defaultValue={date.time_label ?? ""} maxLength={40} />
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.success ? <p role="status" className="text-sm font-bold text-primary">{state.success}</p> : null}
      <SubmitButton>{pending ? "Saving…" : revised ? "Send updated date request" : "Save changes"}</SubmitButton>
    </form>
  );
}
