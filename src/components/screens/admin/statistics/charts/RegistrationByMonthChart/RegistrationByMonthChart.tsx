import { useRegistrationsByMonthChart } from '@/components/screens/admin/statistics/charts/RegistrationByMonthChart/useRegistrationByMonthChart';
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader';
import {
	CategoryScale,
	Chart as ChartJS,
	Legend,
	LineElement,
	LinearScale,
	PointElement,
	Tooltip
} from 'chart.js';
import { FC } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Tooltip,
	Legend
);

const RegistrationByMonthChart: FC = () => {
	const { data, isPending } = useRegistrationsByMonthChart();

	return isPending ? (
		<SkeletonLoader count={1} className="w-full h-full" />
	) : data ? (
		<Line
			data={data}
			options={{
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							boxWidth: 12,
							padding: 12,
							font: {
								size: 11
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: 6,
							font: {
								size: 10
							}
						}
					},
					y: {
						ticks: {
							font: {
								size: 10
							}
						}
					}
				}
			}}
		/>
	) : null;
};

export default RegistrationByMonthChart;
