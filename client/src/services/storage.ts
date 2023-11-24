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
export const saveArrayToStorage = (
  key: string,
  value: string[],
  maxSize: number,
) => saveJsonToStorage(key, value.slice(-maxSize));

export const updateArrayInStorage = (key: string, newValue: string) => {
  const oldValues = getJsonFromStorage<string[]>(key) || [];
  const newValues = [...oldValues.filter((v) => v !== newValue), newValue];
  saveArrayToStorage(key, newValues, 10);
};

export const ONBOARDING_DONE_KEY = 'onboarding_done';
export const USER_DATA_FORM = 'user_data_form';
export const THEME = 'theme';
export const STUDIO_GUIDE_DONE = 'studio_guide_done';
export const LANGUAGE_KEY = 'language';
export const RIGHT_SIDEBAR_WIDTH_KEY = 'right_sidebar_width';
export const LEFT_SIDEBAR_WIDTH_KEY = 'left_nav_width_key';
export const LOADING_STEPS_SHOWN_KEY = 'loading_steps_shown';
export const ANSWER_SPEED_KEY = 'answer_speed_key';
export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const USER_FONT_SIZE_KEY = 'user_font_size';
export const PROJECT_KEY = 'project';
export const RECENT_COMMANDS_KEY = 'recent_commands';
