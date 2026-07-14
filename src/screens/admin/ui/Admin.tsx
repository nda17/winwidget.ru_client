import styles from '@/screens/admin/ui/Admin.module.scss'
import Statistics from '@/screens/admin/ui/statistics/Statistics'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import Heading from '@/shared/ui/heading/Heading'
import { NextPage } from 'next'

const Admin: NextPage = () => {
	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminSectionHeading
				text="Дашборд"
				title="Дашборд администратора"
				description="Сводка по оплатам, подпискам, заявкам, виджетам и пользователям."
				risk="low"
				riskText="Блок только показывает статистику и не меняет данные. Ошибка возможна в трактовке цифр, если смотреть период без контекста."
			/>
			<Statistics />
		</section>
	)
}

export default Admin
