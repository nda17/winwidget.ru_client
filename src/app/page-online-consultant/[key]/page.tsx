import { OnlineConsultantPreview } from '@/screens/widget-preview'

interface IOnlineConsultantPreviewPage {
	params: { key: string }
}

const OnlineConsultantPreviewPage = ({
	params
}: IOnlineConsultantPreviewPage) => (
	<OnlineConsultantPreview widgetKey={params.key} />
)

export default OnlineConsultantPreviewPage
