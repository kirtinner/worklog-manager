import WorklogEntriesTable from "../components/WorklogEntriesTable";
import { worklogEntries } from "../mock/worklogEntries";
import "../styles/timeTracking.css";

function PlaceholderPanel({ title, className = "", children }) {
    return (
        <section className={`tracking-panel ${className}`}>
            <div className="tracking-panel-header">
                <h3>{title}</h3>
            </div>
            <div className="tracking-panel-body">
                {children}
            </div>
        </section>
    );
}

export default function TimeTrackingPage({ onLogout, onNavigate }) {
    return (
        <div className="tracking-shell">
            <aside className="tracking-sidebar">
                <div className="tracking-brand">
                    <div className="tracking-brand-title">Dev Productivity</div>
                    <div className="tracking-brand-subtitle">Time tracking</div>
                </div>

                <PlaceholderPanel title="Calendar" className="tracking-calendar-panel">
                    <div className="tracking-mini-calendar">
                        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                            <div key={`${day}-${index}`} className="tracking-calendar-weekday">
                                {day}
                            </div>
                        ))}

                        {Array.from({ length: 35 }, (_, index) => (
                            <div key={index} className="tracking-calendar-cell">
                                {index > 1 && index < 33 ? index - 1 : ""}
                            </div>
                        ))}
                    </div>
                </PlaceholderPanel>

                <nav className="tracking-nav">
                    <button type="button" onClick={() => onNavigate("dashboard")}>
                        Dashboard
                    </button>
                    <button type="button" onClick={() => onNavigate("calendar")}>
                        Calendar
                    </button>
                    <button type="button" onClick={onLogout}>
                        Logout
                    </button>
                </nav>
            </aside>

            <main className="tracking-main">
                <header className="tracking-topbar">
                    <div>
                        <h2>Time Tracking</h2>
                        <p>Worklog overview and monthly productivity summary</p>
                    </div>
                </header>

                <div className="tracking-content-grid">
                    <PlaceholderPanel title="Worklog Entries" className="tracking-worklog-panel">
                        <WorklogEntriesTable entries={worklogEntries} />
                    </PlaceholderPanel>

                    <PlaceholderPanel title="Task Details" className="tracking-details-panel">
                        <div className="tracking-detail-layout">
                            <div className="tracking-detail-block" />
                            <div className="tracking-comment-lines">
                                <span />
                                <span />
                                <span />
                                <span />
                            </div>
                        </div>
                    </PlaceholderPanel>

                    <PlaceholderPanel title="Monthly Summary" className="tracking-summary-panel">
                        <div className="tracking-summary-grid">
                            <div />
                            <div />
                            <div />
                            <div />
                        </div>
                    </PlaceholderPanel>
                </div>
            </main>
        </div>
    );
}
