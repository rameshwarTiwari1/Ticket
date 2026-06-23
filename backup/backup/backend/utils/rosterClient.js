// =============================================================================
// External shift-roster client.
//
// Talks to the shift-management service
//   GET {ROSTER_API_BASE}/api/sm/team/user-shifts?teamId=&orgId=
// and works out who is on shift RIGHT NOW for a given auto-assign rule.
//
// The roster keys each person by display name, then by a local (IST) day label
// ("Tue Jun 23 2026") whose value holds that day's shift window. We therefore
// compute "today" and "now" in the roster's timezone (default Asia/Kolkata) so
// the server's own timezone is irrelevant.
//
// Every failure path (network, timeout, non-200, bad shape) degrades to an empty
// result and logs — it never throws, so the polling job can't crash on it.
// =============================================================================

const TIMEZONE = process.env.ROSTER_TIMEZONE || 'Asia/Kolkata';
const API_BASE = process.env.ROSTER_API_BASE || 'http://192.168.5.245:3001';
const TIMEOUT_MS = Number(process.env.ROSTER_TIMEOUT_MS) || 8000;

// Build the roster's day-key for `now` in TIMEZONE, e.g. "Tue Jun 23 2026".
// We return both a zero-padded ("Jun 05") and a non-padded ("Jun 5") variant so
// we match whichever format the roster uses.
const dayKeysFor = (now, timeZone) => {
  const part = (opts) =>
    new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).format(now);
  const weekday = part({ weekday: 'short' });
  const month = part({ month: 'short' });
  const year = part({ year: 'numeric' });
  const dayNum = Number(part({ day: 'numeric' })); // 5 or 23
  const padded = String(dayNum).padStart(2, '0');
  return [
    `${weekday} ${month} ${padded} ${year}`,
    `${weekday} ${month} ${dayNum} ${year}`,
  ];
};

// Minutes-since-midnight for `now` in TIMEZONE.
const minutesNow = (now, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  // Intl can emit "24" for midnight in some runtimes — normalise to 0.
  return ((h % 24) * 60) + m;
};

// "10:00:00" / "10:00" → minutes. Returns null for blank/invalid.
const hmsToMinutes = (hms) => {
  if (!hms || typeof hms !== 'string') return null;
  const [h, m] = hms.split(':');
  const hh = Number(h), mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return (hh * 60) + mm;
};

// Is `nowMin` inside [startMin, endMin)? Handles overnight windows (end < start).
const isWithinWindow = (nowMin, startMin, endMin) => {
  if (startMin == null || endMin == null) return false;
  if (startMin === endMin) return false; // zero-length (e.g. WEEK_OFF 00:00–00:00)
  if (startMin < endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin; // wraps past midnight
};

// Decide if a single day-entry means the person is on shift now.
const entryIsOnShiftNow = (entry, nowMin) => {
  if (!entry) return false;
  const dayStatus = String(entry.dayStatus || '').toUpperCase();
  if (dayStatus === 'WEEK_OFF') return false;
  if (!['FULL_DAY', 'HALF_DAY'].includes(dayStatus)) return false;
  if (String(entry.presentyStatus || '').toUpperCase() !== 'P') return false;
  const start = hmsToMinutes(entry.shiftStartTime);
  const end = hmsToMinutes(entry.shiftEndTime);
  return isWithinWindow(nowMin, start, end);
};

// Fetch the raw roster payload for a rule. Returns the `data` object, or null.
const fetchRoster = async (rule) => {
  const url = `${API_BASE}/api/sm/team/user-shifts?teamId=${rule.rosterTeamId}&orgId=${rule.rosterOrgId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.error(`roster: HTTP ${res.status} from ${url}`);
      return null;
    }
    const body = await res.json();
    if (!body || body.success !== true || !body.data || typeof body.data !== 'object') {
      console.error(`roster: unexpected payload from ${url}`);
      return null;
    }
    return body.data;
  } catch (err) {
    console.error(`roster: fetch failed for ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// Main entry. Returns:
//   { onShift: [{ rosterName, userId }], known: [lowercased names], available: bool }
// `known` = every name the roster lists (used to tell roster-managed assignees
// apart from manually-assigned ones). `available=false` means the roster call
// failed — callers should make NO changes (don't treat as "nobody on shift").
const fetchOnShiftUsers = async (rule, now = new Date()) => {
  const data = await fetchRoster(rule);
  if (!data) return { onShift: [], known: [], available: false };

  const keys = dayKeysFor(now, TIMEZONE);
  const nowMin = minutesNow(now, TIMEZONE);
  const onShift = [];
  const known = [];

  for (const [rosterName, byDay] of Object.entries(data)) {
    known.push(rosterName.trim().toLowerCase());
    if (!byDay || typeof byDay !== 'object') continue;
    const entry = byDay[keys[0]] || byDay[keys[1]];
    if (entryIsOnShiftNow(entry, nowMin)) {
      onShift.push({ rosterName: rosterName.trim(), userId: entry.userId });
    }
  }

  return { onShift, known, available: true };
};

module.exports = {
  fetchOnShiftUsers,
  // exported for unit checks
  _internals: { dayKeysFor, minutesNow, hmsToMinutes, isWithinWindow, entryIsOnShiftNow },
};
