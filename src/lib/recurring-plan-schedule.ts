// 月頻計畫的首次執行日：起始日已過本月扣款日時，順延到下個月。
export function firstMonthlyRunDate(
  startDate: string,
  dayOfMonth: number,
): string {
  const [year, month, day] = startDate.split("-").map(Number);
  const targetDay = String(dayOfMonth).padStart(2, "0");
  if (day <= dayOfMonth) {
    return `${year}-${String(month).padStart(2, "0")}-${targetDay}`;
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${targetDay}`;
}
