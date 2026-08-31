export type InboxLeadViewModel = {
	id: string
	name: string
	initials: string
	source: string
	context: string
	receivedAt: string
	status: 'Новый' | 'Проверить' | 'Спам'
	responsible: string
	phone: string
	email: string
	message: string
}

export const inboxLeads: InboxLeadViewModel[] = [
	{
		id: 'demo-lead-001',
		name: 'Анна Демова',
		initials: 'АД',
		source: 'Квиз «Подбор услуги»',
		context: 'Ответила на 5 вопросов · demo.example/quiz',
		receivedAt: 'Сегодня, 10:24',
		status: 'Новый',
		responsible: 'Не назначен',
		phone: '+7 (900) 000-00-01',
		email: 'anna@example.test',
		message: 'Хочет получить расчёт и созвониться после 14:00.'
	},
	{
		id: 'demo-lead-002',
		name: 'Максим Тестов',
		initials: 'МТ',
		source: 'Обратный звонок',
		context: 'Заказал звонок · demo.example/pricing',
		receivedAt: 'Сегодня, 09:48',
		status: 'Проверить',
		responsible: 'Ольга · demo',
		phone: '+7 (900) 000-00-02',
		email: 'maxim@example.test',
		message: 'Уточнить количество сотрудников и желаемый срок запуска.'
	},
	{
		id: 'demo-lead-003',
		name: 'Елена Примерова',
		initials: 'ЕП',
		source: 'Калькулятор',
		context: 'Расчёт: 48 000 ₽ · demo.example/calc',
		receivedAt: 'Вчера, 18:17',
		status: 'Новый',
		responsible: 'Иван · demo',
		phone: '+7 (900) 000-00-03',
		email: 'elena@example.test',
		message: 'Просит отправить детализацию демонстрационного расчёта.'
	},
	{
		id: 'demo-lead-004',
		name: 'Тестовый контакт',
		initials: 'ТК',
		source: 'Колесо фортуны',
		context: 'Приз: демо-скидка · demo.example/promo',
		receivedAt: 'Вчера, 16:02',
		status: 'Спам',
		responsible: 'Не назначен',
		phone: '+7 (900) 000-00-04',
		email: 'test@example.test',
		message: 'Синтетическая заявка для проверки состояния «Спам».'
	}
]
