function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function validateWorklogDay(entries, dailyHoursLimit) {
    const rowErrorIds = [];
    const issues = [];
    let totalHours = 0;

    entries.forEach((entry, index) => {
        const hours = toNumber(entry.hours);
        const rowLabel = `Row ${index + 1}`;
        const rowIssues = [];

        if (entry.organizationId == null) {
            rowIssues.push("Organization is required.");
        }

        if (entry.clientId == null) {
            rowIssues.push("Client is required.");
        }

        if (entry.taskId == null) {
            rowIssues.push("Task is required.");
        }

        if (hours == null) {
            rowIssues.push("Hours is required.");
        } else if (hours <= 0) {
            rowIssues.push("Hours must be greater than 0.");
        } else if (hours > dailyHoursLimit) {
            rowIssues.push(`Hours cannot exceed ${dailyHoursLimit}.`);
        }

        if (rowIssues.length > 0) {
            rowErrorIds.push(entry.id);
            rowIssues.forEach(issue => {
                issues.push(`${rowLabel}: ${issue}`);
            });
        }

        if (hours != null && hours > 0) {
            totalHours += hours;
        }
    });

    const hasDailyLimitViolation = totalHours > dailyHoursLimit;

    if (hasDailyLimitViolation) {
        issues.push(`Daily hours exceed the configured ${dailyHoursLimit} hour limit.`);
    }

    return {
        isValid: issues.length === 0,
        issues,
        rowErrorIds,
        totalHours,
        hasDailyLimitViolation
    };
}
