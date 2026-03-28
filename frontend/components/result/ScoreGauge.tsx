"use client";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
}

export default function ScoreGauge({ score, size = "md" }: Props) {
  const percentage = (score / 10) * 100;

  const getColor = (s: number): string => {
    if (s >= 9) return "#16a34a";   // green-600
    if (s >= 7) return "#2563eb";   // blue-600
    if (s >= 5) return "#ca8a04";   // yellow-600
    return "#dc2626";               // red-600
  };

  const color = getColor(score);

  const sizeClasses = {
    sm: "w-12 h-12 text-sm",
    md: "w-16 h-16 text-lg",
    lg: "w-24 h-24 text-2xl",
  };

  const radius = size === "lg" ? 40 : size === "md" ? 26 : 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const viewBox = size === "lg" ? 96 : size === "md" ? 64 : 48;
  const center = viewBox / 2;
  const strokeWidth = size === "lg" ? 6 : 4;

  return (
    <div className={`relative inline-flex items-center justify-center ${sizeClasses[size]}`}>
      <svg
        className="transform -rotate-90"
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBox} ${viewBox}`}
      >
        {/* 背景円 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* スコア円 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span
        className="absolute font-bold"
        style={{ color }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}
