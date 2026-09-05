import { StopOfferPreview } from '@/screens/widget-preview'

interface IStopOfferPreviewPage {
	params: { key: string }
}

const StopOfferPreviewPage = ({ params }: IStopOfferPreviewPage) => (
	<StopOfferPreview widgetKey={params.key} />
)

export default StopOfferPreviewPage
