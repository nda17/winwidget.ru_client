import styles from '@/components/screens/admin/Admin.module.scss'
import Statistics from '@/components/screens/admin/statistics/Statistics'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import { NextPage } from 'next'

const Admin: NextPage = () => {
	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminSectionHeading
				text="Дашборд"
				title="Дашборд администратора"
				description="Сводка по пользователям, регистрациям и основным метрикам проекта."
				risk="low"
				riskText="Блок только показывает статистику и не меняет данные. Ошибка возможна в трактовке цифр, если смотреть период без контекста."
			/>
			<Statistics />
		</section>
	)
}

export default Admin
