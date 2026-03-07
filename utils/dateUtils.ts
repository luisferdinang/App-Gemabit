export const getMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const getWeekMonday = (weekId: string) => {
  try {
    const [yearStr, weekStr] = weekId.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);

    // ISO week 1 is the week with the first Thursday of the year
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const isoWeekStart = simple;
    if (dow <= 4)
      isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
      isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());

    isoWeekStart.setHours(0, 0, 0, 0);
    return isoWeekStart;
  } catch (e) {
    return getMonday(new Date());
  }
};

export const getRelativeWeekNumber = (weekId: string, systemStartWeekId: string | null) => {
  if (!systemStartWeekId) return weekId.split('-W')[1];

  try {
    const currentMonday = getWeekMonday(weekId);
    const startMonday = getWeekMonday(systemStartWeekId);

    const diffTime = currentMonday.getTime() - startMonday.getTime();
    const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));

    return Math.max(1, diffWeeks + 1).toString();
  } catch (e) {
    return weekId.split('-W')[1];
  }
};

export const getWeekDateRange = (weekId: string) => {
  try {
    const start = getWeekMonday(weekId);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const startDay = start.getDate();
    const endDay = end.getDate();
    const month = start.toLocaleDateString('es-ES', { month: 'short' });
    
    // Si el mes cambia a mitad de semana
    if (start.getMonth() !== end.getMonth()) {
       const endMonth = end.toLocaleDateString('es-ES', { month: 'short' });
       return `lun ${startDay} ${month} a dom ${endDay} ${endMonth}`;
    }

    return `lun ${startDay} a dom ${endDay} ${month}`;
  } catch (e) {
    return 'Semana Actual';
  }
};