import { useRef, useState } from "react";
import { getImportSchema, importValidatedFile, validateImportFile } from "../services/administrationService";

function getFileName(file) {
    return file?.name ?? "No file selected";
}

function getApiErrorMessage(error, fallbackMessage) {
    const responseData = error?.response?.data;
    const message = typeof responseData === "string"
        ? responseData
        : responseData?.message || responseData?.error || error?.message;
    return message || fallbackMessage;
}

function countTotal(counts = {}) {
    return Object.values(counts).reduce((sum, value) => sum + Number(value ?? 0), 0);
}

function formatIssue(issue) {
    const location = [
        issue.sheet,
        issue.rowNumber != null ? `row ${issue.rowNumber}` : null,
        issue.field
    ].filter(Boolean).join(", ");

    return location ? `${location}: ${issue.message}` : issue.message;
}

function ImportCountsSummary({ validation }) {
    const counts = validation?.counts ?? validation?.validRowsCount ?? {};
    const items = [
        ["Organizations", counts.organizations],
        ["Clients", counts.clients],
        ["Projects", counts.projects],
        ["Software Products", counts.softwareProducts],
        ["Tasks", counts.tasks],
        ["Time Entries", counts.timeEntries]
    ];

    return (
        <div className="administration-validation-summary">
            {items.map(([label, value]) => (
                <div key={label} className="administration-validation-summary-item">
                    <span>{label}:</span>
                    <strong>{Number(value ?? 0)}</strong>
                </div>
            ))}
        </div>
    );
}

