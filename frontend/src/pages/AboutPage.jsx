const technologyStack = {
    Backend: ["Java 21", "Spring Boot", "Spring Security + JWT", "PostgreSQL", "Apache POI"],
    Frontend: ["React", "Vite", "Axios", "Enterprise-style CSS"],
    Infrastructure: ["Docker Compose", "Nginx", "PostgreSQL"]
};

export default function AboutPage({ aboutInfo = null }) {
    const applicationName = aboutInfo?.applicationName || "Dev Productivity Platform";
    const version = aboutInfo?.version || "";
    const author = aboutInfo?.author || "";
    const license = aboutInfo?.license || "";
    const repository = aboutInfo?.repository || "";

    return (
        <div className="tracking-main organizations-main about-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>About</h2>
                    </div>
                </div>
            </header>

            <div className="settings-page-stack">
                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>{applicationName}</h3>
                        </div>
                    </div>

                    <div className="tracking-panel-body">
                        <dl className="about-definition-list">
                            <div>
                                <dt>Version</dt>
                                <dd>{version ? `v${version}` : ""}</dd>
                            </div>
                            <div>
                                <dt>Author</dt>
                                <dd>{author}</dd>
                            </div>
                            <div>
                                <dt>License</dt>
                                <dd>{license}</dd>
                            </div>
                            <div>
                                <dt>Repository</dt>
                                <dd>
                                    {repository ? (
                                        <a href={repository} target="_blank" rel="noreferrer">
                                            {repository}
                                        </a>
                                    ) : null}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </section>

                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>Technology Stack</h3>
                        </div>
                    </div>

                    <div className="tracking-panel-body">
                        <div className="about-stack-grid">
                            {Object.entries(technologyStack).map(([group, items]) => (
                                <div key={group} className="about-stack-column">
                                    <h4>{group}</h4>
                                    <ul>
                                        {items.map(item => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
