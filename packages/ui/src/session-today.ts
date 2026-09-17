// T-51 — "Today's session": resolve the slot a flat 3+1 plan plays for a given date.
//
// Design §1: variety in the MVP is the *emphasis* of each day (upper / lower / full / stretch).
// A flat 3+1 plan (cycle_weeks=1) has four slots this week; we rotate them by day-of-week so
// `GET /plans/{slug}/session?date=` and the web "Today's session" view agree. Pure: a date
// string + the flattened slot list => the resolved today's slot. No I/O, deterministic.

// A resolved plan slot as flattened by the API's `list_plan_slots_for`-style resolution.
export interface ResolvedSlot {
   slot: number;
   kind: string;              // "active" | "stretch" | "hiit" | "rest"
   label?: string;
   templateSlug: string | null;
   params?: Record<string, unknown>;
  run?: {
     beats?: unknown;
     totalSeconds?: number;
     durationMs?: number;
   } | null;
}

export interface TodaySession {
   date: string;
   dayOfWeek: number;        // 0 = Monday .. 6 = Sunday (ISO)
   slotIndex: number;        // index into the provided slots, or -1 when unresolvable
  slot: ResolvedSlot | null;
  isRest: boolean;
}

// ISO day-of-week (Monday=0..Sunday=6) from a "YYYY-MM-DD" string (UTC, no time zone drift).
export function isoDayOfWeek(dateISO: string): number {
   const d = Date.parse(dateISO.length === 10 ? dateISO + "T00:00:00Z" : dateISO);
   if (Number.isNaN(d)) throw new Error(`bad date: ${dateISO}`);
   const day = new Date(d).getUTCDay(); // 0=Sun..6=Sat
   return (day + 6) % 7;
}

// Map a day-of-week onto a cycle of `count` slots. With 4 slots: Mon->0,Tue->1,Wed->2,Thu->3,
// Fri->0, ... A deterministic rotation that keeps every week identical (cycle_weeks=1).
export function slotIndexForDay(dayOfWeek: number, count: number): number {
   if (count <= 0) return -1;
   return ((dayOfWeek % count) + count) % count;
}

// Resolve today's slot from a flattened slot list for a date (or an explicit slot number).
export function todaySession(
   slots: readonly ResolvedSlot[],
   date: { date?: string; dayOfWeek?: number; slot?: number } = {},
): TodaySession {
   let slotIndex = -1;
   let dayOfWeek = 0;
   let dateOut = date.date ?? new Date().toISOString().slice(0, 10);

   if (date.slot !== undefined && date.slot !== null) {
     // Explicit 1-based slot selection (the "what would I do for slot N" path).
     slotIndex = date.slot - 1;
   } else if (date.date || date.dayOfWeek !== undefined) {
     dayOfWeek = date.dayOfWeek ?? isoDayOfWeek(date.date ?? dateOut);
     slotIndex = slotIndexForDay(dayOfWeek, slots.length);
    } else {
     dayOfWeek = isoDayOfWeek(dateOut);
     slotIndex = slotIndexForDay(dayOfWeek, slots.length);
    }

   const inRange = slotIndex >= 0 && slotIndex < slots.length;
   const slot = inRange ? slots[slotIndex] : null;
   const isRest = slot ? slot.kind === "rest" || slot.templateSlug === null : true;

   return { date: dateOut, dayOfWeek, slotIndex, slot, isRest };
}
