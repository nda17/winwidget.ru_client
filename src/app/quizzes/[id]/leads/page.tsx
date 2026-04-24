import QuizLeads from '@/components/screens/widgets/QuizLeads'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Заявки квиза — Winwidget.ru'
}

interface Props {
	params: { id: string }
}

const QuizLeadsPage = ({ params }: Props) => {
	return <QuizLeads quizId={params.id} />
}

export default QuizLeadsPage
