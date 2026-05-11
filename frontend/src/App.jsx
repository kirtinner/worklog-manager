import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";
import LoginPage from "./pages/LoginPage";

function App() {
  const [isAuth, setIsAuth] = useState(
      !!localStorage.getItem("token")
  );
  const [page, setPage] = useState("dashboard");

  const logout = () => {
      localStorage.removeItem("token");
      setIsAuth(false);
      setPage("dashboard");
   };

  return (
      <div>
        {isAuth ? (
            page === "calendar" ? (
                <CalendarPage
                    onLogout={logout}
                    onNavigate={setPage}
                />
            ) : (
                <Dashboard
                    onLogout={logout}
                    onNavigate={setPage}
                />
            )
        ) : (
            <LoginPage onLogin={() => setIsAuth(true)} />
        )}
      </div>
  );
}

export default App;
