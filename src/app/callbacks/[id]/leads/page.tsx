import CallbackLeads from '@/components/screens/widgets/CallbackLeads'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Заявки на обратный звонок — Winwidget.ru'
}

interface Props {
	params: { id: string }
}

const CallbackLeadsPage = ({ params }: Props) => {
	return <CallbackLeads callbackId={params.id} />
}

export default CallbackLeadsPage
