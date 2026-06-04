export default function DirectorySettingField({
    label,
    value,
    placeholder = "No directory selected",
    disabled = false,
    clearLabel,
    onChange,
    onValidate,
    onClear
}) {
    return (
        <label className="tracking-modal-field settings-directory-field">
            <span>{label}</span>
            <div className="settings-directory-control">
                <input
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={event => onChange?.(event.target.value)}
                />
                <button type="button" className="tracking-save-button" onClick={onValidate} disabled={disabled}>
                    Validate Folder
                </button>
                <button
                    type="button"
                    className="selector-clear-button settings-directory-clear-button"
                    onClick={onClear}
                    aria-label={clearLabel}
                    disabled={disabled || !value}
                >
                    x
                </button>
            </div>
        </label>
    );
}
