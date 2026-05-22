import { useEffect, useState } from "react";
import SoftwareProductsSettingsTable from "../components/SoftwareProductsSettingsTable";
import {
    clearStoredReportsSaveDirectoryHandle,
    setStoredReportsSaveDirectoryHandle
} from "../utils/reportExportDirectoryStorage";

function getApiErrorMessage(error, fallbackMessage) {
    const responseData = error?.response?.data;
    const message = typeof responseData === "string"
        ? responseData
        : responseData?.message || responseData?.error || (responseData ? JSON.stringify(responseData) : error?.message);
    return message || fallbackMessage;
}

export default function SettingsPage({
    organizations = [],
    softwareProducts = [],
    userSettings = { currentOrganizationId: null, dailyHoursLimit: 8, reportsSaveDirectory: "" },
    userSettingsLoading = false,
    userSettingsError = "",
    softwareProductsLoading = false,
    softwareProductsError = "",
    onUserSettingsChange = async () => userSettings,
    onSoftwareProductsChange = () => {}
}) {
    const [settingsDraftLimit, setSettingsDraftLimit] = useState(String(userSettings.dailyHoursLimit ?? 8));
    const [settingsDraftOrganizationId, setSettingsDraftOrganizationId] = useState(String(userSettings.currentOrganizationId ?? ""));
    const [settingsDraftReportsSaveDirectory, setSettingsDraftReportsSaveDirectory] = useState(userSettings.reportsSaveDirectory ?? "");
    const [settingsMessage, setSettingsMessage] = useState("");
    const [settingsSaveError, setSettingsSaveError] = useState("");
    const [settingsSaving, setSettingsSaving] = useState(false);

    useEffect(() => {
        setSettingsDraftLimit(String(userSettings.dailyHoursLimit ?? 8));
        setSettingsDraftOrganizationId(String(userSettings.currentOrganizationId ?? ""));
        setSettingsDraftReportsSaveDirectory(userSettings.reportsSaveDirectory ?? "");
    }, [userSettings.currentOrganizationId, userSettings.dailyHoursLimit, userSettings.reportsSaveDirectory]);

    const handleSaveUserSettings = async () => {
        const parsedLimit = Number(settingsDraftLimit);

        setSettingsMessage("");
        setSettingsSaveError("");

        if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
            setSettingsSaveError("Daily hours limit must be greater than 0.");
            return;
        }

        setSettingsSaving(true);
        try {
            await onUserSettingsChange({
                currentOrganizationId: settingsDraftOrganizationId ? Number(settingsDraftOrganizationId) : null,
                dailyHoursLimit: parsedLimit,
                reportsSaveDirectory: settingsDraftReportsSaveDirectory
            });
            setSettingsMessage("User settings saved.");
        } catch (error) {
            setSettingsSaveError(getApiErrorMessage(error, "Unable to save user settings."));
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleSoftwareProductsChange = (nextProductsOrUpdater) => {
        const nextProducts = typeof nextProductsOrUpdater === "function"
            ? nextProductsOrUpdater(softwareProducts)
            : nextProductsOrUpdater;
        onSoftwareProductsChange(nextProducts.map(product => ({ ...product })));
    };

    const handleChooseReportsSaveDirectory = async () => {
        setSettingsMessage("");
        setSettingsSaveError("");

        if (!window.showDirectoryPicker) {
            setSettingsSaveError("This browser does not support directory selection.");
            return;
        }

        try {
            const directoryHandle = await window.showDirectoryPicker({
                id: "reports-save-directory",
                mode: "readwrite"
            });

            setSettingsDraftReportsSaveDirectory(directoryHandle.name ?? "");
            await setStoredReportsSaveDirectoryHandle(directoryHandle);
        } catch (error) {
            if (error?.name !== "AbortError") {
                setSettingsSaveError(getApiErrorMessage(error, "Unable to select reports save directory."));
            }
        }
    };

    const handleClearReportsSaveDirectory = async () => {
        setSettingsDraftReportsSaveDirectory("");
        await clearStoredReportsSaveDirectoryHandle();
    };

    return (
        <div className="tracking-main organizations-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Settings</h2>
                    </div>
                </div>
            </header>

            <div className="settings-page-stack">
                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>User Settings</h3>
                            <p className="organizations-subtitle">Current user context</p>
                        </div>
                        <button
                            type="button"
                            className="tracking-save-button"
                            onClick={handleSaveUserSettings}
                            disabled={userSettingsLoading || settingsSaving}
                        >
                            Save
                        </button>
                    </div>

                    <div className="tracking-panel-body">
                        <div className="settings-form-grid">
                            <label className="tracking-modal-field">
                                <span>Daily hours limit</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    value={settingsDraftLimit}
                                    onChange={event => setSettingsDraftLimit(event.target.value)}
                                    disabled={userSettingsLoading || settingsSaving}
                                />
                            </label>

                            <label className="tracking-modal-field">
                                <span>Current Organization</span>
                                <div className="selector-clear-control">
                                    <select
                                        value={settingsDraftOrganizationId}
                                        onChange={event => setSettingsDraftOrganizationId(event.target.value)}
                                        disabled={userSettingsLoading || settingsSaving}
                                    >
                                        <option value=""></option>
                                        {organizations.map(organization => (
                                            <option key={organization.id} value={String(organization.id)}>
                                                {organization.shortName}
                                            </option>
                                        ))}
                                    </select>
                                    {settingsDraftOrganizationId !== "" && (
                                        <button type="button" className="selector-clear-button" onClick={() => setSettingsDraftOrganizationId("")} aria-label="Clear current organization">
                                            ×
                                        </button>
                                    )}
                                </div>
                            </label>

                            <label className="tracking-modal-field settings-directory-field">
                                <span>Reports Save Directory</span>
                                <div className="settings-directory-control">
                                    <input
                                        type="text"
                                        value={settingsDraftReportsSaveDirectory}
                                        placeholder="No directory selected"
                                        readOnly
                                    />
                                    <button type="button" className="tracking-save-button" onClick={handleChooseReportsSaveDirectory}>
                                        Choose
                                    </button>
                                    <button
                                        type="button"
                                        className="selector-clear-button settings-directory-clear-button"
                                        onClick={handleClearReportsSaveDirectory}
                                        aria-label="Clear reports save directory"
                                        disabled={!settingsDraftReportsSaveDirectory}
                                    >
                                        ×
                                    </button>
                                </div>
                            </label>
                        </div>

                        {userSettingsError ? (
                            <div className="tracking-modal-error">User settings: {userSettingsError}</div>
                        ) : null}
                        {settingsSaveError ? (
                            <div className="tracking-modal-error">{settingsSaveError}</div>
                        ) : null}
                        {settingsMessage ? (
                            <div className="tracking-status-banner tracking-status-banner-success settings-inline-status">{settingsMessage}</div>
                        ) : null}
                    </div>
                </section>

                <section className="settings-section-shell">
                    <div className="settings-section-actions">
                        <div>
                            {softwareProductsError ? (
                                <div className="tracking-modal-error">Software products: {softwareProductsError}</div>
                            ) : null}
                        </div>
                    </div>
                    <SoftwareProductsSettingsTable
                        softwareProducts={softwareProducts}
                        onSoftwareProductsChange={handleSoftwareProductsChange}
                    />
                </section>
            </div>
        </div>
    );
}
