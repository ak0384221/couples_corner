"use client";

import { useActionState } from "react";
import { createDate } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { DateChoiceGroup } from "@/components/date-choice-group";
import { Card, ErrorMessage, Field, SubmitButton } from "@/components/ui";
import type { DateOption, DateOptionCategory } from "@/lib/date-options";

type Place = { id: string; name: string; address: string | null; visit_count: number };

export function DateForm({ places, options }: { places: Place[]; options: DateOption[] }) {
  const [state, formAction, pending] = useActionState(createDate, initialActionState);
  const choices = (category: DateOptionCategory) => options.filter((option) => option.category === category);
  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <h2 className="text-xl font-bold">What are we feeling today?</h2>
        <p className="mt-1 text-sm text-ink-soft">Pick a vibe, then the plan.</p>
        <DateChoiceGroup label="Mood" name="mood" category="mood" options={choices("mood")} />
        <DateChoiceGroup label="What sounds fun?" name="activity" category="activity" options={choices("activity")} />
      </Card>

      <Card>
        <h2 className="text-xl font-bold">Where to?</h2>
        <p className="mt-1 text-sm text-ink-soft">Choose a saved place or type in a new one.</p>
        <div className="mt-4 space-y-2">
          <label className="choice-chip w-full justify-start">
            <input className="sr-only" type="radio" name="place_id" value="" defaultChecked={places.length === 0} />
            <span>＋ Add a new place</span>
          </label>
          {places.map((place, index) => (
            <label key={place.id} className="choice-chip w-full justify-start">
              <input className="sr-only" type="radio" name="place_id" value={place.id} defaultChecked={index === 0} />
              <span>{place.name}{place.address ? ` · ${place.address}` : ""} · {place.visit_count} visits</span>
            </label>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <Field label="Name the place" name="place_name" placeholder="A rooftop, garden, or cafe" maxLength={120} />
          <Field label="Address or note (optional)" name="address" placeholder="Add a little detail" maxLength={300} />
          <Field label="Google Maps link (optional)" name="maps_url" placeholder="Paste a Google Maps link" maxLength={500} />
          <label className="flex items-center gap-3 rounded-field bg-blush p-3 text-sm font-semibold">
            <input type="checkbox" name="save_place" value="true" />
            Save this place to Our places
          </label>
        </div>
        <DateChoiceGroup label="Craving?" name="food" category="food" options={choices("food")} />
      </Card>

      <Card>
        <h2 className="text-xl font-bold">When shall we meet?</h2>
        <p className="mt-1 text-sm text-ink-soft">Pick a day and a time, love.</p>
        <div className="mt-4 space-y-3">
          <Field label="The day" name="day" type="date" required />
          <Field label="The time" name="start_time" type="time" required />
        </div>
        <DateChoiceGroup label="Time of day" name="time_label" category="time_label" options={choices("time_label")} />
        <Field label="Give your date a name (optional)" name="name" placeholder="A little night out" maxLength={80} />
      </Card>

      <Card>
        <h2 className="text-xl font-bold">What are we wearing?</h2>
        <DateChoiceGroup label="Your outfit" name="creator_outfit_style" category="creator_outfit_style" options={choices("creator_outfit_style")} />
        <DateChoiceGroup label="Your color" name="creator_outfit_color" category="creator_outfit_color" options={choices("creator_outfit_color")} />
        <DateChoiceGroup label="Your pick for your partner" name="partner_outfit_style" category="partner_outfit_style" options={choices("partner_outfit_style")} />
        <DateChoiceGroup label="Suggested color" name="partner_outfit_color" category="partner_outfit_color" options={choices("partner_outfit_color")} />
      </Card>

      <ErrorMessage>{state.error}</ErrorMessage>
      <SubmitButton>{pending ? "Saving your plan…" : "Lock in our date"}</SubmitButton>
    </form>
  );
}
