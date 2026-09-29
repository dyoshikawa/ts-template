// Shared Tailwind class strings. Controls are sized for thumbs first: 44 px
// tall targets and 16 px text, which also stops iOS from zooming into inputs.

export const inputClass =
  "min-h-11 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-base text-neutral-900 dark:text-neutral-100 [&[type=date]]:py-0 [&:is(select)]:py-0";

export const primaryButtonClass =
  "min-h-11 rounded-lg bg-neutral-900 px-4 py-2 text-base font-medium text-white dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-300 disabled:opacity-50";

export const secondaryButtonClass =
  "min-h-11 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-base text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50";

export const linkButtonClass = "min-h-11 px-2 text-sm underline disabled:opacity-50";

/** For actions that destroy data, e.g. closing the account. */
export const dangerButtonClass =
  "min-h-11 rounded-lg bg-red-700 px-4 py-2 text-base font-medium text-white hover:bg-red-800 dark:bg-red-500 dark:text-neutral-950 dark:hover:bg-red-400 disabled:opacity-50";
