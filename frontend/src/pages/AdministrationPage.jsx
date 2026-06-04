import { useEffect, useRef, useState } from "react";
import DirectorySettingField from "../components/DirectorySettingField";
import SettingsResultDialog from "../components/SettingsResultDialog";
import { downloadFullDataExport, getImportSchema, importValidatedFile, validateImportFile } from "../services/administrationService";
import { validateFolder } from "../services/userSettingsService";

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
                        Validation failed. Full data import was stopped. Fix the Excel file and try again.
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
                    <h3 id="administration-import-success-title">Full Data Import completed</h3>
                </div>
                <div className="tracking-modal-body">
                    <p className="tracking-modal-text">Full data import completed successfully.</p>
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
                    <h3 id="administration-help-title">Full Data Import Information</h3>
                </div>
                <div className="tracking-modal-body administration-help-body">
                    {loading ? (
                        <p className="tracking-modal-text">Loading import requirements...</p>
                    ) : error ? (
                        <p className="tracking-modal-text">{error}</p>
                    ) : (
                        <>
                            <section className="administration-help-section">
                                <h4>Full data import warning</h4>
                                <p className="tracking-modal-text">
                                    {schema?.warning ?? "Full data import will replace all current data for the current user account."}
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

export default function AdministrationPage({
    userSettings = {},
    userSettingsLoading = false,
    userSettingsError = "",
    onScheduledExportSettingsChange = async () => userSettings,
    onRunScheduledExportNow = async () => ({ success: false, message: "Run Export Now is unavailable." })
}) {
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
    const [exportBusy, setExportBusy] = useState(false);
    const [scheduledExportEnabled, setScheduledExportEnabled] = useState(Boolean(userSettings.scheduledExportEnabled));
    const [scheduledExportFolder, setScheduledExportFolder] = useState(userSettings.scheduledExportFolder ?? "");
    const [scheduledExportTime, setScheduledExportTime] = useState(userSettings.scheduledExportTime ?? "02:00");
    const [scheduledExportRetentionDays, setScheduledExportRetentionDays] = useState(String(userSettings.scheduledExportRetentionDays ?? 30));
    const [scheduledExportSaving, setScheduledExportSaving] = useState(false);
    const [runNowExecuting, setRunNowExecuting] = useState(false);
    const [resultDialog, setResultDialog] = useState(null);
    const fileInputRef = useRef(null);

    const canExecuteImport = selectedFile
        && validationResult?.status === "ALL_VALID"
        && countTotal(validationResult.counts ?? validationResult.validRowsCount) > 0;

    useEffect(() => {
        setScheduledExportEnabled(Boolean(userSettings.scheduledExportEnabled));
        setScheduledExportFolder(userSettings.scheduledExportFolder ?? "");
        setScheduledExportTime(userSettings.scheduledExportTime ?? "02:00");
        setScheduledExportRetentionDays(String(userSettings.scheduledExportRetentionDays ?? 30));
    }, [
        userSettings.scheduledExportEnabled,
        userSettings.scheduledExportFolder,
        userSettings.scheduledExportTime,
        userSettings.scheduledExportRetentionDays
    ]);

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
            setMessage(getApiErrorMessage(error, "Unable to validate full data import file."));
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
            setMessage(getApiErrorMessage(error, "Unable to complete full data import."));
        } finally {
            setBusy(false);
        }
    };

    const handleFullDataExport = async () => {
        setExportBusy(true);
        setMessage("");

        try {
            const result = await downloadFullDataExport();
            const url = window.URL.createObjectURL(result.blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = result.fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setMessage(getApiErrorMessage(error, "Unable to complete full data export."));
        } finally {
            setExportBusy(false);
        }
    };

    const handleValidateFolder = async () => {
        setResultDialog(null);

        try {
            const result = await validateFolder(scheduledExportFolder);
            setResultDialog({
                ...result,
                title: result.success ? "Folder Validation" : "Folder Validation Failed"
            });
        } catch (error) {
            setResultDialog({
                success: false,
                title: "Folder Validation Failed",
                message: getApiErrorMessage(error, "Export Folder validation failed."),
                technicalDetails: error?.message ?? ""
            });
        }
    };

    const handleClearScheduledExportFolder = () => {
        setScheduledExportFolder("");
    };

    const handleSaveScheduledExportSettings = async () => {
        const parsedRetentionDays = Number(scheduledExportRetentionDays);

        setResultDialog(null);

        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledExportTime)) {
            setResultDialog({ success: false, title: "Scheduled Export Failed", message: "Run Daily At must use HH:mm format." });
            return;
        }

        if (!Number.isInteger(parsedRetentionDays) || parsedRetentionDays < 0) {
            setResultDialog({ success: false, title: "Scheduled Export Failed", message: "Retention Days must be 0 or greater." });
            return;
        }

        setScheduledExportSaving(true);
        try {
            await onScheduledExportSettingsChange({
                scheduledExportEnabled,
                scheduledExportFolder,
                scheduledExportTime,
                scheduledExportRetentionDays: parsedRetentionDays
            });
            setResultDialog({ success: true, title: "Scheduled Full Data Export", message: "Scheduled export settings saved." });
        } catch (error) {
            setResultDialog({
                success: false,
                title: "Scheduled Export Failed",
                message: getApiErrorMessage(error, "Unable to save scheduled export settings."),
                technicalDetails: error?.message ?? ""
            });
        } finally {
            setScheduledExportSaving(false);
        }
    };

    const handleRunExportNow = async () => {
        setResultDialog(null);
        setRunNowExecuting(true);

        try {
            const result = await onRunScheduledExportNow();
            setResultDialog({ ...result, title: result.success ? "Full Data Export" : "Full Data Export failed" });
        } catch (error) {
            setResultDialog({
                success: false,
                title: "Full Data Export failed",
                message: getApiErrorMessage(error, "Unable to run scheduled export."),
                technicalDetails: error?.message ?? ""
            });
        } finally {
            setRunNowExecuting(false);
        }
    };

    const formatDateTime = (value) => {
        if (!value) {
            return "";
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString();
    };

    const confirmTitle = "Full Data Import";
    const confirmButtonText = "Full Data Import";

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
                            <h3>Full Data Import</h3>
                        </div>
                        <button
                            type="button"
                            className="administration-help-button"
                            onClick={handleOpenHelp}
                            title="Full data import format and requirements"
                            aria-label="Full data import format and requirements"
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
                                    Full Data Import
                                </button>
                            </div>

                            {message ? (
                                <div className="tracking-status-banner administration-status-banner">{message}</div>
                            ) : null}
                        </div>
                    </div>
                </section>

                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>Full Data Export</h3>
                        </div>
                    </div>

                    <div className="tracking-panel-body">
                        <div className="administration-import-grid">
                            <p className="tracking-modal-text">
                                Download all current user data as an Excel file compatible with Full Data Import.
                            </p>

                            <div className="administration-import-actions">
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleFullDataExport}
                                    disabled={exportBusy}
                                >
                                    Full Data Export
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>Scheduled Full Data Export</h3>
                        </div>
                        <div className="settings-user-actions">
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleSaveScheduledExportSettings}
                                disabled={userSettingsLoading || scheduledExportSaving}
                            >
                                Save
                            </button>
                            <button
                                type="button"
                                className="tracking-save-button"
                                onClick={handleRunExportNow}
                                disabled={userSettingsLoading || scheduledExportSaving || runNowExecuting}
                            >
                                Run Export Now
                            </button>
                        </div>
                    </div>

                    <div className="tracking-panel-body">
                        <div className="settings-scheduled-grid">
                            <div className="tracking-modal-field settings-checkbox-field">
                                <span></span>
                                <label className="tracking-modal-checkbox-control settings-inline-checkbox-control">
                                    <input
                                        type="checkbox"
                                        checked={scheduledExportEnabled}
                                        onChange={event => setScheduledExportEnabled(event.target.checked)}
                                        disabled={userSettingsLoading || scheduledExportSaving}
                                    />
                                    <span>Enable Scheduled Export</span>
                                </label>
                            </div>

                            <DirectorySettingField
                                label="Export Folder"
                                value={scheduledExportFolder}
                                placeholder="D:/YandexDisk/DevProductivityPlatform/Backups"
                                disabled={userSettingsLoading || scheduledExportSaving}
                                clearLabel="Clear export folder"
                                onChange={setScheduledExportFolder}
                                onValidate={handleValidateFolder}
                                onClear={handleClearScheduledExportFolder}
                            />

                            <label className="tracking-modal-field settings-compact-field">
                                <span>Run Daily At</span>
                                <input
                                    type="time"
                                    value={scheduledExportTime}
                                    onChange={event => setScheduledExportTime(event.target.value)}
                                    disabled={userSettingsLoading || scheduledExportSaving}
                                />
                            </label>

                            <label className="tracking-modal-field settings-compact-field">
                                <span>Retention Days</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={scheduledExportRetentionDays}
                                    onChange={event => setScheduledExportRetentionDays(event.target.value)}
                                    disabled={userSettingsLoading || scheduledExportSaving}
                                />
                            </label>

                            <label className="tracking-modal-field">
                                <span>Last Run</span>
                                <input type="text" value={formatDateTime(userSettings.scheduledExportLastRunAt)} readOnly />
                            </label>

                            <label className="tracking-modal-field">
                                <span>Last Success</span>
                                <input type="text" value={formatDateTime(userSettings.scheduledExportLastSuccessAt)} readOnly />
                            </label>

                            <label className="tracking-modal-field settings-directory-field">
                                <span>Last Error</span>
                                <input type="text" value={userSettings.scheduledExportLastErrorMessage ?? ""} readOnly />
                            </label>

                            {userSettingsError ? (
                                <div className="tracking-modal-error settings-directory-field">User settings: {userSettingsError}</div>
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
                                The selected Excel file contains the following data for full import:
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

            <SettingsResultDialog
                result={resultDialog}
                onClose={() => setResultDialog(null)}
            />
        </div>
    );
}
