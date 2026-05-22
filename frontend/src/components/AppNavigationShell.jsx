export default function AppNavigationShell({ activePage, onNavigate, onLogout, children }) {
    const mainItems = [
        { key: "time-tracking", label: "Time Tracking" },
        { key: "reports", label: "Reports" }
    ];

    const masterDataItems = [
        { key: "organizations", label: "Organizations" },
        { key: "clients", label: "Clients" },
        { key: "projects", label: "Projects" },
        { key: "tasks", label: "Tasks" }
    ];

    return (
        <div className="app-shell">
            <aside className="app-shell-sidebar">
                <div className="app-shell-brand">
                    <div className="app-shell-brand-title">Dev Productivity</div>
                    <div className="app-shell-brand-subtitle">Enterprise workspace</div>
                </div>

                <nav className="app-shell-nav" aria-label="Primary">
                    <div className="app-shell-nav-section">
                        <div className="app-shell-nav-section-title">Main</div>
                        {mainItems.map(item => (
                            <button
                                key={item.key}
                                type="button"
                                className={[
                                    "app-shell-nav-item",
                                    activePage === item.key ? "app-shell-nav-item-active" : ""
                                ].filter(Boolean).join(" ")}
                                onClick={() => onNavigate(item.key)}
                                aria-current={activePage === item.key ? "page" : undefined}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="app-shell-nav-section">
                        <div className="app-shell-nav-section-title">Master Data</div>
                        {masterDataItems.map(item => (
                            <button
                                key={item.key}
                                type="button"
                                className={[
                                    "app-shell-nav-item",
                                    activePage === item.key ? "app-shell-nav-item-active" : ""
                                ].filter(Boolean).join(" ")}
                                onClick={() => onNavigate(item.key)}
                                aria-current={activePage === item.key ? "page" : undefined}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </nav>

                <div className="app-shell-footer">
                    <button
                        type="button"
                        className={[
                            "app-shell-nav-item",
                            activePage === "settings" ? "app-shell-nav-item-active" : ""
                        ].filter(Boolean).join(" ")}
                        onClick={() => onNavigate("settings")}
                        aria-current={activePage === "settings" ? "page" : undefined}
                    >
                        Settings
                    </button>
                    <button type="button" className="app-shell-logout" onClick={onLogout}>
                        Logout
                    </button>
                </div>
            </aside>

            <main className="app-shell-main">
                {children}
            </main>
        </div>
    );
}
