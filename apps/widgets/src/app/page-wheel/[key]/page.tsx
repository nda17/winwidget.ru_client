import { WheelPreview } from '@/screens/widget-preview'

interface IWheelPreviewPage {
	params: { key: string }
}

const WheelPreviewPage = ({ params }: IWheelPreviewPage) => (
	<WheelPreview widgetKey={params.key} />
)

export default WheelPreviewPage
