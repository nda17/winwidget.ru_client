import type {
	ManagedWidgetSource,
	WidgetType
} from '@/entities/widget-source'

export const widgetTypeLabel: Record<WidgetType, string> = {
	WHEEL: 'Колесо фортуны',
	QUIZ: 'Квиз',
	CALLBACK: 'Обратный звонок',
	TIMER: 'Таймер',
	STOP_OFFER: 'Стоп-оффер',
	CALCULATOR: 'Калькулятор'
}

export const widgetSourceState = (source: ManagedWidgetSource) => {
	if (source.syncState === 'PENDING')
		return source.enabled ? 'Подключается' : 'Отключается'
	if (source.syncState === 'BLOCKED') return 'Требуется проверка'
	if (source.syncState === 'ERROR') return 'Не удалось синхронизировать'
	return source.enabled ? 'Подключён' : 'Отключён'
}

export const widgetSourceError = (
	code: ManagedWidgetSource['lastErrorCode']
) =>
	({
		DELEGATION_REVOKED:
			'У сотрудника, подключившего виджет, больше нет нужных прав.',
		OWNER_CHANGED: 'Владелец рабочего пространства изменился.',
		SUBSCRIPTION_REQUIRED:
			'Нужна действующая оплаченная подписка Widgets EASY или HARD.',
		WIDGET_UNAVAILABLE:
			'Виджет недоступен, выключен или ещё не опубликован.',
		ALREADY_CONNECTED: 'Виджет уже подключён к другому источнику.',
		CONTROL_CONFLICT: 'Состояние подключения изменилось. Обновите список.',
		DEPENDENCY_UNAVAILABLE: 'Связь между сервисами временно недоступна.',
		INVALID_RESPONSE: 'Не удалось подтвердить ответ сервиса.'
	})[code ?? 'DEPENDENCY_UNAVAILABLE']
