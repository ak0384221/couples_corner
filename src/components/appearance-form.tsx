"use client";

import { useActionState } from "react";
import { saveAppearance } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { ErrorMessage, SubmitButton } from "@/components/ui";

type Theme = {
  theme_mode: "pink" | "light" | "dark";
  theme_font: "soft" | "classic" | "handwritten" | "simple";
  theme_accent: "rose" | "lilac" | "sky" | "sage" | "butter";
  theme_font_color: "cocoa" | "black" | "plum" | "navy";
};

function SelectField({ label, name, values, current }: { label: string; name: keyof Theme; values: string[]; current: string }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <select className="field-input" name={name} defaultValue={current}>
        {values.map((value) => <option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}
      </select>
    </label>
  );
}

export function AppearanceForm({ theme }: { theme: Theme }) {
  const [state, formAction, pending] = useActionState(saveAppearance, initialActionState);
  return (
    <form action={formAction} className="space-y-4">
      <SelectField label="Background" name="theme_mode" values={["pink", "light", "dark"]} current={theme.theme_mode} />
      <SelectField label="Font style" name="theme_font" values={["soft", "classic", "handwritten", "simple"]} current={theme.theme_font} />
      <SelectField label="Accent color" name="theme_accent" values={["rose", "lilac", "sky", "sage", "butter"]} current={theme.theme_accent} />
      <SelectField label="Text color" name="theme_font_color" values={["cocoa", "black", "plum", "navy"]} current={theme.theme_font_color} />
      <p className="text-xs text-ink-soft">Dark mode keeps text light for readability.</p>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.success ? <p role="status" className="text-sm font-bold text-primary">{state.success}</p> : null}
      <SubmitButton>{pending ? "Saving…" : "Save appearance"}</SubmitButton>
    </form>
  );
}
