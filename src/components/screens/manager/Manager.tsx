'use client'
import styles from '@/components/screens/manager/Manager.module.scss'
import CirclesLoader from '@/components/ui/circles-loader/CirclesLoader'
import Heading from '@/components/ui/heading/Heading'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import useManager from '@/hooks/useManager'
import { NextPage } from 'next'

const Manager: NextPage = () => {
	const { data, isLoading } = useManager()

	return (
		<div className={styles.wrapper}>
			<Heading text="Страница только для менеджеров" />
			{isLoading ? (
				<CirclesLoader />
			) : data ? (
				<SubHeading text={'Контент для менеджеров'} />
			) : (
				<SubHeading text={'Ничего не найдено'} />
			)}
		</div>
	)
}

export default Manager
