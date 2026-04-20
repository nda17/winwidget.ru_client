import styles from '@/components/ui/admin/admin-actions/AdminActions.module.scss'
import { IAdminActions } from '@/components/ui/admin/admin-actions/admin-actions.interface'
import MaterialIcon from '@/components/ui/icons/MaterialIcon'
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
				<MaterialIcon name="MdEdit" />
			</button>
			<button
				className={styles.item}
				onClick={() => {
					onDelete?.(userId)
				}}
			>
				<MaterialIcon name="MdClose" />
			</button>
		</div>
	)
}

export default AdminActions
