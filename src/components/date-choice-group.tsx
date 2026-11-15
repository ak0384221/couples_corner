"use client";

import { useState, useTransition } from "react";
import { manageDateOption } from "@/app/actions";
import type { DateOption, DateOptionCategory } from "@/lib/date-options";

export function DateChoiceGroup({
  label,
  name,
  category,
  options,
}: {
  label: string;
  name: string;
  category: DateOptionCategory;
  options: DateOption[];
}) {
  const [managing, setManaging] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const managerId = `manage-date-options-${category}`;

  function save(operation: "add" | "rename" | "delete", optionId = "", value = "") {
    setMessage(null);
    startTransition(async () => {
      const result = await manageDateOption(category, operation, optionId, value);
      const text = result.error ?? result.success;
      setMessage(text ? { text, isError: Boolean(result.error) } : null);
      if (!result.error) {
        setNewLabel("");
        setEditingId(null);
      }
    });
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <fieldset className="min-w-0 flex-1">
          <legend className="text-sm font-bold">{label}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((option, index) => (
              <label key={option.id} className="choice-chip">
                <input
                  className="sr-only"
                  type="radio"
                  name={name}
                  value={option.label}
                  required={index === 0}
                  defaultChecked={index === 0}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          className="date-choice-manage-toggle"
          aria-expanded={managing}
          aria-controls={managerId}
          onClick={() => setManaging((value) => !value)}
        >
          {managing ? "Done" : "Edit choices"}
        </button>
      </div>
      {managing ? (
        <div id={managerId} className="date-choice-manager">
          <p className="text-xs text-ink-soft">These choices are shared with your partner.</p>
          <div className="mt-2 space-y-2">
            {options.map((option) => (
              <div key={option.id} className="date-choice-manager-row">
                {editingId === option.id ? (
                  <>
                    <label className="sr-only" htmlFor={`${managerId}-${option.id}`}>Edit {label.toLowerCase()} choice</label>
                    <input
                      id={`${managerId}-${option.id}`}
                      className="field-input min-h-10 flex-1 px-3 py-2 text-sm"
                      value={editingLabel}
                      maxLength={40}
                      onChange={(event) => setEditingLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          save("rename", option.id, editingLabel);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="date-choice-manager-action"
                      disabled={pending || !editingLabel.trim()}
                      onClick={() => save("rename", option.id, editingLabel)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="date-choice-manager-action"
                      disabled={pending}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold">{option.label}</span>
                    <button
                      type="button"
                      className="date-choice-manager-action"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(option.id);
                        setEditingLabel(option.label);
                        setMessage(null);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="date-choice-manager-action text-red-700"
                      disabled={pending || options.length < 2}
                      onClick={() => {
                        if (window.confirm(`Delete "${option.label}" from these choices?`)) {
                          save("delete", option.id);
                        }
                      }}
                      title={options.length < 2 ? "Keep at least one choice in each group" : undefined}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <label className="sr-only" htmlFor={`${managerId}-new`}>Add a {label.toLowerCase()} choice</label>
            <input
              id={`${managerId}-new`}
              className="field-input min-h-10 flex-1 px-3 py-2 text-sm"
              value={newLabel}
              maxLength={40}
              placeholder={`Add a ${label.toLowerCase()}`}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  save("add", "", newLabel);
                }
              }}
            />
            <button
              type="button"
              className="date-choice-manager-action"
              disabled={pending || !newLabel.trim()}
              onClick={() => save("add", "", newLabel)}
            >
              Add
            </button>
          </div>
          {message ? (
            <p className={`mt-2 text-xs font-semibold ${message.isError ? "text-red-700" : "text-primary"}`} role={message.isError ? "alert" : "status"}>
              {message.text}
            </p>
          ) : null}
          {pending ? <p className="mt-2 text-xs text-ink-soft" role="status">Saving choices…</p> : null}
        </div>
      ) : null}
    </div>
  );
}
