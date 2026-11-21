import { useI18n } from "../i18n/i18n-context";
import { type Messages } from "../i18n/messages";
import { Emoji } from "./spinner";

// The one おすすめ (Recommended) label of the app (ui-rule 15): where the same
// thing can be done by several means (which service removes a background,
// which model draws), the recommended one carries this label and is listed
// first. Which means is recommended is the owner's call, recorded in the
// docs; labelling it changes nothing that is stored or picked by default.

/** The badge beside the recommended means on a chip, a radio or a button. */
export function RecommendedBadge() {
  const { t } = useI18n();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
      <Emoji>⭐</Emoji>
      {t.common.recommended}
    </span>
  );
}

/** A `<select>` option's text for the recommended means, e.g. 「Remove.bg（おすすめ）」. */
export function recommendedOptionLabel({ label, t }: { label: string; t: Messages }): string {
  return t.common.recommendedOption({ label });
}

/**
 * `items` for display with the recommended one first and the others in their
 * order. A copy: the constant that validation, an API schema or an LLM tool
 * definition reads keeps its own order.
 */
export function recommendedFirst<T>({
  items,
  isRecommended,
}: {
  items: readonly T[];
  isRecommended: (item: T) => boolean;
}): T[] {
  return [...items.filter(isRecommended), ...items.filter((item) => !isRecommended(item))];
}
