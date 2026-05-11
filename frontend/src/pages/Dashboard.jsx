import {useEffect, useState} from "react";
import api from "../api/api";

export default function Dashboard({onLogout, onNavigate}) {
    const [entries, setEntries] = useState([]);

    const [date, setDate] = useState("");
    const [hours, setHours] = useState("");
    const [taskId, setTaskId] = useState("");

    const [editingId, setEditingId] = useState(null);
    const [tasks, setTasks] = useState([]);

    const loadData = async () => {
        const res = await api.get("/time-entries/my");
        setEntries(res.data);
    };

    useEffect(() => {
        api.get("/time-entries/my").then(res => setEntries(res.data));
        api.get("/tasks/my").then(res => {
            console.log("TASKS:", res.data);
            setTasks(res.data);
        });
    }, []);

    const createEntry = async () => {
        if (!date || !hours || !taskId) {
            alert("Fill all fields");
            return;
        }

        await api.post("/time-entries", {
            date,
            hours: Number(hours),
            taskId: Number(taskId),
            comment: "UI entry"
        });

        resetForm();
        loadData();
    };

    const updateEntry = async () => {
        if (!date || !hours || !taskId) {
            alert("Fill all fields");
            return;
        }

        await api.put(`/time-entries/${editingId}`, {
            date,
            hours: Number(hours),
            taskId: Number(taskId),
            comment: "Updated"
        });

        resetForm();
        loadData();
    };

    const deleteEntry = async (id) => {
        await api.delete(`/time-entries/${id}`);
        loadData();
    };

    const startEdit = (entry) => {
        setEditingId(entry.id);
        setDate(entry.date);
        setHours(String(entry.hours)); // 👈 фикс
        setTaskId(String(entry.taskId)); // 👈 фикс
    };

    const resetForm = () => {
        setEditingId(null);
        setDate("");
        setHours("");
        setTaskId("");
    };

    // const taskMap = useMemo(() =>
    //         Object.fromEntries(tasks.map(t => [t.id, t.name])),
    //     [tasks]
    // );

    return (
        <div className="container">

            {/* HEADER */}
            <div className="header">
                <h2>Dev Productivity</h2>
                <div className="actions">
                    <button onClick={() => onNavigate("time-tracking")}>Time Tracking</button>
                    <button onClick={() => onNavigate("calendar")}>Calendar</button>
                    <button onClick={onLogout}>Logout</button>
                </div>
            </div>

            {/* ADD / EDIT FORM */}
            <h3>{editingId ? "Edit Entry" : "Add Entry"}</h3>

            {/* поля */}
            <div className="form-row">
                <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                />

                <input
                    placeholder="Hours"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                />

                <select
                    value={taskId || ""}
                    onChange={e => setTaskId(e.target.value)}
                >
                    <option value="">Select task</option>

                    {tasks.map(task => (
                        <option key={task.id} value={String(task.id)}>
                            {task.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* кнопки */}
            <div className="form-actions">
                {editingId ? (
                    <>
                        <button onClick={updateEntry}>Save</button>
                        <button onClick={resetForm}>Cancel</button>
                    </>
                ) : (
                    <button onClick={createEntry}>Add</button>
                )}
            </div>

            {/* LIST */}
            <h3>My Entries</h3>
            {entries.length === 0 && <div>No entries yet</div>}
            {entries.map(e => (
                <div key={e.id} className="entry">
                    <div>
                        <div>{e.date}</div>
                        <div>
                            {e.hours}h • {e.taskName}
                        </div>
                    </div>

                    <div className="actions">
                        <button onClick={() => startEdit(e)}>Edit</button>
                        <button onClick={() => deleteEntry(e.id)}>Delete</button>
                    </div>
                </div>
            ))}
        </div>
    )
        ;
}
