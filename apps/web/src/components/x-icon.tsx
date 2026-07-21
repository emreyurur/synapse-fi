/** The X (Twitter) logomark — inline so it tints with currentColor (theme-aware), unlike a static image. */
export function XLogo({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 49.8 45" className={className} fill="currentColor" aria-hidden="true">
      <path d="M39.2,0h7.6L30.2,19.1L49.8,45H34.4l-12-15.7L8.6,45H1l17.8-20.4L0,0h15.8l10.9,14.4L39.2,0z M36.5,40.4h4.2L13.5,4.3H8.9 L36.5,40.4z" />
    </svg>
  );
}
