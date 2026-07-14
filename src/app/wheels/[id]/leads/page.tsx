import { WidgetLeads } from '@/screens/widget-leads'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Заявки — Winwidget.ru'
}

interface Props {
	params: { id: string }
}

const WidgetLeadsPage = ({ params }: Props) => {
	return <WidgetLeads widgetId={params.id} />
}

export default WidgetLeadsPage
