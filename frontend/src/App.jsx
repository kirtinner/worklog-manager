import { useEffect, useState } from "react";
import AppNavigationShell from "./components/AppNavigationShell";
import ClientsPage from "./pages/ClientsPage";
import LoginPage from "./pages/LoginPage";
import OrganizationsPage from "./pages/OrganizationsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import TasksPage from "./pages/TasksPage";
import TimeTrackingPage from "./pages/TimeTrackingPage";
import { DEFAULT_USER_SETTINGS, UserSettingsContext } from "./context/UserSettingsContext";
import { getOrganizations } from "./services/organizationsService";
import { getSoftwareProducts } from "./services/softwareProductsService";
import {
    getUserSettings,
    updateUserSettings as apiUpdateUserSettings
} from "./services/userSettingsService";

function getApiErrorMessage(error, fallbackMessage) {
    const responseData = error?.response?.data;
    const responseMessage = typeof responseData === "string"
        ? responseData
        : responseData?.message || responseData?.error || (responseData ? JSON.stringify(responseData) : "");
    const status = error?.response?.status;

    if (responseMessage && status) {
        return `${fallbackMessage} (${status}: ${responseMessage})`;
    }

    if (status) {
        return `${fallbackMessage} (${status})`;
    }

    return error?.message ? `${fallbackMessage} (${error.message})` : fallbackMessage;
}

const ACTIVE_PAGE_STORAGE_KEY = "dev-productivity:active-page";
const VALID_PAGES = new Set([
    "time-tracking",
    "reports",
    "organizations",
    "clients",
    "projects",
    "tasks",
    "settings"
]);

function getInitialPage() {
    const storedPage = sessionStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    return VALID_PAGES.has(storedPage) ? storedPage : "time-tracking";
}

function App() {
    const [isAuth, setIsAuth] = useState(!!localStorage.getItem("token"));
    const [page, setPage] = useState(getInitialPage);
    const [organizations, setOrganizations] = useState([]);
    const [softwareProducts, setSoftwareProducts] = useState([]);
    const [userSettings, setUserSettings] = useState(DEFAULT_USER_SETTINGS);
    const [userSettingsLoading, setUserSettingsLoading] = useState(false);
    const [userSettingsError, setUserSettingsError] = useState("");
    const [softwareProductsLoading, setSoftwareProductsLoading] = useState(false);
    const [softwareProductsError, setSoftwareProductsError] = useState("");

    const currentOrganizationId = userSettings.currentOrganizationId;

    useEffect(() => {
        if (!isAuth) {
            return undefined;
        }

        let active = true;

        async function loadInitialData() {
            setUserSettingsLoading(true);
            setSoftwareProductsLoading(true);
            setUserSettingsError("");
            setSoftwareProductsError("");

            const [
                organizationsResult,
                softwareProductsResult,
                userSettingsResult
            ] = await Promise.allSettled([
                getOrganizations(),
                getSoftwareProducts(),
                getUserSettings()
            ]);

            if (!active) {
                return;
            }

            if (organizationsResult.status === "fulfilled") {
                setOrganizations(organizationsResult.value);
            } else {
                setOrganizations([]);
            }

            if (softwareProductsResult.status === "fulfilled") {
                setSoftwareProducts(softwareProductsResult.value);
                setSoftwareProductsError("");
            } else {
                setSoftwareProducts([]);
                setSoftwareProductsError("Unable to load software products.");
            }

            if (userSettingsResult.status === "fulfilled") {
                setUserSettings(userSettingsResult.value);
                setUserSettingsError("");
            } else {
                console.error("[App] Unable to load user settings", userSettingsResult.reason);
                setUserSettings(DEFAULT_USER_SETTINGS);
                setUserSettingsError(getApiErrorMessage(userSettingsResult.reason, "Unable to load user settings."));
            }

            setUserSettingsLoading(false);
            setSoftwareProductsLoading(false);
        }

        loadInitialData();

        return () => {
            active = false;
        };
    }, [isAuth]);

    const handleUserSettingsChange = async (nextSettings) => {
        const savedSettings = await apiUpdateUserSettings({
            currentOrganizationId: nextSettings.currentOrganizationId,
            dailyHoursLimit: nextSettings.dailyHoursLimit
        });

        setUserSettings(savedSettings);
        setUserSettingsError("");
        return savedSettings;
    };

    const handleSoftwareProductsChange = (nextSoftwareProducts) => {
        setSoftwareProducts(nextSoftwareProducts);
        setSoftwareProductsError("");
    };

    const navigateToPage = (nextPage) => {
        if (!VALID_PAGES.has(nextPage)) {
            return;
        }

        sessionStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, nextPage);
        setPage(nextPage);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setIsAuth(false);
        sessionStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, "time-tracking");
        setPage("time-tracking");
        setOrganizations([]);
        setSoftwareProducts([]);
        setUserSettings(DEFAULT_USER_SETTINGS);
        setUserSettingsError("");
        setSoftwareProductsError("");
    };

    const renderPage = () => {
        switch (page) {
            case "time-tracking":
                return (
                    <TimeTrackingPage
                        organizations={organizations}
                        userSettings={userSettings}
                    />
                );
            case "reports":
                return <ReportsPage />;
            case "clients":
                return (
                    <ClientsPage
                        key={currentOrganizationId ?? "clients"}
                        organizations={organizations}
                        currentOrganizationId={currentOrganizationId}
                    />
                );
            case "projects":
                return (
                    <ProjectsPage
                        key={currentOrganizationId ?? "projects"}
                        organizations={organizations}
                        currentOrganizationId={currentOrganizationId}
                    />
                );
            case "tasks":
                return (
                    <TasksPage
                        key={currentOrganizationId ?? "tasks"}
                        organizations={organizations}
                        currentOrganizationId={currentOrganizationId}
                        softwareProducts={softwareProducts}
                    />
                );
            case "organizations":
                return <OrganizationsPage currentOrganizationId={currentOrganizationId} />;
            case "settings":
                return (
                    <SettingsPage
                        key={[
                            userSettings.id ?? "settings",
                            userSettings.currentOrganizationId ?? "no-org",
                            userSettings.dailyHoursLimit ?? "no-limit",
                            softwareProducts.map(product => product.id).join("-")
                        ].join(":")}
                        organizations={organizations}
                        softwareProducts={softwareProducts}
                        userSettings={userSettings}
                        userSettingsLoading={userSettingsLoading}
                        userSettingsError={userSettingsError}
                        softwareProductsLoading={softwareProductsLoading}
                        softwareProductsError={softwareProductsError}
                        onUserSettingsChange={handleUserSettingsChange}
                        onSoftwareProductsChange={handleSoftwareProductsChange}
                    />
                );
            default:
                return (
                    <TimeTrackingPage
                        organizations={organizations}
                        userSettings={userSettings}
                    />
                );
        }
    };

    return (
        <UserSettingsContext.Provider
            value={{
                userSettings,
                userSettingsLoading,
                userSettingsError,
                updateUserSettingsState: handleUserSettingsChange
            }}
        >
            <AppNavigationShell
                activePage={page}
                onNavigate={isAuth ? navigateToPage : () => {}}
                onLogout={isAuth ? logout : () => {}}
            >
                {isAuth ? renderPage() : <div className="login-empty-workspace" aria-hidden="true" />}
            </AppNavigationShell>
            {!isAuth ? (
                <LoginPage
                    onLogin={() => {
                        setIsAuth(true);
                        navigateToPage(getInitialPage());
                    }}
                />
            ) : null}
        </UserSettingsContext.Provider>
    );
}

export default App;
