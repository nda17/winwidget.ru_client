import { CountdownTimerLeads } from '@/screens/widget-leads'

interface Props {
	params: { id: string }
}

const TimerLeadsPage = ({ params }: Props) => {
	return <CountdownTimerLeads timerId={params.id} />
}

export default TimerLeadsPage
