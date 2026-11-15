"use client";

import { useActionState } from "react";
import { addClosetItem } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { PhotoInput } from "@/components/photo-upload";
import { ErrorMessage, Field, SubmitButton } from "@/components/ui";

export function ClosetItemForm() {
  const [state, formAction, pending] = useActionState(addClosetItem, initialActionState);
  return (
    <form action={formAction} className="space-y-3">
      <PhotoInput />
      <label className="field-label">
        <span>What is it?</span>
        <select name="kind" className="field-input" required defaultValue="">
          <option value="" disabled>Choose a type</option>
          {["Dress", "Bag", "Jewelry", "Shoes", "Panjabi", "Shirt"].map((kind) => <option key={kind}>{kind}</option>)}
        </select>
      </label>
      <Field label="Name" name="name" placeholder="Rose three-piece" required maxLength={60} />
      <label className="field-label">
        <span>Main color</span>
        <select name="main_color" className="field-input" defaultValue="">
          <option value="">Choose a color</option>
          {["Rose", "Lilac", "Sky", "Sage", "Butter", "Navy", "Cream", "Black", "Maroon", "Olive"].map((color) => <option key={color}>{color}</option>)}
        </select>
      </label>
      <ErrorMessage>{state.error}</ErrorMessage>
      <SubmitButton>{pending ? "Saving…" : "Save to closet"}</SubmitButton>
    </form>
  );
}
