import React from 'react';
import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell } from
'recharts';
interface BarChartProps {
  labels: string[];
  values: number[];
  color?: string;
}
export function BarChart({ labels, values, color = '#1565C0' }: BarChartProps) {
  const data = labels.map((label, i) => ({
    name: label,
    value: values[i]
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <RechartsBar
        data={data}
        margin={{
          top: 10,
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
          tickLine={false} />
        
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            fontSize: '12px',
            padding: '8px 12px'
          }}
          cursor={{
            fill: 'rgba(21, 101, 192, 0.1)'
          }} />
        
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) =>
          <Cell key={`cell-${index}`} fill={color} fillOpacity={0.9} />
          )}
        </Bar>
      </RechartsBar>
    </ResponsiveContainer>);

}