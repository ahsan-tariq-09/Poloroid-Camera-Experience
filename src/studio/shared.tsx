export function Range({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
  onChange,
  onFinish,
  onStart,
  disabled = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  onFinish: () => void;
  onStart?: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <b>
          {Math.round(value)}
          {suffix}
        </b>
      </span>
      <input
        aria-label={label}
        disabled={disabled}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={
          {
            "--progress": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={onStart}
        onKeyDown={(e) => { if (!e.repeat && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) onStart?.(); }}
        onPointerUp={onFinish}
        onPointerCancel={onFinish}
        onKeyUp={onFinish}
        onBlur={onFinish}
      />
    </label>
  );
}