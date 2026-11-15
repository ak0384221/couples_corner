export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`rounded-card border border-line bg-card p-5 shadow-sm ${className}`}>{children}</section>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg font-bold">{children}</h2>;
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="primary-button w-full" type="submit">
      {children}
    </button>
  );
}

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  defaultValue,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  maxLength?: number;
}) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input
        className="field-input"
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        maxLength={maxLength}
      />
    </label>
  );
}

export function ErrorMessage({ children }: { children?: React.ReactNode }) {
  return children ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{children}</p> : null;
}

export function ChoiceGroup({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="mb-2 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => (
          <label key={option} className="choice-chip">
            <input
              className="sr-only"
              type="radio"
              name={name}
              value={option}
              required={index === 0}
              defaultChecked={defaultValue ? option === defaultValue : index === 0}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
