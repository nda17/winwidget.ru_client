import styles from '@/components/layout/nav-menu/desktop/menu/logout-button/LogoutButton.module.scss'
import MaterialIcon from '@/components/ui/icons/MaterialIcon'
import { useLogout } from '@/hooks/useLogout'
import clsx from 'clsx'
import { NextPage } from 'next'
import { MouseEvent } from 'react'

const LogoutButton: NextPage = () => {
	const { logout, isPending } = useLogout()

	const logoutHandler = (e: MouseEvent) => {
		e.preventDefault()
		logout()
	}

	return (
		<button
			onClick={logoutHandler}
			disabled={isPending}
			className={clsx(styles['link-auth-button'])}
		>
			<MaterialIcon name="MdLogout" fill="red" />
			{isPending ? 'Подождите...' : 'Выйти'}
		</button>
	)
}

export default LogoutButton
