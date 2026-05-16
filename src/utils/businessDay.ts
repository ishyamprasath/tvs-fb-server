export function getBusinessDateKey(date = new Date()) {
  const local = new Date(date);
  const adjusted = new Date(local);

  if (adjusted.getHours() < 9) {
    adjusted.setDate(adjusted.getDate() - 1);
  }

  const year = adjusted.getFullYear();
  const month = String(adjusted.getMonth() + 1).padStart(2, '0');
  const day = String(adjusted.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getNextResetAt(date = new Date()) {
  const next = new Date(date);
  next.setHours(9, 0, 0, 0);

  if (date >= next) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export function getBusinessDateOffset(offset: number, date = new Date()) {
  const base = new Date(date);
  base.setDate(base.getDate() + offset);
  return getBusinessDateKey(base);
}
