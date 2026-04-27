import CountdownTimerLeads from '@/components/screens/widgets/CountdownTimerLeads'

interface Props {
	params: { id: string }
}

const TimerLeadsPage = ({ params }: Props) => {
	return <CountdownTimerLeads timerId={params.id} />
}

export default TimerLeadsPage
