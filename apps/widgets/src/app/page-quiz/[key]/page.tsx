import { QuizPreview } from '@/screens/widget-preview'

interface IQuizPreviewPage {
	params: { key: string }
}

const QuizPreviewPage = ({ params }: IQuizPreviewPage) => (
	<QuizPreview widgetKey={params.key} />
)

export default QuizPreviewPage
