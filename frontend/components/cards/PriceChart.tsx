"use client";

import { useMemo, useState } from "react";

type Point = { t: string; v: number };
type Series = { id: string; label: string; color: string; points: Point[] };

const W = 880;
const H = 320;
const PAD = { top: 20, right: 20, bottom: 32, left: 56 };

export default function PriceChart({ series }: { series: Series[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  const visible = useMemo(
    () => series.filter((s) => !hidden.has(s.id) && s.points.length > 0),
    [series, hidden]
  );

  const { minT, maxT, minV, maxV, hasData } = useMemo(() => {
    const allPts = visible.flatMap((s) => s.points);
    if (allPts.length === 0) {
      return { minT: 0, maxT: 1, minV: 0, maxV: 1, hasData: false };
    }
    const times = allPts.map((p) => new Date(p.t).getTime());
    const vals = allPts.map((p) => p.v);
    return {
      minT: Math.min(...times),
      maxT: Math.max(...times),
      minV: Math.min(...vals),
      maxV: Math.max(...vals),
      hasData: true,
    };
  }, [visible]);

  if (!hasData) {
    return (
      <div className="text-sm text-gray-500 border rounded p-6 text-center">
        価格データがまだありません。クロール実行後に表示されます。
      </div>
    );
  }

  const tRange = Math.max(1, maxT - minT);
  const vRange = Math.max(1, maxV - minV);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xOf = (t: number) =>
    PAD.left + ((t - minT) / tRange) * innerW;
  const yOf = (v: number) =>
    PAD.top + innerH - ((v - minV) / vRange) * innerH;

  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Y軸目盛り
  const yTicks = Array.from({ length: 5 }, (_, i) => minV + ((maxV - minV) * i) / 4);

  // ホバー位置から最近傍時刻のポイントを探す
  const hoverPoints = hover
    ? visible
        .map((s) => {
          const p = nearest(s.points, hover.time);
          return p ? { s, p } : null;
        })
        .filter((x): x is { s: Series; p: Point } => !!x)
    : [];

  return (
    <div className="border rounded p-4 bg-white">
      <div className="flex flex-wrap gap-3 mb-2">
        {series.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggle(s.id)}
            className={`text-xs flex items-center gap-1 ${
              hidden.has(s.id) ? "opacity-40" : ""
            }`}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const xPx = ((e.clientX - rect.left) / rect.width) * W;
          if (xPx < PAD.left || xPx > W - PAD.right) {
            setHover(null);
            return;
          }
          const time = minT + ((xPx - PAD.left) / innerW) * tRange;
          setHover({ x: xPx, time });
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* 背景グリッド */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={yOf(v) + 4}
              fontSize={10}
              textAnchor="end"
              fill="#6b7280"
            >
              ¥{Math.round(v).toLocaleString()}
            </text>
          </g>
        ))}

        {/* X軸端ラベル */}
        <text x={PAD.left} y={H - 8} fontSize={10} fill="#6b7280">
          {fmtDate(minT)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          fontSize={10}
          fill="#6b7280"
          textAnchor="end"
        >
          {fmtDate(maxT)}
        </text>

        {/* 各シリーズ */}
        {visible.map((s) => {
          const path = s.points
            .map((p, i) => {
              const x = xOf(new Date(p.t).getTime());
              const y = yOf(p.v);
              return `${i === 0 ? "M" : "L"}${x},${y}`;
            })
            .join(" ");
          return (
            <g key={s.id}>
              <path
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {s.points.map((p, i) => (
                <circle
                  key={i}
                  cx={xOf(new Date(p.t).getTime())}
                  cy={yOf(p.v)}
                  r={2.5}
                  fill={s.color}
                />
              ))}
            </g>
          );
        })}

        {/* ホバーガイド */}
        {hover && hoverPoints.length > 0 && (
          <g>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#9ca3af"
              strokeDasharray="3 3"
            />
            {hoverPoints.map(({ s, p }) => (
              <circle
                key={s.id}
                cx={xOf(new Date(p.t).getTime())}
                cy={yOf(p.v)}
                r={4.5}
                fill="white"
                stroke={s.color}
                strokeWidth={2}
              />
            ))}
          </g>
        )}
      </svg>

      {/* Tooltipっぽいテキスト */}
      {hover && hoverPoints.length > 0 && (
        <div className="mt-2 text-xs text-gray-700">
          <div className="font-bold mb-1">{fmtDateTime(hover.time)}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {hoverPoints.map(({ s, p }) => (
              <span key={s.id} className="inline-flex items-center gap-1">
                <span
                  className="inline-block w-2 h-2 rounded-sm"
                  style={{ background: s.color }}
                />
                {s.label}: ¥{p.v.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function nearest(points: Point[], time: number): Point | null {
  if (points.length === 0) return null;
  let best = points[0];
  let bestDist = Math.abs(new Date(best.t).getTime() - time);
  for (const p of points) {
    const d = Math.abs(new Date(p.t).getTime() - time);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
