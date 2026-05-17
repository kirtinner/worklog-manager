function formatHours(value) {
    return value.toFixed(2);
}

function formatDateLabel(date) {
    const parsedDate = new Date(`${date}T00:00:00`);
    const day = String(parsedDate.getDate()).padStart(2, "0");
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const year = parsedDate.getFullYear();

    return `${day}.${month}.${year}`;
}

function formatWeekday(date) {
    const weekdayIndex = new Date(`${date}T00:00:00`).getDay();
    const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    return weekdayLabels[weekdayIndex];
}

function buildMonthRows(entries, selectedMonth, selectedYear) {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

    const totalsByDate = entries.reduce((accumulator, entry) => {
        if (!entry.date.startsWith(monthPrefix)) {
            return accumulator;
        }

        const currentTotal = accumulator.get(entry.date) ?? 0;
        const nextHours = Number(entry.hours) || 0;
        accumulator.set(entry.date, currentTotal + nextHours);
        return accumulator;
    }, new Map());

    const rows = Array.from({ length: daysInMonth }, (_, index) => {
        const dayNumber = index + 1;
        const date = `${monthPrefix}-${String(dayNumber).padStart(2, "0")}`;
        const weekdayIndex = new Date(selectedYear, selectedMonth, dayNumber).getDay();
        const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;
        const totalHours = totalsByDate.get(date) ?? 0;

        return {
            date,
            weekday: formatWeekday(date),
            isWeekend,
            totalHours
        };
    });

    const monthTotal = rows.reduce((sum, row) => sum + row.totalHours, 0);

    return { rows, monthTotal };
}

export default function MonthlySummaryTable({ entries, selectedMonth, selectedYear }) {
    const { rows, monthTotal } = buildMonthRows(entries, selectedMonth, selectedYear);

    return (
        <div className="monthly-summary-table-shell">
            <div className="monthly-summary-table-scroll">
                <table className="monthly-summary-table">
                    <colgroup>
                        <col className="monthly-summary-col-date" />
                        <col className="monthly-summary-col-weekday" />
                        <col className="monthly-summary-col-hours" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Weekday</th>
                            <th className="monthly-summary-number-column">Total Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr
                                key={row.date}
                                className={row.isWeekend ? "monthly-summary-weekend-row" : ""}
                            >
                                <td>{formatDateLabel(row.date)}</td>
                                <td>{row.weekday}</td>
                                <td className="monthly-summary-number-column">
                                    {row.totalHours > 0
                                        ? formatHours(row.totalHours)
                                        : row.isWeekend
                                            ? "—"
                                            : ""}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="monthly-summary-footer-row">
                            <td>Total for month</td>
                            <td />
                            <td className="monthly-summary-number-column">{formatHours(monthTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
