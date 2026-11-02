import { useI18n } from "../i18n/i18n-context";
import { type Language, LANGUAGE_NAMES, LANGUAGES } from "../i18n/language";
import { showSnackbar } from "./snackbar";
import { Emoji } from "./spinner";
import { BUTTON_EMOJI } from "./ui";

/**
 * 「🌐 日本語 / English」: switches the whole app at once, without leaving the
 * screen, and remembers the choice (`setLanguagePreference`). Shown on the
 * account page and in the menu. The switch shows before the server has
 * saved it; a failed save switches back and says so in the snackbar, with a
 * retry.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

  const choose = async (option: Language) => {
    if (await setLanguage(option)) {
      return;
    }
    // Said in the language the page went back to, which `t` still is.
    showSnackbar({
      text: t.language.saveFailed,
      retry: () => {
        void choose(option);
      },
    });
  };

  return (
    <fieldset className={`flex items-center gap-2 ${className}`}>
      <legend className="sr-only">{t.language.label}</legend>
      <span className="text-lg">
        <Emoji>{BUTTON_EMOJI.language}</Emoji>
      </span>
      <div className="flex overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
        {LANGUAGES.map((option) => (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={language === option}
            onClick={() => {
              if (option !== language) {
                void choose(option);
              }
            }}
            className={`min-h-11 px-4 text-sm ${
              language === option
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-white text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {LANGUAGE_NAMES[option]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
