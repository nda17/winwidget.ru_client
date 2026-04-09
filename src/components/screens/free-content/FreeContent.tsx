import styles from '@/components/screens/free-content/FreeContent.module.scss'
import Heading from '@/components/ui/heading/Heading'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import { NextPage } from 'next'

const FreeContent: NextPage = () => {
	return (
		<div className={styles.wrapper}>
			<Heading text="Бесплатный контент для всех пользователей" />
			<SubHeading text="Страница бесплатного контента" />
		</div>
	)
}

export default FreeContent
