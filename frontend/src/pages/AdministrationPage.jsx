import { useRef, useState } from "react";
import { importValidatedFile, validateImportFile } from "../services/administrationService";

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

function ValidationSummary({ validation }) {
    if (!validation) {
        return null;
    }

    const counts = validation.validRowsCount ?? {};
    const items = [
        ["User Settings", counts.userSettings],
        ["Organizations", counts.organizations],
        ["Clients", counts.clients],
        ["Projects", counts.projects],
        ["Software Products", counts.softwareProducts],
        ["Tasks", counts.tasks],
        ["Time Entries", counts.timeEntries]
    ];

    return (
        <div className="administration-validation">
            <div className="tracking-status-banner administration-status-banner">
                Validation status: {validation.status}
            </div>

            <div className="administration-validation-summary">
                {items.map(([label, value]) => (
                    <div key={label} className="administration-validation-summary-item">
                        <span>{label}</span>
                        <strong>{Number(value ?? 0)}</strong>
                    </div>
                ))}
            </div>

            {validation.errorRowsCount > 0 ? (
                <div className="administration-validation-count">
                    Rows with errors: {validation.errorRowsCount}
                </div>
            ) : null}

            {validation.errors?.length > 0 ? (
                <div className="administration-issues">
                    <h4>Errors</h4>
                    <ul className="tracking-modal-list">
                        {validation.errors.map((issue, index) => (
                            <li key={`error-${index}`}>{formatIssue(issue)}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {validation.warnings?.length > 0 ? (
                <div className="administration-issues">
                    <h4>Warnings</h4>
                    <ul className="tracking-modal-list">
                        {validation.warnings.map((issue, index) => (
                            <li key={`warning-${index}`}>{formatIssue(issue)}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

export default function AdministrationPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [validationResult, setValidationResult] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const fileInputRef = useRef(null);

    const hasValidation = validationResult != null;
    const canImport = selectedFile
        && hasValidation
        && validationResult.status !== "INVALID_NO_IMPORTABLE_DATA"
        && countTotal(validationResult.validRowsCount) > 0;

    const handleChooseFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
        const nextFile = event.target.files?.[0] ?? null;
        setSelectedFile(nextFile);
        setValidationResult(null);
        setMessage("");

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleValidate = async () => {
        if (!selectedFile) {
            return;
        }

        setBusy(true);
        setMessage("");
        setValidationResult(null);

        try {
            const result = await validateImportFile(selectedFile);
            setValidationResult(result);

            if (result.status === "INVALID_NO_IMPORTABLE_DATA") {
                setMessage("The file contains no valid data to import.");
            } else if (result.status === "ALL_VALID") {
                setMessage("All data is valid.");
            } else {
                setMessage("Some rows contain errors. You can import only valid data.");
            }
        } catch (error) {
            setMessage(getApiErrorMessage(error, "Unable to validate import file."));
        } finally {
            setBusy(false);
        }
    };

    const handleOpenConfirm = () => {
        if (canImport) {
            setConfirmOpen(true);
        }
    };

    const handleCancelImport = () => {
        setConfirmOpen(false);
    };

    const handleConfirmImport = async () => {
        if (!canImport) {
            return;
        }

        setBusy(true);
        setMessage("");
        setConfirmOpen(false);

        try {
            const result = await importValidatedFile(selectedFile);
            setValidationResult(result.validation);
            setMessage("Import completed.");
        } catch (error) {
            setMessage(getApiErrorMessage(error, "Unable to import data."));
        } finally {
            setBusy(false);
        }
    };

    const confirmTitle = validationResult?.status === "PARTIALLY_VALID"
        ? "Import Valid Data"
        : "Import Data";
    const confirmText = validationResult?.status === "PARTIALLY_VALID"
        ? "Some rows contain errors. Do you want to import only valid data?"
        : "All existing data for the current user will be permanently deleted and replaced with data from this Excel file. Do you want to continue?";
    const confirmButtonText = validationResult?.status === "PARTIALLY_VALID"
        ? "Import Valid Data"
        : "Import Data";

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
                                    onClick={handleValidate}
                                    disabled={!selectedFile || busy}
                                >
                                    Validate
                                </button>
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleOpenConfirm}
                                    disabled={!canImport || busy}
                                >
                                    {validationResult?.status === "PARTIALLY_VALID" ? "Import Valid Data" : "Import Data"}
                                </button>
                            </div>

                            {message ? (
                                <div className="tracking-status-banner administration-status-banner">{message}</div>
                            ) : null}

                            <ValidationSummary validation={validationResult} />
                        </div>
                    </div>
                </section>

                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>Information</h3>
                        </div>
                    </div>

                    <div className="tracking-panel-body">
                        <div className="administration-info">
                            <p className="app-placeholder-text administration-info-text">
                                The import will replace all current data for your user account:
                            </p>
                            <ul className="administration-info-list">
                                <li>Organizations</li>
                                <li>Clients</li>
                                <li>Projects</li>
                                <li>Software Products</li>
                                <li>Tasks</li>
                                <li>Time Entries</li>
                                <li>User Settings</li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>

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
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">{confirmText}</p>
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
