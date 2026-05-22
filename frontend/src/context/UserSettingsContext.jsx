import { createContext, useContext } from "react";

export const DEFAULT_USER_SETTINGS = {
    id: null,
    developerId: null,
    currentOrganizationId: null,
    currentOrganizationName: "",
    dailyHoursLimit: 8,
    reportsSaveDirectory: ""
};

export const UserSettingsContext = createContext({
    userSettings: DEFAULT_USER_SETTINGS,
    userSettingsLoading: false,
    userSettingsError: "",
    updateUserSettingsState: async () => DEFAULT_USER_SETTINGS
});

export function useUserSettings() {
    return useContext(UserSettingsContext);
}
