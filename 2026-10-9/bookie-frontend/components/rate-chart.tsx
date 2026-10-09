"use client";

import { useState, type KeyboardEvent } from "react";
import { fmtTimestamp } from "@/lib/format";

export type RatePoint = {
  /** ms epoch */
  t: number;
  /** GBP per Moose Buck */
  rate: number;
};

/* viewBox geometry: the svg scales, strokes don't (non-scaling-stroke) */
const W = 640;
const H = 220;
const M = { left: 48, right: 64, top: 14, bottom: 26 };

function niceStep(span: number): number {
  const raw = span / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (mag * m >= raw) return mag * m;
  }
  return mag * 10;
}

const hourLabel = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function RateChart({ points }: { points: RatePoint[] }) {
  const [active, setActive] = useState<number | null>(null);

  const n = points.length;
  const rates = points.map((p) => p.rate);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);
  const pad = (hi - lo) * 0.1 || 0.1;
  const dMin = lo - pad;
  const dMax = hi + pad;

  const x0 = M.left;
  const x1 = W - M.right;
  const y0 = M.top;
  const y1 = H - M.bottom;

  const x = (i: number) => x0 + (i / (n - 1)) * (x1 - x0);
  const y = (r: number) => y1 - ((r - dMin) / (dMax - dMin)) * (y1 - y0);

  const line = points.map((p, i) => `${x(i)},${y(p.rate)}`).join(" ");
  const area = `${x0},${y1} ${line} ${x1},${y1}`;

  const step = niceStep(dMax - dMin);
  const ticks: number[] = [];
  for (let v = Math.ceil(dMin / step) * step; v <= dMax + 1e-9; v += step) {
    ticks.push(v);
  }

  /* one time label every quarter of the window */
  const xTicks = [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];

  function pick(clientX: number, rect: DOMRect) {
    const fx = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((fx - x0) / (x1 - x0)) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") return setActive(null);
    const from = active ?? n - 1;
    if (e.key === "ArrowLeft") return setActive(Math.max(0, from - 1));
    if (e.key === "ArrowRight") return setActive(Math.min(n - 1, from + 1));
    if (e.key === "Home") return setActive(0);
    if (e.key === "End") return setActive(n - 1);
  }

  const a = active !== null ? points[active] : null;

  return (
    <div
      className="relative outline-none focus-visible:ring-1 focus-visible:ring-ink"
      tabIndex={0}
      role="application"
      aria-label={`Exchange rate over the last day, from ${fmtTimestamp(
        new Date(points[0].t).toISOString(),
      )} to ${fmtTimestamp(
        new Date(points[n - 1].t).toISOString(),
      )}; £${rates[n - 1].toFixed(4)} per Moose Buck now. Left and right arrow keys to read values.`}
      onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKey}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none select-none"
      >
        {/* recessive grid + y labels */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={x0}
              x2={x1}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-rule)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={x0 - 8}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="var(--color-muted)"
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* x labels */}
        {xTicks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={y1 + 16}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize={10}
            fill="var(--color-muted)"
          >
            {hourLabel.format(new Date(points[i].t))}
          </text>
        ))}

        <polygon points={area} fill="var(--color-rule)" opacity={0.4} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* crosshair + marker + end label */}
        {a !== null && (
          <g>
            <line
              x1={x(active!)}
              x2={x(active!)}
              y1={y0}
              y2={y1}
              stroke="var(--color-ink)"
              strokeOpacity={0.35}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(active!)}
              cy={y(a.rate)}
              r={4}
              fill="var(--color-ink)"
              stroke="var(--color-paper)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
        <circle
          cx={x(n - 1)}
          cy={y(rates[n - 1])}
          r={3}
          fill="var(--color-ink)"
          stroke="var(--color-paper)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={x(n - 1) + 8}
          y={y(rates[n - 1])}
          dominantBaseline="middle"
          fontSize={11}
          fill="var(--color-ink)"
        >
          £{rates[n - 1].toFixed(4)}
        </text>
      </svg>

      {a !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full border border-ink bg-paper px-2 py-1 text-right"
          style={{
            left: `${(x(active!) / W) * 100}%`,
            top: `${(y(a.rate) / H) * 100}%`,
            marginTop: -10,
            marginLeft: 0,
          }}
        >
          <span className="amt block text-sm font-medium">£{a.rate.toFixed(4)}</span>
          <span className="block text-[0.65rem] text-muted">
            {fmtTimestamp(new Date(a.t).toISOString())} UTC
          </span>
        </div>
      )}
    </div>
  );
}