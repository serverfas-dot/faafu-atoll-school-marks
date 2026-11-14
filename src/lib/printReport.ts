export function printReport(filename: string): void {
  const previousTitle = document.title;
  const safeTitle = filename.replace(/[\\/:*?"<>|]+/g, '-').trim();
  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restoreTitle);
  };

  document.title = safeTitle;
  window.addEventListener('afterprint', restoreTitle, { once: true });
  requestAnimationFrame(() => window.print());
}
