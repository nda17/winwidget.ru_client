import { OnlineConsultantLeads } from '@/screens/widget-leads'

interface Props {
	params: { id: string }
}

const OnlineConsultantLeadsPage = ({ params }: Props) => {
	return <OnlineConsultantLeads onlineConsultantId={params.id} />
}

export default OnlineConsultantLeadsPage
