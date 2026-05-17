export default function PlaceholderPage({ title, description }) {
    return (
        <div className="app-placeholder-page">
            <section className="tracking-panel app-placeholder-panel">
                <div className="tracking-panel-header">
                    <h3>{title}</h3>
                </div>
                <div className="tracking-panel-body">
                    <p className="app-placeholder-text">{description}</p>
                </div>
            </section>
        </div>
    );
}
