'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

/**
 * Recharts donut. Drop-in for Motive's hand-rolled SVG DonutChart.
 * Renders `value/total` as a ring with a centered percentage label.
 */
export function DonutChart({
  value,
  total,
  label,
  color = 'var(--chart-1)',
  size = 120,
}: {
  value: number
  total: number
  label?: string
  color?: string
  size?: number
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const data = [
    { name: 'value', v: value },
    { name: 'rest', v: Math.max(total - value, 0) },
  ]
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="v"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill="var(--muted)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {pct}%
        </span>
        {label && (
          <span className="text-[11px] text-muted-foreground">{label}</span>
        )}
      </div>
    </div>
  )
}
