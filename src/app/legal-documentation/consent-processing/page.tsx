import ConsentProcessing from '@/components/screens/legal-documentation/consent-processing/ConsentProcessing'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Согласие на обработку персональных данных',
	description: 'Согласие на обработку персональных данных Winwidget.ru'
}

const ConsentProcessingPage = () => {
	return <ConsentProcessing />
}

export default ConsentProcessingPage
