import OnlineConsultantLeads from '@/components/screens/widgets/OnlineConsultantLeads'

interface Props {
	params: { id: string }
}

const OnlineConsultantLeadsPage = ({ params }: Props) => {
	return <OnlineConsultantLeads onlineConsultantId={params.id} />
}

export default OnlineConsultantLeadsPage
