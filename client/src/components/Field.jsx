/**
 * One underlined input with an icon in front of it.
 *
 * The design has no visible labels, only placeholder text. Placeholders are not
 * a substitute for a label as far as screen readers are concerned, so a real
 * <label> is rendered and hidden visually with the .sr-only class.
 *
 * Every prop that is not used here (type, autoComplete, value, onChange, ...)
 * is collected by `...inputProps` and forwarded straight to the <input>.
 */
export default function Field({ icon, name, placeholder, ...inputProps }) {
  const id = `field-${name}`

  return (
    <div className="field">
      <label className="sr-only" htmlFor={id}>
        {placeholder}
      </label>
      <span className="field__icon">{icon}</span>
      <input
        className="field__input"
        id={id}
        name={name}
        placeholder={placeholder}
        {...inputProps}
      />
    </div>
  )
}
