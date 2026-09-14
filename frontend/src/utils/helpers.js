export function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Helper for local date string (YYYY-MM-DD)
export function getLocalDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper for ISO week number
export function getISOWeek(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

let danishHolidaysCache = {};

function getDanishHolidaysMap(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);

  const addDays = (date, days) => {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return res;
  };

  const holidays = [
    { date: new Date(year, 0, 1), name: 'Nytårsdag' },
    { date: addDays(easter, -3), name: 'Skærtorsdag' },
    { date: addDays(easter, -2), name: 'Langfredag' },
    { date: easter, name: 'Påskedag' },
    { date: addDays(easter, 1), name: '2. påskedag' },
    { date: addDays(easter, 39), name: 'Kr. himmelfartsdag' },
    { date: addDays(easter, 49), name: 'Pinsedag' },
    { date: addDays(easter, 50), name: '2. pinsedag' },
    { date: new Date(year, 11, 25), name: 'Juledag' },
    { date: new Date(year, 11, 26), name: '2. juledag' },
  ];
  
  if (year < 2024) {
    holidays.push({ date: addDays(easter, 26), name: 'Store bededag' });
  }

  const holidayMap = {};
  holidays.forEach(h => {
    holidayMap[getLocalDateString(h.date)] = h.name;
  });
  return holidayMap;
}

export function getDanishHoliday(date) {
  const year = date.getFullYear();
  if (!danishHolidaysCache[year]) {
    danishHolidaysCache[year] = getDanishHolidaysMap(year);
  }
  return danishHolidaysCache[year][getLocalDateString(date)];
}
