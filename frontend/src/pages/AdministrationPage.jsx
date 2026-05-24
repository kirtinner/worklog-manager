import { useEffect, useRef, useState } from "react";

function getFileName(file) {
    return file?.name ?? "No file selected";
}

export default function AdministrationPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [importConfirmOpen, setImportConfirmOpen] = useState(false);
    const [importMessage, setImportMessage] = useState("");
    const fileInputRef = useRef(null);
    const messageTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (messageTimerRef.current) {
                window.clearTimeout(messageTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!importMessage) {
            return undefined;
        }

        if (messageTimerRef.current) {
            window.clearTimeout(messageTimerRef.current);
        }

        messageTimerRef.current = window.setTimeout(() => {
            setImportMessage("");
        }, 4000);

        return () => {
            if (messageTimerRef.current) {
                window.clearTimeout(messageTimerRef.current);
            }
        };
    }, [importMessage]);

    const handleChooseFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
        const nextFile = event.target.files?.[0] ?? null;
        setSelectedFile(nextFile);
        setImportMessage("");

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleOpenImportConfirm = () => {
        if (!selectedFile) {
            return;
        }

        setImportMessage("");
        setImportConfirmOpen(true);
    };

    const handleCancelImport = () => {
        setImportConfirmOpen(false);
    };

    const handleConfirmImport = () => {
        setImportConfirmOpen(false);
        setImportMessage("Import backend is not implemented yet.");
    };

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
                                    onClick={handleOpenImportConfirm}
                                    disabled={!selectedFile}
                                >
                                    Import Data
                                </button>
                            </div>

                            {importMessage ? (
                                <div className="tracking-status-banner administration-status-banner">{importMessage}</div>
                            ) : null}
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

            {importConfirmOpen ? (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="administration-import-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="administration-import-title">Import Data</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">
                                All existing data for the current user will be permanently deleted and replaced with data from the selected Excel file.
                            </p>
                            <p className="tracking-modal-text">Do you want to continue?</p>
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
                                Import Data
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