function ValidationFailureDialog({ validation, onClose }) {
    const errors = validation?.errors ?? [];

    return (
        <div className="tracking-modal-overlay" role="presentation">
            <div
                className="tracking-modal tracking-modal-confirm administration-result-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="administration-validation-failed-title"
            >
                <div className="tracking-modal-header">
                    <h3 id="administration-validation-failed-title">Validation failed</h3>
                </div>
                <div className="tracking-modal-body administration-result-body">
                    <p className="tracking-modal-text">
                        Validation failed. Import was stopped. Fix the Excel file and try again.
                    </p>
                    <div className="tracking-status-banner administration-status-banner">
                        Validation status: {validation?.status ?? "INVALID"}
                    </div>
                    <div className="administration-validation-count">
                        Rows with errors: {Number(validation?.errorRowsCount ?? 0)}
                    </div>
                    {errors.length > 0 ? (
                        <div className="administration-issues">
                            <h4>Errors</h4>
                            <ul className="tracking-modal-list">
                                {errors.map((issue, index) => (
                                    <li key={`validation-error-${index}`}>{formatIssue(issue)}</li>
                                ))}
                            </ul>
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

function ImportSuccessDialog({ onClose }) {
    return (
        <div className="tracking-modal-overlay" role="presentation">
            <div
                className="tracking-modal tracking-modal-confirm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="administration-import-success-title"
            >
                <div className="tracking-modal-header">
                    <h3 id="administration-import-success-title">Import completed</h3>
                </div>
                <div className="tracking-modal-body">
                    <p className="tracking-modal-text">Import completed successfully.</p>
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

function ImportHelpDialog({ schema, loading, error, onClose }) {
    return (
        <div className="tracking-modal-overlay" role="presentation">
            <div
                className="tracking-modal tracking-modal-confirm administration-help-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="administration-help-title"
            >
                <div className="tracking-modal-header">
                    <h3 id="administration-help-title">Import Information</h3>
                </div>
                <div className="tracking-modal-body administration-help-body">
                    {loading ? (
                        <p className="tracking-modal-text">Loading import requirements...</p>
                    ) : error ? (
                        <p className="tracking-modal-text">{error}</p>
                    ) : (
                        <>
                            <section className="administration-help-section">
                                <h4>Import warning</h4>
                                <p className="tracking-modal-text">
                                    {schema?.warning ?? "Import will replace all current data for the current user account."}
                                </p>
                                <p className="tracking-modal-text">The following data will be replaced:</p>
                                <ul className="tracking-modal-list">
                                    {(schema?.replacedData ?? []).map(item => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </section>

                            <section className="administration-help-section">
                                <h4>Excel file requirements</h4>
                                <div className="administration-schema-list">
                                    {(schema?.sheets ?? []).map(sheet => (
                                        <div key={sheet.sheetName} className="administration-schema-sheet">
                                            <h5>{sheet.sheetName}</h5>
                                            <div className="administration-schema-columns">
                                                <div>
                                                    <span>Required columns</span>
                                                    <ul className="tracking-modal-list">
                                                        {(sheet.requiredColumns ?? []).map(column => (
                                                            <li key={column}>{column}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <span>Optional columns</span>
                                                    {(sheet.optionalColumns ?? []).length > 0 ? (
                                                        <ul className="tracking-modal-list">
                                                            {sheet.optionalColumns.map(column => (
                                                                <li key={column}>{column}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <p className="tracking-modal-text">None</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
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

export default function AdministrationPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [validationResult, setValidationResult] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [validationFailureOpen, setValidationFailureOpen] = useState(false);
    const [successOpen, setSuccessOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [importSchema, setImportSchema] = useState(null);
    const [importSchemaLoading, setImportSchemaLoading] = useState(false);
    const [importSchemaError, setImportSchemaError] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const fileInputRef = useRef(null);

    const canExecuteImport = selectedFile
        && validationResult?.status === "ALL_VALID"
        && countTotal(validationResult.counts ?? validationResult.validRowsCount) > 0;

    const handleChooseFile = () => {
        fileInputRef.current?.click();
    };

    const handleOpenHelp = async () => {
        setHelpOpen(true);

        if (importSchema || importSchemaLoading) {
            return;
        }

        setImportSchemaLoading(true);
        setImportSchemaError("");
        try {
            const schema = await getImportSchema();
            setImportSchema(schema);
        } catch (error) {
            setImportSchemaError(getApiErrorMessage(error, "Unable to load import requirements."));
        } finally {
            setImportSchemaLoading(false);
        }
    };

    const handleCloseHelp = () => {
        setHelpOpen(false);
    };

    const handleFileChange = (event) => {
        const nextFile = event.target.files?.[0] ?? null;
        setSelectedFile(nextFile);
        setValidationResult(null);
        setValidationFailureOpen(false);
        setSuccessOpen(false);
        setMessage("");

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleImportData = async () => {
        if (!selectedFile) {
            return;
        }

        setBusy(true);
        setMessage("");
        setValidationResult(null);

        try {
            const result = await validateImportFile(selectedFile);
            setValidationResult(result);

            if (result.status === "ALL_VALID") {
                setMessage("");
                setConfirmOpen(true);
            } else {
                setMessage("");
                setValidationFailureOpen(true);
            }
        } catch (error) {
            setMessage(getApiErrorMessage(error, "Unable to validate import file."));
        } finally {
            setBusy(false);
        }
    };

    const handleCancelImport = () => {
        setConfirmOpen(false);
    };

    const handleCloseValidationFailure = () => {
        setValidationFailureOpen(false);
    };

    const handleCloseSuccess = () => {
        setSuccessOpen(false);
    };

    const handleConfirmImport = async () => {
        if (!canExecuteImport) {
            return;
        }

        setBusy(true);
        setMessage("");
        setConfirmOpen(false);

        try {
            const result = await importValidatedFile(selectedFile);
            setValidationResult(result.validation);
            if (result.imported) {
                setMessage("");
                setSuccessOpen(true);
            } else {
                setMessage("");
                setValidationFailureOpen(true);
            }
        } catch (error) {
            setMessage(getApiErrorMessage(error, "Unable to import data."));
        } finally {
            setBusy(false);
        }
    };

    const confirmTitle = "Import Data";
    const confirmButtonText = "Import Data";

    return (
        <div className="tracking-main organizations-main administration-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Administration</h2>
                    </div>
                </div>
            </header>

            <div className="settings-page-stack administration-page-stack">
                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>Import Data</h3>
                        </div>
                        <button
                            type="button"
                            className="administration-help-button"
                            onClick={handleOpenHelp}
                            title="Import format and requirements"
                            aria-label="Import format and requirements"
                        >
                            ?
                        </button>
                    </div>

                    <div className="tracking-panel-body">
                        <div className="administration-import-grid">
                            <label className="tracking-modal-field settings-directory-field">
                                <span>Excel File</span>
                                <div className="administration-file-picker">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                        onChange={handleFileChange}
                                        className="administration-file-input"
                                    />
                                    <button
                                        type="button"
                                        className="tracking-save-button"
                                        onClick={handleChooseFile}
                                        disabled={busy}
                                    >
                                        Choose File
                                    </button>
                                </div>
                            </label>

                            <div className="administration-selected-file">
                                <span className="administration-selected-file-label">Selected File:</span>
                                <span className="administration-selected-file-value">{getFileName(selectedFile)}</span>
                            </div>

                            <div className="administration-import-actions">
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleImportData}
                                    disabled={!selectedFile || busy}
                                >
                                    Import Data
                                </button>
                            </div>

                            {message ? (
                                <div className="tracking-status-banner administration-status-banner">{message}</div>
                            ) : null}
                        </div>
                    </div>
                </section>

            </div>

            {validationFailureOpen ? (
                <ValidationFailureDialog
                    validation={validationResult}
                    onClose={handleCloseValidationFailure}
                />
            ) : null}

            {successOpen ? (
                <ImportSuccessDialog onClose={handleCloseSuccess} />
            ) : null}

            {helpOpen ? (
                <ImportHelpDialog
                    schema={importSchema}
                    loading={importSchemaLoading}
                    error={importSchemaError}
                    onClose={handleCloseHelp}
                />
            ) : null}

            {confirmOpen ? (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="administration-import-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="administration-import-title">{confirmTitle}</h3>
                        </div>
                        <div className="tracking-modal-body administration-result-body">
                            <div className="tracking-status-banner administration-status-banner">
                                Validation status: {validationResult?.status ?? "ALL_VALID"}
                            </div>
                            <p className="tracking-modal-text">
                                The selected Excel file contains the following data for import:
                            </p>
                            <ImportCountsSummary validation={validationResult} />
                            <div className="administration-import-warning">
                                <p className="tracking-modal-text">
                                    All existing data for the current user will be permanently deleted and replaced with data from this Excel file.
                                </p>
                                <p className="tracking-modal-text">Do you want to continue?</p>
                            </div>
                        </div>
                        <div className="tracking-modal-actions">
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelImport}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button"
                                onClick={handleConfirmImport}
                            >
                                {confirmButtonText}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
