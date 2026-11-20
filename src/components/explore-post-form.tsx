"use client";

import { useActionState } from "react";
import { createExplorePost } from "@/app/actions";
import { ErrorMessage } from "@/components/ui";
import { EXPLORE_CATEGORIES } from "@/lib/explore-categories";
import { initialActionState } from "@/lib/action-state";
import { t } from "@/lib/text";

export function ExplorePostForm() {
  const [state, formAction, pending] = useActionState(createExplorePost, initialActionState);

  return (
    <form action={formAction} className="explore-post-form">
      <label className="field-label">
        <span>{t.explore.categoryLabel}</span>
        <select className="field-input" name="category" required>
          {EXPLORE_CATEGORIES.map((category) => (
            <option key={category} value={category}>{t.explore.categories[category]}</option>
          ))}
        </select>
      </label>
      <label className="field-label">
        <span>{t.explore.postLabel}</span>
        <textarea
          className="field-input explore-message-input"
          name="content"
          placeholder={t.explore.postPlaceholder}
          maxLength={500}
          required
        />
      </label>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.success ? <p className="explore-form-success" role="status">{state.success}</p> : null}
      <button className="primary-button w-full" type="submit" disabled={pending}>
        {pending ? t.explore.submitting : t.explore.submit}
      </button>
    </form>
  );
}
