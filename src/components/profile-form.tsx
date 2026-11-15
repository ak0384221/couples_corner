"use client";

import Image from "next/image";
import { useActionState } from "react";
import { saveProfile, updateProfileSettings } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import { PhotoInput } from "@/components/photo-upload";
import { ErrorMessage, Field, SubmitButton } from "@/components/ui";

export function ProfileForm({
  profile,
  avatarUrl,
  editing = false,
}: {
  profile?: {
    name: string;
    username: string;
    bio: string | null;
    birth_day: number | null;
    birth_month: number | null;
    photo_path?: string | null;
  };
  avatarUrl?: string | null;
  editing?: boolean;
}) {
  const action = editing ? updateProfileSettings : saveProfile;
  const [state, formAction, pending] = useActionState(action, initialActionState);
  return (
    <form action={formAction} className="space-y-4">
      <PhotoInput required={false} />
      {avatarUrl ? (
        <div className="flex items-center gap-3">
          <Image
            src={avatarUrl}
            alt="Your current profile photo"
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-full object-cover"
          />
          <p className="text-sm text-ink-soft">Your current profile photo</p>
        </div>
      ) : null}
      <Field label="Your name" name="name" placeholder="What should I call you?" required maxLength={60} defaultValue={profile?.name} />
      <Field label="Username (your ID)" name="username" placeholder="e.g. sunset_chaser" required maxLength={20} defaultValue={profile?.username} />
      <label className="field-label">
        <span>A line about you</span>
        <textarea className="field-input min-h-24 resize-y" name="bio" maxLength={120} defaultValue={profile?.bio ?? ""} placeholder="Biryani lover, sunset chaser" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="field-label">
          <span>Birthday day (optional)</span>
          <select className="field-input" name="birth_day" defaultValue={profile?.birth_day ?? ""}>
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
        <label className="field-label">
          <span>Birthday month</span>
          <select className="field-input" name="birth_month" defaultValue={profile?.birth_month ?? ""}>
            <option value="">Month</option>
            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, i) => <option key={month} value={i + 1}>{month}</option>)}
          </select>
        </label>
      </div>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.success ? <p role="status" className="text-sm font-bold text-primary">{state.success}</p> : null}
      <SubmitButton>{pending ? "Saving…" : editing ? "Save profile" : "Save my profile"}</SubmitButton>
    </form>
  );
}
