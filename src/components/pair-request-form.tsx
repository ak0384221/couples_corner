"use client";

import { useActionState } from "react";
import { sendPairRequest } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { ErrorMessage, SubmitButton } from "@/components/ui";

export function PairRequestForm({ profileId }: { profileId: string }) {
  const [state, formAction, pending] = useActionState(sendPairRequest, initialActionState);
  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="receiver_id" value={profileId} />
      <ErrorMessage>{state.error}</ErrorMessage>
      <SubmitButton>{pending ? "Sending…" : "Send pair request"}</SubmitButton>
    </form>
  );
}
