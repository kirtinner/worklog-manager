import { useEffect, useMemo, useState } from "react";
import { exportWorkEffortReportToXlsx } from "../utils/workEffortReportXlsx";
import { getWorkEffortReport } from "../services/reportsService";

const REPORTS = [
    {
        id: "work-effort-period",
        name: "Work Effort Report for Period"
    }
];

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getInitialPeriod() {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
        from: formatDateKey(from),
        to: formatDateKey(today)
    };
}

function getApiErrorMessage(error, fallbackMessage) {
    const responseData = error?.response?.data;
    const message = typeof responseData === "string"
        ? responseData
        : responseData?.message || responseData?.error || (responseData ? JSON.stringify(responseData) : error?.message);
    const status = error?.response?.status;

    if (message && status) {
        return `${fallbackMessage} (${status}: ${message})`;
    }

    if (status) {
        return `${fallbackMessage} (${status})`;
    }

    return message || fallbackMessage;
}

function formatHours(value) {
    return Number(value ?? 0).toFixed(2);
}

export default function ReportsPage({ resetToken = 0 }) {
    const initialPeriod = useMemo(getInitialPeriod, []);
    const [selectedReportId, setSelectedReportId] = useState(REPORTS[0]?.id ?? null);
    const [activeReportId, setActiveReportId] = useState(null);
    const [dateFrom, setDateFrom] = useState(initialPeriod.from);
    const [dateTo, setDateTo] = useState(initialPeriod.to);
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportExporting, setReportExporting] = useState(false);
    const [reportError, setReportError] = useState("");

    const selectedReport = REPORTS.find(report => report.id === selectedReportId) ?? null;
    const activeReport = REPORTS.find(report => report.id === activeReportId) ?? null;
    const orderedReports = useMemo(() => {
        if (!activeReportId) {
            return REPORTS;
        }

        return [
            ...REPORTS.filter(report => report.id === activeReportId),
            ...REPORTS.filter(report => report.id !== activeReportId)
        ];
    }, [activeReportId]);

    useEffect(() => {
        setActiveReportId(null);
        setReportData(null);
        setReportError("");
    }, [resetToken]);

    const openSelectedReport = () => {
        if (!selectedReport) {
            return;
        }

        setActiveReportId(selectedReport.id);
        setReportData(null);
        setReportError("");
    };

    const handleBackToList = () => {
        setActiveReportId(null);
        setReportData(null);
        setReportError("");
    };

    const handleBuildReport = async () => {
        setReportError("");
        setReportData(null);

        if (!dateFrom || !dateTo) {
            setReportError("Report period is required.");
            return;
        }

        if (dateFrom > dateTo) {
            setReportError("Date from must be before or equal to date to.");
            return;
        }

        setReportLoading(true);
        try {
            const nextReport = await getWorkEffortReport(dateFrom, dateTo);
            setReportData(nextReport);
        } catch (error) {
            setReportError(getApiErrorMessage(error, "Unable to build report"));
        } finally {
            setReportLoading(false);
        }
    };

    const handleExportReport = async () => {
        if (!reportData) {
            return;
        }

        setReportExporting(true);
        setReportError("");
        try {
            await exportWorkEffortReportToXlsx(reportData);
        } catch (error) {
            setReportError(getApiErrorMessage(error, "Unable to export report"));
        } finally {
            setReportExporting(false);
        }
    };

    const handleReportsAction = () => {
        if (activeReportId) {
            handleBackToList();
            return;
        }

        openSelectedReport();
    };

    const openReport = (reportId) => {
        setSelectedReportId(reportId);
        setActiveReportId(reportId);
        setReportData(null);
        setReportError("");
    };

    const onDateFromChange = (value) => {
        setDateFrom(value);
        setReportData(null);
    };

    const onDateToChange = (value) => {
        setDateTo(value);
        setReportData(null);
    };

    const renderReportsList = () => (
        <section className="tracking-panel organizations-panel reports-panel reports-list-panel">
            <div className="tracking-panel-header organizations-panel-header">
                <div>
                    <h3>Reports List</h3>
                </div>
                <div className="clients-toolbar">
                    <button
                        type="button"
                        className="tracking-save-button"
                        onClick={handleReportsAction}
                        disabled={!activeReportId && !selectedReport}
                    >
                        {activeReportId ? "Back to Reports List" : "Open"}
                    </button>
                </div>
            </div>

            <div className="tracking-panel-body organizations-panel-body">
                <table className="app-master-data-table organizations-table tasks-table reports-list-table">
                    <colgroup>
                        <col />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Report Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orderedReports.map(report => (
                            <tr
                                key={report.id}
                                className={report.id === selectedReportId ? "organizations-row-selected" : ""}
                                onClick={() => setSelectedReportId(report.id)}
                                onDoubleClick={() => openReport(report.id)}
                            >
                                <td>{report.name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );

    const renderReportParameters = () => (
        <section className="tracking-panel organizations-panel reports-panel reports-parameters-panel">
            <div className="tracking-panel-header organizations-panel-header reports-parameters-header">
                <div className="reports-period-bar">
                    <label className="tracking-modal-field reports-period-field">
                        <span>Date From</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={event => onDateFromChange(event.target.value)}
                            disabled={reportLoading || reportExporting}
                        />
                    </label>
                    <label className="tracking-modal-field reports-period-field">
                        <span>Date To</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={event => onDateToChange(event.target.value)}
                            disabled={reportLoading || reportExporting}
                        />
                    </label>
                    <div className="reports-parameters-actions">
                        <button
                            type="button"
                            className="tracking-save-button reports-build-button"
                            onClick={handleBuildReport}
                            disabled={reportLoading || reportExporting}
                        >
                            Build Report
                        </button>
                        <button
                            type="button"
                            className="tracking-save-button reports-export-button"
                            onClick={handleExportReport}
                            disabled={!reportData || reportLoading || reportExporting}
                        >
                            Export to Excel
                        </button>
                    </div>
                </div>

                {reportError ? (
                    <div className="tracking-modal-error">{reportError}</div>
                ) : null}
            </div>
        </section>
    );

    const renderReportResult = () => {
        if (!reportData) {
            return null;
        }

        return (
            <table className="app-master-data-table organizations-table tasks-table reports-result-table">
                <colgroup>
                    <col className="reports-col-client" />
                    <col className="reports-col-task" />
                    <col className="reports-col-hours" />
                </colgroup>
                <thead>
                    <tr className="reports-result-header-row">
                        <th>Client</th>
                        <th>Task</th>
                        <th className="tasks-number-cell">Hours</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.clients.flatMap(client => [
                        <tr key={`client-${client.clientId}`} className="reports-client-row">
                            <td>{client.clientName}</td>
                            <td></td>
                            <td className="tasks-number-cell">{formatHours(client.totalHours)}</td>
                        </tr>,
                        ...client.tasks.map(task => (
                            <tr key={`task-${client.clientId}-${task.taskId}`}>
                                <td>{client.clientName}</td>
                                <td>{task.taskName}</td>
                                <td className="tasks-number-cell">{formatHours(task.hours)}</td>
                            </tr>
                        ))
                    ])}
                    <tr className="reports-grand-total-row">
                        <td>Grand Total</td>
                        <td></td>
                        <td className="tasks-number-cell">{formatHours(reportData.grandTotalHours)}</td>
                    </tr>
                </tbody>
            </table>
        );
    };

    return (
        <div className="tracking-main organizations-main reports-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Reports</h2>
                    </div>
                </div>
            </header>

            <div className="tracking-content-grid organizations-content-grid reports-content-stack">
                {renderReportsList()}
                {activeReportId ? renderReportParameters() : null}
                {renderReportResult()}
            </div>
        </div>
    );
}
