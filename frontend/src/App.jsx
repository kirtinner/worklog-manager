import { useState } from "react";
import AppNavigationShell from "./components/AppNavigationShell";
import ClientsPage from "./pages/ClientsPage";
import LoginPage from "./pages/LoginPage";
import OrganizationsPage from "./pages/OrganizationsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ReportsPage from "./pages/ReportsPage";
import TasksPage from "./pages/TasksPage";
import TimeTrackingPage from "./pages/TimeTrackingPage";

function App() {
    const [isAuth, setIsAuth] = useState(!!localStorage.getItem("token"));
    const [page, setPage] = useState("time-tracking");

    const logout = () => {
        localStorage.removeItem("token");
        setIsAuth(false);
        setPage("time-tracking");
    };

    const renderPage = () => {
        switch (page) {
            case "time-tracking":
                return <TimeTrackingPage />;
            case "reports":
                return <ReportsPage />;
            case "clients":
                return <ClientsPage />;
            case "projects":
                return <ProjectsPage />;
            case "tasks":
                return <TasksPage />;
            case "organizations":
                return <OrganizationsPage />;
            default:
                return <TimeTrackingPage />;
        }
    };

    return (
        <div>
            {isAuth ? (
                <AppNavigationShell activePage={page} onNavigate={setPage} onLogout={logout}>
                    {renderPage()}
                </AppNavigationShell>
            ) : (
                <LoginPage
                    onLogin={() => {
                        setIsAuth(true);
                        setPage("time-tracking");
                    }}
                />
            )}
        </div>
    );
}

export default App;
