export function StudentPhoto({
  fullName,
  photoUrl,
  className = 'h-16 w-16',
  textClass = 'text-lg',
}: {
  fullName: string;
  photoUrl?: string | null;
  className?: string;
  textClass?: string;
}) {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 to-sky-100 ring-1 ring-blue-900/10 ${className}`}
      aria-hidden
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className={`font-bold text-blue-800 ${textClass}`}>{initials || '?'}</span>
      )}
    </span>
  );
}
