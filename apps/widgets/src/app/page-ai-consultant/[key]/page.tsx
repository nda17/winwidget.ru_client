import type { Metadata } from 'next'

import { AiConsultantPreview } from '@/screens/widget-preview'

export const metadata: Metadata = {
	robots: {
		index: false,
		follow: false,
		noarchive: true,
		nocache: true
	}
}

interface IAiConsultantPreviewPage {
	params: { key: string }
}

const AiConsultantPreviewPage = ({ params }: IAiConsultantPreviewPage) => (
	<AiConsultantPreview widgetKey={params.key} />
)

export default AiConsultantPreviewPage
