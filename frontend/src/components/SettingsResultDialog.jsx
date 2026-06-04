export default function SettingsResultDialog({ result, onClose }) {
    if (!result) {
        return null;
    }

    const success = Boolean(result.success);
    const title = result.title || (success ? "Folder Validation" : "Folder Validation Failed");
    const fileText = result.filePath || result.fileName || "";
    const pathText = result.path || "";

    return (
        <div className="tracking-modal-overlay" role="presentation">
            <div
                className="tracking-modal tracking-modal-confirm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-result-dialog-title"
            >
                <div className="tracking-modal-header">
                    <h3 id="settings-result-dialog-title">{title}</h3>
                </div>
                <div className="tracking-modal-body">
                    <p className="tracking-modal-text">
                        {result.message || (success ? "Folder is valid and writable." : "Folder validation failed.")}
                    </p>
                    {pathText ? (
                        <div className="settings-export-dialog-detail">
                            <span>Path:</span>
                            <strong>{pathText}</strong>
                        </div>
                    ) : null}
                    {success && fileText ? (
                        <div className="settings-export-dialog-detail">
                            <span>File:</span>
                            <strong>{fileText}</strong>
                        </div>
                    ) : null}
                    {!success && result.technicalDetails ? (
                        <div className="settings-export-dialog-detail">
                            <span>Technical details:</span>
                            <strong>{result.technicalDetails}</strong>
                        </div>
                    ) : null}
                </div>
                <div className="tracking-modal-actions">
                    <button type="button" className="tracking-modal-button" onClick={onClose}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
