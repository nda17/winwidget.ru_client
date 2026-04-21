import styles from '@/components/layout/nav-menu/desktop/menu/logout-button/LogoutButton.module.scss'
import AppIcon from '@/components/ui/icons/AppIcon'
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
			<AppIcon name="logout" fill="red" />
			{isPending ? 'Подождите...' : 'Выйти'}
		</button>
	)
}

export default LogoutButton
