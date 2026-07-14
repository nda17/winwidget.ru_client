import { CallbackPreview } from '@/screens/widget-preview'

interface ICallbackPreviewPage {
	params: { key: string }
}

const CallbackPreviewPage = ({ params }: ICallbackPreviewPage) => (
	<CallbackPreview widgetKey={params.key} />
)

export default CallbackPreviewPage
