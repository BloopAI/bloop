import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import backend from 'i18next-http-backend';
import en from './locales/en.json';
import ja from './locales/ja.json';
import { getPlainFromStorage, LANGUAGE_KEY } from './services/storage';

// the translations
// (tip move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
  en: {
    translation: en,
  },
  ja: {
    translation: ja,
  },
};

i18n
  .use(backend)
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: getPlainFromStorage(LANGUAGE_KEY) || 'en', // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option
    // saveMissing: true,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    // backend: {
    //   addPath: 'http://localhost:3000/locales/add/{{lng}}/{{ns}}',
    //   crossOrigin: true,
    // },
  });

export default i18n;
