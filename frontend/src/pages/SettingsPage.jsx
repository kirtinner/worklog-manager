import { useState } from "react";
import SoftwareProductsSettingsTable from "../components/SoftwareProductsSettingsTable";
import {
    createSoftwareProduct,
    deleteSoftwareProduct,
    updateSoftwareProduct
} from "../services/softwareProductsService";

function getApiErrorMessage(error, fallbackMessage) {
    const responseData = error?.response?.data;
    const message = typeof responseData === "string"
        ? responseData
        : responseData?.message || responseData?.error || (responseData ? JSON.stringify(responseData) : error?.message);
    return message || fallbackMessage;
}

function areSoftwareProductsEqual(left, right) {
    return left.shortName === right.shortName
        && left.fullName === right.fullName;
}

export default function SettingsPage({
    organizations = [],
    softwareProducts = [],
    userSettings = { currentOrganizationId: null, dailyHoursLimit: 8 },
    userSettingsLoading = false,
    userSettingsError = "",
    softwareProductsLoading = false,
    softwareProductsError = "",
    onUserSettingsChange = async () => userSettings,
    onSoftwareProductsChange = () => {}
}) {
    const [settingsDraftLimit, setSettingsDraftLimit] = useState(String(userSettings.dailyHoursLimit ?? 8));
    const [settingsDraftOrganizationId, setSettingsDraftOrganizationId] = useState(String(userSettings.currentOrganizationId ?? ""));
    const [settingsMessage, setSettingsMessage] = useState("");
    const [settingsSaveError, setSettingsSaveError] = useState("");
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [softwareProductsDraft, setSoftwareProductsDraft] = useState(softwareProducts.map(product => ({ ...product })));
    const [softwareProductsSaveError, setSoftwareProductsSaveError] = useState("");
    const [softwareProductsMessage, setSoftwareProductsMessage] = useState("");
    const [softwareProductsSaving, setSoftwareProductsSaving] = useState(false);

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
                dailyHoursLimit: parsedLimit
            });
            setSettingsMessage("User settings saved.");
        } catch (error) {
            setSettingsSaveError(getApiErrorMessage(error, "Unable to save user settings."));
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleApplySoftwareProducts = async () => {
        setSoftwareProductsMessage("");
        setSoftwareProductsSaveError("");
        setSoftwareProductsSaving(true);

        const originalProductsById = new Map(softwareProducts.map(product => [product.id, product]));
        const draftProductsById = new Map(softwareProductsDraft.map(product => [product.id, product]));

        try {
            for (const originalProduct of softwareProducts) {
                if (!draftProductsById.has(originalProduct.id)) {
                    await deleteSoftwareProduct(originalProduct.id);
                }
            }

            const nextSoftwareProducts = [];
            for (const draftProduct of softwareProductsDraft) {
                const originalProduct = originalProductsById.get(draftProduct.id);
                const payload = {
                    shortName: draftProduct.shortName.trim(),
                    fullName: draftProduct.fullName.trim()
                };

                if (!payload.shortName || !payload.fullName) {
                    throw new Error("Software Product shortName and fullName are required.");
                }

                if (originalProduct) {
                    const savedProduct = areSoftwareProductsEqual(draftProduct, originalProduct)
                        ? originalProduct
                        : await updateSoftwareProduct(originalProduct.id, payload);
                    nextSoftwareProducts.push(savedProduct);
                } else {
                    const savedProduct = await createSoftwareProduct(payload);
                    nextSoftwareProducts.push(savedProduct);
                }
            }

            onSoftwareProductsChange(nextSoftwareProducts.map(product => ({ ...product })));
            setSoftwareProductsMessage("Software products saved.");
        } catch (error) {
            setSoftwareProductsSaveError(getApiErrorMessage(error, "Unable to save software products."));
        } finally {
            setSoftwareProductsSaving(false);
        }
    };

    return (
        <div className="tracking-main organizations-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Settings</h2>
                        <p>User preferences and application reference settings</p>
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
                            {softwareProductsSaveError ? (
                                <div className="tracking-modal-error">{softwareProductsSaveError}</div>
                            ) : null}
                            {softwareProductsMessage ? (
                                <div className="tracking-status-banner tracking-status-banner-success settings-inline-status">{softwareProductsMessage}</div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            className="tracking-save-button"
                            onClick={handleApplySoftwareProducts}
                            disabled={softwareProductsLoading || softwareProductsSaving}
                        >
                            Apply
                        </button>
                    </div>
                    <SoftwareProductsSettingsTable
                        softwareProducts={softwareProductsDraft}
                        onSoftwareProductsChange={setSoftwareProductsDraft}
                    />
                </section>
            </div>
        </div>
    );
}
