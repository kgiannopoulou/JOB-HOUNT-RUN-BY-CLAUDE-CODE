type BarProps = { label: string; value: number; max: number };

/** Every value is printed beside its bar, so the numbers do not depend on reading the bar. */
export function Bar({ label, value, max }: BarProps) {
  return (
    <li className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <span aria-hidden className="h-2 overflow-hidden rounded-r bg-muted">
        <span
          className="block h-full rounded-r bg-primary"
          style={{ width: `${max === 0 ? 0 : (value / max) * 100}%` }}
        />
      </span>
      <span className="text-right tabular-nums">{value}</span>
    </li>
  );
}
