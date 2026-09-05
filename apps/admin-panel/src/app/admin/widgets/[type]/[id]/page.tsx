import { WidgetSettings } from '@/screens/widget-settings'
import type { WidgetSettingsType } from '@/screens/widget-settings'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const WIDGET_SETTINGS_TYPES: readonly WidgetSettingsType[] = [
	'wheel',
	'quiz',
	'callback',
	'timer',
	'stop-offer',
	'ai-consultant',
	'calculator'
]

const isWidgetSettingsType = (
	value: string
): value is WidgetSettingsType =>
	WIDGET_SETTINGS_TYPES.includes(value as WidgetSettingsType)

export const metadata: Metadata = {
	title: 'Настройки виджета клиента',
	description: 'Настройка и предпросмотр пользовательского виджета'
}

interface AdminWidgetSettingsPageProps {
	params: {
		type: string
		id: string
	}
}

const AdminWidgetSettingsPage = ({
	params
}: AdminWidgetSettingsPageProps) => {
	if (!isWidgetSettingsType(params.type)) {
		notFound()
	}

	return (
		<WidgetSettings type={params.type} id={params.id} accessMode="admin" />
	)
}

export default AdminWidgetSettingsPage
