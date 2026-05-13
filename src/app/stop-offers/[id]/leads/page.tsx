import StopOfferLeads from '@/components/screens/widgets/StopOfferLeads'

interface Props {
	params: { id: string }
}

const StopOfferLeadsPage = ({ params }: Props) => {
	return <StopOfferLeads stopOfferId={params.id} />
}

export default StopOfferLeadsPage
