export type DealCardViewModel = {
	id: string
	title: string
	contact: string
	company: string
	amount: string
	nextAction: string
	dueLabel: string
	owner: string
	priority: 'normal' | 'attention' | 'overdue'
}

export type DealColumnViewModel = {
	id: string
	title: string
	summary: string
	items: DealCardViewModel[]
}

export const dealColumns: DealColumnViewModel[] = [
	{
		id: 'new',
		title: 'Новые',
		summary: '3 сделки · 186 000 ₽',
		items: [
			{
				id: 'demo-deal-001',
				title: 'Запуск демонстрационного проекта',
				contact: 'Анна Демова',
				company: 'Demo Studio',
				amount: '78 000 ₽',
				nextAction: 'Первичный звонок',
				dueLabel: 'Сегодня, 14:00',
				owner: 'Ольга · demo',
				priority: 'attention'
			},
			{
				id: 'demo-deal-002',
				title: 'Настройка команды',
				contact: 'Максим Тестов',
				company: 'Example Lab',
				amount: '64 000 ₽',
				nextAction: 'Уточнить требования',
				dueLabel: 'Завтра, 11:30',
				owner: 'Иван · demo',
				priority: 'normal'
			},
			{
				id: 'demo-deal-003',
				title: 'Пилот на один отдел',
				contact: 'Елена Примерова',
				company: 'Тестовая компания',
				amount: '44 000 ₽',
				nextAction: 'Назначить ответственного',
				dueLabel: 'Без срока',
				owner: 'Не назначен',
				priority: 'normal'
			}
		]
	},
	{
		id: 'work',
		title: 'В работе',
		summary: '2 сделки · 212 000 ₽',
		items: [
			{
				id: 'demo-deal-004',
				title: 'Подготовка предложения',
				contact: 'Дмитрий Макетов',
				company: 'Prototype Group',
				amount: '120 000 ₽',
				nextAction: 'Отправить предложение',
				dueLabel: 'Просрочено на 2 часа',
				owner: 'Ольга · demo',
				priority: 'overdue'
			},
			{
				id: 'demo-deal-005',
				title: 'Согласование пилота',
				contact: 'Ирина Сценарная',
				company: 'Flow Demo',
				amount: '92 000 ₽',
				nextAction: 'Встреча в демо-календаре',
				dueLabel: 'Пятница, 15:00',
				owner: 'Иван · demo',
				priority: 'normal'
			}
		]
	},
	{
		id: 'decision',
		title: 'Решение',
		summary: '2 сделки · 310 000 ₽',
		items: [
			{
				id: 'demo-deal-006',
				title: 'Финальное согласование',
				contact: 'Сергей Визуальный',
				company: 'Canvas Example',
				amount: '180 000 ₽',
				nextAction: 'Получить решение',
				dueLabel: 'Сегодня, 17:00',
				owner: 'Ольга · demo',
				priority: 'attention'
			},
			{
				id: 'demo-deal-007',
				title: 'Условия расширения',
				contact: 'Алексей Макетный',
				company: 'Layout Works',
				amount: '130 000 ₽',
				nextAction: 'Зафиксировать результат',
				dueLabel: 'Понедельник, 10:00',
				owner: 'Иван · demo',
				priority: 'normal'
			}
		]
	}
]
