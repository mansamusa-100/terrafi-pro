import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
interface SparklineProps {
  data: number[];
  color: string;
}
export function Sparkline({ data, color }: SparklineProps) {
  const chartData = data.map((value, index) => ({
    index,
    value
  }));
  return (
    <ResponsiveContainer width={80} height={32}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false} />
        
      </LineChart>
    </ResponsiveContainer>);

}