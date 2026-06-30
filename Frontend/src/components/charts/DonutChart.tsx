import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip } from
'recharts';
interface DonutChartProps {
  data: {
    value: number;
    color: string;
    label: string;
  }[];
}
export function DonutChart({ data }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value">
          
          {data.map((entry, index) =>
          <Cell key={`cell-${index}`} fill={entry.color} />
          )}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            fontSize: '12px',
            padding: '8px 12px'
          }}
          formatter={(value: number) => [`${value} agents`, '']} />
        
        <text
          x="50%"
          y="45%"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill="#0F172A">
          
          {total}
        </text>
        <text x="50%" y="58%" textAnchor="middle" fontSize="11" fill="#64748B">
          agents
        </text>
      </PieChart>
    </ResponsiveContainer>);

}