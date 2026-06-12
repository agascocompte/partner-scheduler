export interface Shift {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** true when the worker has no shift that day */
  free: boolean;
  /** HH:MM 24h, empty string when free */
  start: string;
  /** HH:MM 24h, empty string when free */
  end: string;
}
