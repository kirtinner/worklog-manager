import { useEffect, useMemo, useRef, useState } from "react";
import {
    createSoftwareProduct,
    deleteSoftwareProduct,
    updateSoftwareProduct
} from "../services/softwareProductsService";

function createProduct(nextId) {
    return {
        id: nextId,
        shortName: "",
        fullName: ""
    };
}

function validateProduct(product) {
    const issues = [];

    if (!product.shortName.trim()) {
        issues.push("shortName is required.");
    }

    if (!product.fullName.trim()) {
        issues.push("fullName is required.");
    }

    return issues;
}

export default function SoftwareProductsSettingsTable({
    softwareProducts = [],
    onSoftwareProductsChange = () => {}
}) {
    const [selectedSoftwareProductId, setSelectedSoftwareProductId] = useState(softwareProducts[0]?.id ?? null);
    const [editingSoftwareProductId, setEditingSoftwareProductId] = useState(null);
    const [draftProduct, setDraftProduct] = useState(null);
    const [editingOriginalProduct, setEditingOriginalProduct] = useState(null);
    const [editingSoftwareProductIsNew, setEditingSoftwareProductIsNew] = useState(false);
    const [editingFallbackSelectionId, setEditingFallbackSelectionId] = useState(null);
    const [nextId, setNextId] = useState(Math.max(...(softwareProducts.map(product => product.id).concat([300]))) + 1);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [warningDialogOpen, setWarningDialogOpen] = useState(false);
    const [warningMessage, setWarningMessage] = useState("");
    const [saving, setSaving] = useState(false);
    const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
    const [pendingSelectionId, setPendingSelectionId] = useState(null);
    const handleCancelRef = useRef(() => {});

    const productCountLabel = useMemo(
        () => `${softwareProducts.length} product${softwareProducts.length === 1 ? "" : "s"}`,
        [softwareProducts.length]
    );

    const selectedSoftwareProduct = softwareProducts.find(product => product.id === selectedSoftwareProductId) ?? null;
    const isDraftDirty = editingSoftwareProductId != null && (
        editingOriginalProduct == null ||
        draftProduct == null ||
        draftProduct.shortName !== editingOriginalProduct.shortName ||
        draftProduct.fullName !== editingOriginalProduct.fullName
    );

    const closeModals = () => {
        setValidationDialogOpen(false);
        setValidationIssues([]);
        setWarningDialogOpen(false);
        setWarningMessage("");
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
    };

    const beginEdit = (product, fallbackSelectionId = product.id, isNewProduct = false) => {
        setSelectedSoftwareProductId(product.id);
        setEditingSoftwareProductId(product.id);
        setDraftProduct({ ...product });
        setEditingOriginalProduct({ ...product });
        setEditingSoftwareProductIsNew(isNewProduct);
        setEditingFallbackSelectionId(fallbackSelectionId);
        closeModals();
    };

    const resolveSelectionAfterDiscard = () => {
        if (editingFallbackSelectionId != null && softwareProducts.some(product => product.id === editingFallbackSelectionId)) {
            return editingFallbackSelectionId;
        }

        return softwareProducts.find(product => product.id !== editingSoftwareProductId)?.id ?? null;
    };

    const discardCurrentEdit = (nextSelectedId = null) => {
        const currentEditingId = editingSoftwareProductId;

        if (editingSoftwareProductIsNew) {
            onSoftwareProductsChange(currentProducts =>
                currentProducts.filter(product => product.id !== currentEditingId)
            );
        }

        setSelectedSoftwareProductId(nextSelectedId ?? resolveSelectionAfterDiscard());
        setEditingSoftwareProductId(null);
        setDraftProduct(null);
        setEditingOriginalProduct(null);
        setEditingSoftwareProductIsNew(false);
        setEditingFallbackSelectionId(null);
        return !editingSoftwareProductIsNew;
    };

    const commitDraft = async (nextSelectedId = selectedSoftwareProductId) => {
        if (!draftProduct) {
            return false;
        }

        const issues = validateProduct(draftProduct);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setValidationDialogOpen(true);
            return false;
        }

        setSaving(true);
        try {
            const payload = {
                shortName: draftProduct.shortName.trim(),
                fullName: draftProduct.fullName.trim()
            };
            const savedProduct = editingSoftwareProductIsNew
                ? await createSoftwareProduct(payload)
                : await updateSoftwareProduct(draftProduct.id, payload);

            onSoftwareProductsChange(currentProducts =>
                currentProducts.map(product =>
                    product.id === draftProduct.id
                        ? savedProduct
                        : product
                )
            );

            setSelectedSoftwareProductId(savedProduct.id ?? nextSelectedId);
            setEditingSoftwareProductId(null);
            setDraftProduct(null);
            setEditingOriginalProduct(null);
            setEditingSoftwareProductIsNew(false);
            setEditingFallbackSelectionId(null);
            closeModals();
            return true;
        } catch (error) {
            setWarningMessage(
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Unable to save software product."
            );
            setWarningDialogOpen(true);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleAddProduct = () => {
        const nextProduct = createProduct(nextId);

        onSoftwareProductsChange(currentProducts => [...currentProducts, nextProduct]);
        setSelectedSoftwareProductId(nextProduct.id);
        setEditingSoftwareProductId(nextProduct.id);
        setDraftProduct({ ...nextProduct });
        setEditingOriginalProduct(null);
        setEditingSoftwareProductIsNew(true);
        setEditingFallbackSelectionId(selectedSoftwareProductId);
        setNextId(currentId => currentId + 1);
        closeModals();
    };

    const handleEditOrSave = async () => {
        if (editingSoftwareProductId != null) {
            await commitDraft();
            return;
        }

        if (selectedSoftwareProduct) {
            beginEdit(selectedSoftwareProduct);
        }
    };

    const handleRowEditRequest = (product) => {
        if (editingSoftwareProductId != null && product.id !== editingSoftwareProductId) {
            if (isDraftDirty) {
                setPendingSelectionId(product.id);
                setSwitchDialogOpen(true);
                return;
            }

            discardCurrentEdit(product.id);
            beginEdit(product);
            return;
        }

        beginEdit(product);
    };

    const handleCancel = () => {
        if (editingSoftwareProductId == null) {
            return;
        }

        discardCurrentEdit();
        closeModals();
    };

    const handleRowSelect = (product) => {
        if (editingSoftwareProductId != null && product.id !== editingSoftwareProductId) {
            if (!isDraftDirty) {
                discardCurrentEdit(product.id);
                closeModals();
                return;
            }

            setPendingSelectionId(product.id);
            setSwitchDialogOpen(true);
            return;
        }

        setSelectedSoftwareProductId(product.id);
    };

    const handleDraftChange = (field, nextValue) => {
        if (!draftProduct) {
            return;
        }

        setDraftProduct({
            ...draftProduct,
            [field]: nextValue
        });
        closeModals();
    };

    const handleDeleteProduct = async () => {
        if (!selectedSoftwareProduct) {
            return;
        }

        setSaving(true);
        try {
            await deleteSoftwareProduct(selectedSoftwareProduct.id);
            onSoftwareProductsChange(currentProducts =>
                currentProducts.filter(product => product.id !== selectedSoftwareProduct.id)
            );

            if (editingSoftwareProductId === selectedSoftwareProduct.id) {
                setEditingSoftwareProductId(null);
                setDraftProduct(null);
                setEditingOriginalProduct(null);
                setEditingSoftwareProductIsNew(false);
                setEditingFallbackSelectionId(null);
            }

            const remaining = softwareProducts.filter(product => product.id !== selectedSoftwareProduct.id);
            setSelectedSoftwareProductId(remaining[0]?.id ?? null);
            closeModals();
        } catch (error) {
            setWarningMessage(
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Software product is used in the system and cannot be deleted."
            );
            setWarningDialogOpen(true);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveFromSwitchDialog = async () => {
        if (await commitDraft(pendingSelectionId)) {
            setSwitchDialogOpen(false);
            setPendingSelectionId(null);
        }
    };

    const handleDiscardFromSwitchDialog = () => {
        if (editingSoftwareProductId == null) {
            setSwitchDialogOpen(false);
            setPendingSelectionId(null);
            return;
        }

        discardCurrentEdit(pendingSelectionId);
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
    };

    const handleStayEditing = () => {
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
    };

    useEffect(() => {
        handleCancelRef.current = handleCancel;
    });

    useEffect(() => {
        if (editingSoftwareProductId == null || validationDialogOpen || warningDialogOpen || switchDialogOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key !== "Escape") {
                return;
            }

            event.preventDefault();
            handleCancelRef.current();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [editingSoftwareProductId, switchDialogOpen, validationDialogOpen, warningDialogOpen]);

    const renderRow = (product) => {
        const isSelected = product.id === selectedSoftwareProductId;
        const isEditingRow = product.id === editingSoftwareProductId;

        return (
            <tr
                key={product.id}
                className={isSelected ? "organizations-row-selected" : ""}
                onClick={() => handleRowSelect(product)}
                onDoubleClick={() => handleRowEditRequest(product)}
            >
                <td>
                    {isEditingRow ? (
                        <input
                            className="app-master-data-input organizations-input"
                            type="text"
                            value={draftProduct?.shortName ?? ""}
                            onChange={event => handleDraftChange("shortName", event.target.value)}
                            onClick={event => event.stopPropagation()}
                        />
                    ) : (
                        <span className="organizations-readonly-cell">{product.shortName}</span>
                    )}
                </td>
                <td>
                    {isEditingRow ? (
                        <input
                            className="app-master-data-input organizations-input"
                            type="text"
                            value={draftProduct?.fullName ?? ""}
                            onChange={event => handleDraftChange("fullName", event.target.value)}
                            onClick={event => event.stopPropagation()}
                        />
                    ) : (
                        <span className="organizations-readonly-cell">{product.fullName}</span>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <section className="tracking-panel organizations-panel software-products-settings-panel">
            <div className="tracking-panel-header organizations-panel-header">
                <div>
                    <h3>Software Products</h3>
                    <p className="organizations-subtitle">{productCountLabel}</p>
                </div>

                <div className="clients-toolbar">
                    {editingSoftwareProductId != null ? (
                        <>
                            <button type="button" className="tracking-save-button" onClick={handleEditOrSave} disabled={saving}>
                                Save
                            </button>
                            <button type="button" className="tracking-save-button" onClick={handleCancel} disabled={saving}>
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="organizations-toolbar-actions">
                                <button type="button" className="tracking-save-button" onClick={handleAddProduct} disabled={saving}>
                                    Add
                                </button>
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleEditOrSave}
                                    disabled={!selectedSoftwareProduct || saving}
                                >
                                    Edit
                                </button>
                            </div>
                            <button
                                type="button"
                                className="organizations-delete-button organizations-delete-button-separated"
                                onClick={handleDeleteProduct}
                                disabled={!selectedSoftwareProduct || saving}
                            >
                                Delete
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="tracking-panel-body organizations-panel-body">
                <table className="app-master-data-table organizations-table">
                    <colgroup>
                        <col className="organizations-col-short" />
                        <col className="organizations-col-full" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Short Name</th>
                            <th>Full Name</th>
                        </tr>
                    </thead>
                    <tbody>{softwareProducts.map(renderRow)}</tbody>
                </table>
            </div>

            {validationDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="software-products-validation-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="software-products-validation-title">Validation errors</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <ul className="tracking-modal-list">
                                {validationIssues.map((issue, index) => (
                                    <li key={`${issue}-${index}`}>{issue}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={() => setValidationDialogOpen(false)}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {warningDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="software-products-warning-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="software-products-warning-title">Delete not available</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">{warningMessage}</p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={() => setWarningDialogOpen(false)}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {switchDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="software-products-switch-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="software-products-switch-title">Unsaved changes</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">
                                There are unsaved changes for the current software product. What do you want to do?
                            </p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleSaveFromSwitchDialog}>
                                Save changes
                            </button>
                            <button type="button" className="tracking-modal-button" onClick={handleDiscardFromSwitchDialog}>
                                Discard changes
                            </button>
                            <button type="button" className="tracking-modal-button tracking-modal-button-secondary" onClick={handleStayEditing}>
                                Stay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
