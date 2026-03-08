import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

interface RiskBarChartProps {
  data: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  className?: string;
}

export function RiskBarChart({ data, className }: RiskBarChartProps) {
  const chartData = [
    { name: 'Low', value: data.low, color: CHART_COLORS.success },
    { name: 'Medium', value: data.medium, color: CHART_COLORS.warning },
    { name: 'High', value: data.high, color: CHART_COLORS.danger },
    { name: 'Critical', value: data.critical, color: 'hsl(330, 85%, 50%)' },
  ];

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsla(0, 0%, 100%, 1.00)" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'hsla(0, 0%, 100%, 1.00)', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 12 }}
            width={70}
          />
          {
          
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const value = payload[0].value;
                return (
                  <div
                    style={{
                      backgroundColor: 'hsl(222, 40%, 10%)',
                      border: '1px solid hsl(220, 25%, 18%)',
                      borderRadius: '8px',
                      padding: '8px',
                      minWidth: 100,
                    }}
                  >
                    <div style={{ color: '#ffffff', marginBottom: 4 }}>{label}</div>

                    <div style={{ color: 'hsla(0, 0%, 100%, 1.00)' }}>
                      Commits: {value}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
        }
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
