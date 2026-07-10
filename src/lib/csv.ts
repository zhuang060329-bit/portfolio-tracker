export function escapeCsvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";

  let cell = String(value);
  if (/^[=+\-@\t]/.test(cell)) cell = `'${cell}`;

  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }

  return cell;
}
