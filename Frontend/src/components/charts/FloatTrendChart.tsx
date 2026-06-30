import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer } from
'recharts';
interface FloatTrendChartProps {
  data: {
    labels: string[];
    efloat: number[];
    cash: number[];
  };
}
export function FloatTrendChart({ data }: FloatTrendChartProps) {
  const chartData = data.labels.map((label, i) => ({
    name: label,
    'E-float': data.efloat[i],
    Cash: data.cash[i]
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 10,
          left: -20,
          bottom: 5
        }}>
        
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#E2E8F0"
          vertical={false} />
        
        <XAxis
          dataKey="name"
          tick={{
            fontSize: 11,
            fill: '#64748B'
          }}
          axisLine={{
            stroke: '#E2E8F0'
          }}
          tickLine={false} />
        
        <YAxis
          tick={{
            fontSize: 11,
            fill: '#64748B'
          }}
          axisLine={{
            stroke: '#E2E8F0'
          }}
          tickLine={false}
          tickFormatter={(value) =>
          value >= 1000 ? `${Math.round(value / 1000)}K` : value
          } />
        
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            fontSize: '12px',
            padding: '8px 12px'
          }}
          formatter={(value: number) => [
          `D ${value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}`,
          '']
          } />
        
        <Legend
          wrapperStyle={{
            fontSize: '11px',
            paddingTop: '10px'
          }}
          iconType="line" />
        
        <Line
          type="monotone"
          dataKey="E-float"
          stroke="#1565C0"
          strokeWidth={2}
          dot={{
            fill: '#1565C0',
            r: 3
          }}
          activeDot={{
            r: 5
          }} />
        
        <Line
          type="monotone"
          dataKey="Cash"
          stroke="#00897B"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={{
            fill: '#00897B',
            r: 3
          }}
          activeDot={{
            r: 5
          }} />
        
      </LineChart>
    </ResponsiveContainer>);

}