import { useEffect, useState } from "react";
import DirectorySettingField from "../components/DirectorySettingField";
import SoftwareProductsSettingsTable from "../components/SoftwareProductsSettingsTable";
import SettingsResultDialog from "../components/SettingsResultDialog";
import { validateFolder } from "../services/userSettingsService";

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
    currentUser = null,
    userSettings = { currentOrganizationId: null, dailyHoursLimit: 8, reportsSaveDirectory: "" },
    userSettingsLoading = false,
    userSettingsError = "",
    softwareProductsLoading = false,
    softwareProductsError = "",
    onUserSettingsChange = async () => userSettings,
    onChangePassword = async () => currentUser,
    onSoftwareProductsChange = () => {}
}) {
    const [settingsDraftLimit, setSettingsDraftLimit] = useState(String(userSettings.dailyHoursLimit ?? 8));
    const [settingsDraftOrganizationId, setSettingsDraftOrganizationId] = useState(String(userSettings.currentOrganizationId ?? ""));
    const [settingsDraftReportsSaveDirectory, setSettingsDraftReportsSaveDirectory] = useState(userSettings.reportsSaveDirectory ?? "");
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [resultDialog, setResultDialog] = useState(null);

    useEffect(() => {
        setSettingsDraftLimit(String(userSettings.dailyHoursLimit ?? 8));
        setSettingsDraftOrganizationId(String(userSettings.currentOrganizationId ?? ""));
        setSettingsDraftReportsSaveDirectory(userSettings.reportsSaveDirectory ?? "");
    }, [
        userSettings.currentOrganizationId,
        userSettings.dailyHoursLimit,
        userSettings.reportsSaveDirectory
    ]);


    const handleSaveUserSettings = async () => {
        const parsedLimit = Number(settingsDraftLimit);

        setResultDialog(null);

        if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
            setResultDialog({ success: false, title: "User Settings Failed", message: "Daily hours limit must be greater than 0." });
            return;
        }

        setSettingsSaving(true);
        try {
            await onUserSettingsChange({
                currentOrganizationId: settingsDraftOrganizationId ? Number(settingsDraftOrganizationId) : null,
                dailyHoursLimit: parsedLimit,
                reportsSaveDirectory: settingsDraftReportsSaveDirectory
            });
            setResultDialog({ success: true, title: "User Settings", message: "User settings saved." });
        } catch (error) {
            setResultDialog({ success: false, title: "User Settings Failed", message: getApiErrorMessage(error, "Unable to save user settings."), technicalDetails: error?.message ?? "" });
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

    const handleValidateFolder = async (label, path) => {
        setResultDialog(null);

        try {
            const result = await validateFolder(path);
            setResultDialog({
                ...result,
                title: result.success ? "Folder Validation" : "Folder Validation Failed"
            });
        } catch (error) {
            setResultDialog({
                success: false,
                title: "Folder Validation Failed",
                message: getApiErrorMessage(error, `${label} validation failed.`),
                technicalDetails: error?.message ?? ""
            });
        }
    };

    const handleClearReportsSaveDirectory = () => {
        setSettingsDraftReportsSaveDirectory("");
    };

    const handleCancelUserSettings = () => {
        setResultDialog(null);
        setSettingsDraftLimit(String(userSettings.dailyHoursLimit ?? 8));
        setSettingsDraftOrganizationId(String(userSettings.currentOrganizationId ?? ""));
        setSettingsDraftReportsSaveDirectory(userSettings.reportsSaveDirectory ?? "");
    };

    const handleChangePassword = async () => {
        setResultDialog(null);
        setPasswordSaving(true);

        try {
            await onChangePassword({
                currentPassword,
                newPassword,
                confirmNewPassword
            });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
            setResultDialog({ success: true, title: "Account", message: "Password changed successfully." });
        } catch (error) {
            setResultDialog({
                success: false,
                title: "Password Change Failed",
                message: getApiErrorMessage(error, "Unable to change password."),
                technicalDetails: error?.message ?? ""
            });
        } finally {
            setPasswordSaving(false);
        }
    };

    return (
        <div className="tracking-main organizations-main settings-main">
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
                        </div>
                        <div className="settings-user-actions">
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelUserSettings}
                                disabled={userSettingsLoading || settingsSaving}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tracking-save-button"
                                onClick={handleSaveUserSettings}
                                disabled={userSettingsLoading || settingsSaving}
                            >
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="tracking-panel-body">
                        <div className="settings-form-grid">
                            <label className="tracking-modal-field">
                                <span>Daily Hours Limit</span>
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
                                            x
                                        </button>
                                    )}
                                </div>
                            </label>

                            <DirectorySettingField
                                label="Reports Save Directory"
                                value={settingsDraftReportsSaveDirectory}
                                disabled={userSettingsLoading || settingsSaving}
                                clearLabel="Clear reports save directory"
                                onChange={setSettingsDraftReportsSaveDirectory}
                                onValidate={() => handleValidateFolder("Reports Save Directory", settingsDraftReportsSaveDirectory)}
                                onClear={handleClearReportsSaveDirectory}
                            />
                        </div>

                        {userSettingsError ? (
                            <div className="tracking-modal-error">User settings: {userSettingsError}</div>
                        ) : null}
                    </div>
                </section>

                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>Account</h3>
                        </div>
                        <div className="settings-user-actions">
                            <button
                                type="button"
                                className="tracking-save-button"
                                onClick={handleChangePassword}
                                disabled={passwordSaving}
                            >
                                Save Password
                            </button>
                        </div>
                    </div>

                    <div className="tracking-panel-body">
                        <div className="settings-account-summary">
                            <span>Email</span>
                            <strong>{currentUser?.email ?? ""}</strong>
                        </div>

                        <div className="settings-form-grid settings-account-grid">
                            <label className="tracking-modal-field settings-account-current-password">
                                <span>Current Password</span>
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    value={currentPassword}
                                    onChange={event => setCurrentPassword(event.target.value)}
                                    disabled={passwordSaving}
                                />
                            </label>

                            <label className="tracking-modal-field settings-account-new-password">
                                <span>New Password</span>
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    value={newPassword}
                                    onChange={event => setNewPassword(event.target.value)}
                                    disabled={passwordSaving}
                                />
                            </label>

                            <label className="tracking-modal-field settings-account-confirm-password">
                                <span>Confirm New Password</span>
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmNewPassword}
                                    onChange={event => setConfirmNewPassword(event.target.value)}
                                    disabled={passwordSaving}
                                />
                            </label>
                        </div>
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

            <SettingsResultDialog
                result={resultDialog}
                onClose={() => setResultDialog(null)}
            />
        </div>
    );
}











