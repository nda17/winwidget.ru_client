import { TimerPreview } from '@/screens/widget-preview'

interface ITimerPreviewPage {
	params: { key: string }
}

const TimerPreviewPage = ({ params }: ITimerPreviewPage) => (
	<TimerPreview widgetKey={params.key} />
)

export default TimerPreviewPage
