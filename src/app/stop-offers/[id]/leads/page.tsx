import { StopOfferLeads } from '@/screens/widget-leads'

interface Props {
	params: { id: string }
}

const StopOfferLeadsPage = ({ params }: Props) => {
	return <StopOfferLeads stopOfferId={params.id} />
}

export default StopOfferLeadsPage
