import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { CHART_COLORS } from '@/utils/constants';

interface RiskTrendChartProps {
  data: Array<{
    date: string;
    average_risk: number;
    commit_count: number;
  }>;
  className?: string;
}

export function RiskTrendChart({ data, className }: RiskTrendChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    date: format(parseISO(item.date), 'MMM d'),
    risk: item.average_risk * 100,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 25%, 15%)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(220, 25%, 18%)' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(220, 25%, 18%)' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(222, 40%, 10%)',
              border: '1px solid hsl(220, 25%, 18%)',
              borderRadius: '8px',
              color: 'hsl(210, 20%, 92%)',
            }}
            formatter={(value: number, name: string) => [
              name === 'risk' ? `${value.toFixed(1)}%` : value,
              name === 'risk' ? 'Avg Risk' : 'Commits',
            ]}
          />
          <Area
            type="monotone"
            dataKey="risk"
            stroke={CHART_COLORS.primary}
            fillOpacity={1}
            fill="url(#riskGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
