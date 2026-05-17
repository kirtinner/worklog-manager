export default function TaskDetailsPanel({ entry, value, disabled = false, onChange, onCommit, onEscape }) {
    return (
        <div className="task-details-panel">
            <div className="task-details-comment">
                <textarea
                    className="task-details-textarea"
                    value={entry ? value : ""}
                    disabled={!entry || disabled}
                    aria-label="Comment"
                    onChange={event => onChange(event.target.value)}
                    onBlur={onCommit}
                    onKeyDown={event => {
                        if (event.key === "Enter" && event.ctrlKey) {
                            event.preventDefault();
                            onCommit();
                        }

                        if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            onEscape();
                        }
                    }}
                />
            </div>
        </div>
    );
}
