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
