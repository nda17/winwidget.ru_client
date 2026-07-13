import WidgetLeads from '@/components/screens/widgets/WidgetLeads'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Заявки калькулятора — Winwidget.ru'
}

interface Props {
	params: { id: string }
}

const CalculatorLeadsPage = ({ params }: Props) => (
	<WidgetLeads source="calculator" calculatorId={params.id} />
)

export default CalculatorLeadsPage
