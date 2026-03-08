import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

interface RiskRadarChartProps {
  data: {
    correctness: number;
    security: number;
    maintainability: number;
    integration: number;
  };
  className?: string;
}

export function RiskRadarChart({ data, className }: RiskRadarChartProps) {
  const chartData = [
    { category: 'Correctness', value: data.correctness * 100, fullMark: 100 },
    { category: 'Security', value: data.security * 100, fullMark: 100 },
    { category: 'Maintainability', value: data.maintainability * 100, fullMark: 100 },
    { category: 'Integration', value: data.integration * 100, fullMark: 100 },
  ];

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="hsl(220, 25%, 20%)" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 10 }}
            tickCount={5}
          />
          <Radar
            name="Risk Score"
            dataKey="value"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(222, 40%, 10%)',
              border: '1px solid hsl(220, 25%, 18%)',
              borderRadius: '8px',
              color: 'hsl(210, 20%, 92%)',
            }}
            formatter={(value: number) => [`${value.toFixed(0)}%`, 'Risk']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
