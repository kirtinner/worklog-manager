import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppNavigationShell from "./components/AppNavigationShell";
import AboutPage from "./pages/AboutPage";
import ClientsPage from "./pages/ClientsPage";
import LoginPage from "./pages/LoginPage";
import AdministrationPage from "./pages/AdministrationPage";
import OrganizationsPage from "./pages/OrganizationsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import TasksPage from "./pages/TasksPage";
import TimeTrackingPage from "./pages/TimeTrackingPage";
import { DEFAULT_USER_SETTINGS, UserSettingsContext } from "./context/UserSettingsContext";
import { getAboutInfo } from "./services/aboutService";
import { getCurrentUser, changePassword as apiChangePassword } from "./services/authService";
import { getOrganizations } from "./services/organizationsService";
import { getSoftwareProducts } from "./services/softwareProductsService";
import {
    getUserSettings,
    runScheduledFullDataExportNow,
    updateGeneralUserSettings as apiUpdateGeneralUserSettings,
    updateScheduledExportSettings as apiUpdateScheduledExportSettings,
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

const VALID_PAGES = new Set([
    "time-tracking",
    "reports",
    "organizations",
    "clients",
    "projects",
    "tasks",
    "settings",
    "administration",
    "about"
]);

function pageToPath(page) {
    if (!VALID_PAGES.has(page)) {
        return "/time-tracking";
    }

    return `/${page}`;
}

function pathToPage(pathname) {
    const normalizedPath = pathname.replace(/^\/+/, "");
    return VALID_PAGES.has(normalizedPath) ? normalizedPath : "time-tracking";
}

function App() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isAuth, setIsAuth] = useState(!!localStorage.getItem("token"));
    const [organizations, setOrganizations] = useState([]);
    const [softwareProducts, setSoftwareProducts] = useState([]);
    const [userSettings, setUserSettings] = useState(DEFAULT_USER_SETTINGS);
    const [userSettingsLoading, setUserSettingsLoading] = useState(false);
    const [userSettingsError, setUserSettingsError] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [aboutInfo, setAboutInfo] = useState(null);
    const [softwareProductsLoading, setSoftwareProductsLoading] = useState(false);
    const [softwareProductsError, setSoftwareProductsError] = useState("");
    const [reportsResetToken, setReportsResetToken] = useState(0);

    const page = pathToPage(location.pathname);
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
                currentUserResult,
                aboutInfoResult,
                organizationsResult,
                softwareProductsResult,
                userSettingsResult
            ] = await Promise.allSettled([
                getCurrentUser(),
                getAboutInfo(),
                getOrganizations(),
                getSoftwareProducts(),
                getUserSettings()
            ]);

            if (!active) {
                return;
            }

            if (currentUserResult.status === "fulfilled") {
                setCurrentUser(currentUserResult.value);
            } else {
                setCurrentUser(null);
            }

            if (aboutInfoResult.status === "fulfilled") {
                setAboutInfo(aboutInfoResult.value);
            } else {
                setAboutInfo(null);
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
            dailyHoursLimit: nextSettings.dailyHoursLimit,
            reportsSaveDirectory: nextSettings.reportsSaveDirectory,
            scheduledExportEnabled: nextSettings.scheduledExportEnabled,
            scheduledExportFolder: nextSettings.scheduledExportFolder,
            scheduledExportTime: nextSettings.scheduledExportTime,
            scheduledExportRetentionDays: nextSettings.scheduledExportRetentionDays
        });

        setUserSettings(savedSettings);
        setUserSettingsError("");
        return savedSettings;
    };

    const handleGeneralUserSettingsChange = async (nextSettings) => {
        const savedSettings = await apiUpdateGeneralUserSettings({
            currentOrganizationId: nextSettings.currentOrganizationId,
            dailyHoursLimit: nextSettings.dailyHoursLimit,
            reportsSaveDirectory: nextSettings.reportsSaveDirectory
        });

        setUserSettings(savedSettings);
        setUserSettingsError("");
        return savedSettings;
    };

    const handleScheduledExportSettingsChange = async (nextSettings) => {
        const savedSettings = await apiUpdateScheduledExportSettings({
            scheduledExportEnabled: nextSettings.scheduledExportEnabled,
            scheduledExportFolder: nextSettings.scheduledExportFolder,
            scheduledExportTime: nextSettings.scheduledExportTime,
            scheduledExportRetentionDays: nextSettings.scheduledExportRetentionDays
        });

        setUserSettings(savedSettings);
        setUserSettingsError("");
        return savedSettings;
    };

    const handleRunScheduledExportNow = async () => {
        const result = await runScheduledFullDataExportNow();
        if (result.settings) {
            setUserSettings(result.settings);
            setUserSettingsError("");
        }
        return result;
    };

    const handleChangePassword = async (payload) => {
        const updatedUser = await apiChangePassword(payload);
        setCurrentUser(updatedUser);
        return updatedUser;
    };

    const handleSoftwareProductsChange = (nextSoftwareProducts) => {
        setSoftwareProducts(nextSoftwareProducts);
        setSoftwareProductsError("");
    };

    const handleOrganizationsChange = (nextOrganizations) => {
        setOrganizations(nextOrganizations);
    };

    const navigateToPage = (nextPage) => {
        if (!VALID_PAGES.has(nextPage)) {
            return;
        }

        if (nextPage === "reports") {
            setReportsResetToken(token => token + 1);
        }
        navigate(pageToPath(nextPage));
    };

    const logout = () => {
        localStorage.removeItem("token");
        setIsAuth(false);
        navigate("/time-tracking", { replace: true });
        setOrganizations([]);
        setSoftwareProducts([]);
        setCurrentUser(null);
        setAboutInfo(null);
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
                return <ReportsPage resetToken={reportsResetToken} />;
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
                return (
                    <OrganizationsPage
                        currentOrganizationId={currentOrganizationId}
                        onOrganizationsChange={handleOrganizationsChange}
                        onCurrentOrganizationChange={async nextCurrentOrganizationId => {
                            await handleGeneralUserSettingsChange({
                                currentOrganizationId: nextCurrentOrganizationId,
                                dailyHoursLimit: userSettings.dailyHoursLimit,
                                reportsSaveDirectory: userSettings.reportsSaveDirectory
                            });
                        }}
                    />
                );
            case "settings":
                return (
                    <SettingsPage
                        key={[
                            userSettings.id ?? "settings",
                            userSettings.currentOrganizationId ?? "no-org",
                            userSettings.dailyHoursLimit ?? "no-limit",
                            userSettings.reportsSaveDirectory ?? "no-reports-dir",
                            softwareProducts.map(product => product.id).join("-")
                        ].join(":")}
                        organizations={organizations}
                        softwareProducts={softwareProducts}
                        userSettings={userSettings}
                        currentUser={currentUser}
                        userSettingsLoading={userSettingsLoading}
                        userSettingsError={userSettingsError}
                        softwareProductsLoading={softwareProductsLoading}
                        softwareProductsError={softwareProductsError}
                        onUserSettingsChange={handleGeneralUserSettingsChange}
                        onChangePassword={handleChangePassword}
                        onSoftwareProductsChange={handleSoftwareProductsChange}
                    />
                );
            case "administration":
                return (
                    <AdministrationPage
                        userSettings={userSettings}
                        userSettingsLoading={userSettingsLoading}
                        userSettingsError={userSettingsError}
                        onScheduledExportSettingsChange={handleScheduledExportSettingsChange}
                        onRunScheduledExportNow={handleRunScheduledExportNow}
                    />
                );
            case "about":
                return <AboutPage aboutInfo={aboutInfo} />;
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
                currentUser={currentUser}
                aboutInfo={aboutInfo}
            >
                {isAuth ? (
                    <Routes>
                        <Route path="/" element={<Navigate to="/time-tracking" replace />} />
                        <Route path="/time-tracking" element={renderPage()} />
                        <Route path="/reports" element={renderPage()} />
                        <Route path="/organizations" element={renderPage()} />
                        <Route path="/clients" element={renderPage()} />
                        <Route path="/projects" element={renderPage()} />
                        <Route path="/tasks" element={renderPage()} />
                        <Route path="/settings" element={renderPage()} />
                        <Route path="/administration" element={renderPage()} />
                        <Route path="/about" element={renderPage()} />
                        <Route path="*" element={<Navigate to="/time-tracking" replace />} />
                    </Routes>
                ) : (
                    <div className="login-empty-workspace" aria-hidden="true" />
                )}
            </AppNavigationShell>
            {!isAuth ? (
                <LoginPage
                    onLogin={() => {
                        setIsAuth(true);
                    }}
                />
            ) : null}
        </UserSettingsContext.Provider>
    );
}

export default App;
