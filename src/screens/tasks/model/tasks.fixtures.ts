export type TaskViewModel = {
	id: string
	title: string
	deal: string
	contact: string
	dueLabel: string
	status: 'Просрочено' | 'Сегодня' | 'Запланировано'
	owner: string
}

export const tasks: TaskViewModel[] = [
	{
		id: 'demo-task-001',
		title: 'Отправить демонстрационное предложение',
		deal: 'Подготовка предложения',
		contact: 'Дмитрий Макетов',
		dueLabel: 'Сегодня, 09:30',
		status: 'Просрочено',
		owner: 'Ольга · demo'
	},
	{
		id: 'demo-task-002',
		title: 'Провести первичный звонок',
		deal: 'Запуск демонстрационного проекта',
		contact: 'Анна Демова',
		dueLabel: 'Сегодня, 14:00',
		status: 'Сегодня',
		owner: 'Ольга · demo'
	},
	{
		id: 'demo-task-003',
		title: 'Подтвердить встречу',
		deal: 'Согласование пилота',
		contact: 'Ирина Сценарная',
		dueLabel: 'Пятница, 15:00',
		status: 'Запланировано',
		owner: 'Иван · demo'
	}
]
