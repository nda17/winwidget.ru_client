import PremiumContent from '@/components/screens/premium-content/PremiumContent'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Премиум-контент',
	description: 'Страница премиум-контента'
}

const PremiumPage = async () => {
	return <PremiumContent />
}

export default PremiumPage
