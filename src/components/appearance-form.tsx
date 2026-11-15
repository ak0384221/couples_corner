"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAppearance } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { ErrorMessage, SubmitButton } from "@/components/ui";

type Theme = {
  theme_mode: "pink" | "light" | "dark";
  theme_font: "soft" | "classic" | "handwritten" | "simple";
  theme_accent: "rose" | "lilac" | "sky" | "sage" | "butter";
  theme_font_color: "cocoa" | "black" | "plum" | "navy";
};

const choices = {
  theme_mode: ["pink", "light", "dark"],
  theme_font: ["soft", "classic", "handwritten", "simple"],
  theme_accent: ["rose", "lilac", "sky", "sage", "butter"],
  theme_font_color: ["cocoa", "black", "plum", "navy"],
} as const satisfies { [Key in keyof Theme]: readonly Theme[Key][] };

function SelectField<Key extends keyof Theme>({
  label,
  name,
  values,
  current,
  onChange,
}: {
  label: string;
  name: Key;
  values: readonly Theme[Key][];
  current: Theme[Key];
  onChange: (value: Theme[Key]) => void;
}) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <select className="field-input" name={name} value={current} onChange={(event) => onChange(event.target.value as Theme[Key])}>
        {values.map((value) => <option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}
      </select>
    </label>
  );
}

export function AppearanceForm({ theme }: { theme: Theme }) {
  const [state, formAction, pending] = useActionState(saveAppearance, initialActionState);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <SelectField label="Background" name="theme_mode" values={choices.theme_mode} current={selectedTheme.theme_mode} onChange={(theme_mode) => setSelectedTheme((current) => ({ ...current, theme_mode }))} />
      <SelectField label="Font style" name="theme_font" values={choices.theme_font} current={selectedTheme.theme_font} onChange={(theme_font) => setSelectedTheme((current) => ({ ...current, theme_font }))} />
      <SelectField label="Accent color" name="theme_accent" values={choices.theme_accent} current={selectedTheme.theme_accent} onChange={(theme_accent) => setSelectedTheme((current) => ({ ...current, theme_accent }))} />
      <SelectField label="Text color" name="theme_font_color" values={choices.theme_font_color} current={selectedTheme.theme_font_color} onChange={(theme_font_color) => setSelectedTheme((current) => ({ ...current, theme_font_color }))} />
      <p className="text-xs text-ink-soft">Text color choices adjust for readability in dark mode.</p>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.success ? <p role="status" className="text-sm font-bold text-primary">{state.success}</p> : null}
      <SubmitButton>{pending ? "Saving…" : "Save appearance"}</SubmitButton>
    </form>
  );
}
