import styles from './AdminDangerBanner.module.scss'

const AdminDangerBanner = () => {
	return (
		<div className={styles.banner} role="alert">
			<span className={styles.icon}>⚠️</span>
			<p className={styles.text}>
				<strong>Внимание — опасная зона.</strong> Необдуманные действия в
				этом разделе могут привести к остановке всей системы.
			</p>
		</div>
	)
}

export default AdminDangerBanner
