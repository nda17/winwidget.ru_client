import styles from '@/components/ui/admin/admin-actions/AdminActions.module.scss'
import { IAdminActions } from '@/components/ui/admin/admin-actions/admin-actions.interface'
import AppIcon from '@/components/ui/icons/AppIcon'
import { NextPage } from 'next'
import { useRouter } from 'next/navigation'

const AdminActions: NextPage<IAdminActions> = ({
	editUrl,
	userId,
	onDelete
}) => {
	const { push } = useRouter()

	return (
		<div className={styles.wrapper}>
			<button className={styles.item} onClick={() => push(editUrl)}>
				<AppIcon name="edit" />
			</button>
			<button
				className={styles.item}
				onClick={() => {
					onDelete?.(userId)
				}}
			>
				<AppIcon name="close" />
			</button>
		</div>
	)
}

export default AdminActions
