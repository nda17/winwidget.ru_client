import { CalculatorPreview } from '@/screens/widget-preview'

interface ICalculatorPreviewPage {
	params: { key: string }
}

const CalculatorPreviewPage = ({ params }: ICalculatorPreviewPage) => (
	<CalculatorPreview widgetKey={params.key} />
)

export default CalculatorPreviewPage
