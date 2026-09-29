/** The app mark: an app window, the same drawing as the PWA icon (scripts/generate-icons.mjs). */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect width="100" height="100" rx="22" fill="#2563eb" />
      <rect x="20" y="24" width="60" height="52" fill="#ffffff" />
      <rect x="20" y="24" width="60" height="12" fill="#1e3a8a" />
      {[47, 56, 65].map((row) => (
        <rect key={row} x="28" y={row - 2} width="44" height="4" fill="#bfdbfe" />
      ))}
    </svg>
  );
}
