import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import he from "./he.json";
import en from "./en.json";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "he",
    supportedLngs: ["he", "en"],
    resources: {
      he: { translation: he },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "portal-locale",
    },
  });

const applyDir = (lng: string) => {
  const dir = lng === "he" ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
};
applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export default i18n;
