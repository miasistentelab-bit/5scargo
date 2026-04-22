import { semaforo } from "@/lib/scoring";

export function ProgressBar({ value, showLabel = true, height = "h-2.5" }: { value: number; showLabel?: boolean; height?: string }) {
  const sem = semaforo(value);
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className={`relative w-full ${height} rounded-full bg-muted overflow-hidden`}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${v}%`, backgroundColor: sem.bg, boxShadow: `0 0 12px ${sem.bg}40` }} />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{sem.label}</span>
          <span className="font-semibold tabular-nums" style={{ color: sem.bg }}>{v.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
