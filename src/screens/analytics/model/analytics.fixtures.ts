export const metricCards = [
	{
		id: 'new-leads',
		label: 'Новые обращения',
		value: '24',
		change: '+18% к прошлой неделе',
		tone: 'info' as const
	},
	{
		id: 'sla',
		label: 'Принято в SLA',
		value: '87%',
		change: '+6 п.п.',
		tone: 'success' as const
	},
	{
		id: 'next-action',
		label: 'Без следующего шага',
		value: '3',
		change: 'Нужно внимание',
		tone: 'warning' as const
	},
	{
		id: 'overdue',
		label: 'Просроченные задачи',
		value: '1',
		change: '−2 за неделю',
		tone: 'danger' as const
	}
]

export const funnelSteps = [
	{ id: 'lead', label: 'Новые', value: 24, percent: 100 },
	{ id: 'qualified', label: 'Квалифицированы', value: 18, percent: 75 },
	{ id: 'proposal', label: 'Предложение', value: 11, percent: 46 },
	{ id: 'decision', label: 'Решение', value: 7, percent: 29 }
]
