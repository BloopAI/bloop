export const savePlainToStorage = (key: string, value: any) => {
  window.localStorage.setItem(key, value.toString());
};

export const getPlainFromStorage = (key: string) => {
  return window.localStorage.getItem(key);
};

export const saveJsonToStorage = (key: string, value: any) =>
  window.localStorage.setItem(key, JSON.stringify(value));

export const getJsonFromStorage = <T>(key: string): T | null => {
  try {
    return JSON.parse(window.localStorage.getItem(key)!);
  } catch (e) {
    return null;
  }
};

export const CHOSEN_SCAN_FOLDER_KEY = 'chosen_scan_folder';
export const SEARCH_HISTORY_KEY = 'search_history';
export const ONBOARDING_DONE_KEY = 'onboarding_done';
export const IS_ANALYTICS_ALLOWED_KEY = 'is_analytics_allowed';
export const SESSION_ID_KEY = 'session_id';
export const DEVICE_ID = 'device_id';
export const USER_DATA_FORM = 'user_data_form';
export const THEME = 'theme';
export const TABS_KEY = 'tabs';
export const LAST_ACTIVE_TAB_KEY = 'last_active_tab';
export const TABS_HISTORY_KEY = 'tabs_history';
export const STUDIO_GUIDE_DONE = 'studio_guide_done';
export const LANGUAGE_KEY = 'language';
export const RIGHT_SIDEBAR_WIDTH_KEY = 'right_sidebar_width_key';
export const LEFT_SIDEBAR_WIDTH_KEY = 'left_sidebar_width_key';
