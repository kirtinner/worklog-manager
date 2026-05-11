const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const calendarDays = Array.from({ length: 35 }, (_, index) => {
    const day = index - 1;

    return {
        id: index,
        label: day > 0 && day <= 31 ? day : "",
        isMuted: day <= 0 || day > 31
    };
});

export default function CalendarPage({onLogout, onNavigate}) {
    return (
        <div className="container calendar-container">
            <div className="header">
                <h2>Calendar</h2>

                <div className="actions">
                    <button onClick={() => onNavigate("time-tracking")}>Time Tracking</button>
                    <button onClick={() => onNavigate("dashboard")}>Dashboard</button>
                    <button onClick={onLogout}>Logout</button>
                </div>
            </div>

            <div className="calendar-title">
                <h3>Timesheet Calendar</h3>
                <span>May 2026</span>
            </div>

            <div className="calendar-grid">
                {weekDays.map(day => (
                    <div key={day} className="calendar-weekday">
                        {day}
                    </div>
                ))}

                {calendarDays.map(day => (
                    <div
                        key={day.id}
                        className={`calendar-day${day.isMuted ? " calendar-day-muted" : ""}`}
                    >
                        <span>{day.label}</span>
                        {day.label && <div className="calendar-placeholder">No entries</div>}
                    </div>
                ))}
            </div>
        </div>
    );
}
