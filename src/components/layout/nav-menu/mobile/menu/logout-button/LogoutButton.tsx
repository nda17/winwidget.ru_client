import styles from '@/components/layout/nav-menu/mobile/menu/logout-button/LogoutButton.module.scss'
import MaterialIcon from '@/components/ui/icons/MaterialIcon'
import { useLogout } from '@/hooks/useLogout'
import { useHamburgerStore } from '@/store/hamburger-store/hamburger-store'
import { useVeilBackgroundStore } from '@/store/veil-background-store/veil-background-store'
import clsx from 'clsx'
import { NextPage } from 'next'
import { MouseEvent } from 'react'

const LogoutButton: NextPage = () => {
	const changeVisibleHamburger = useHamburgerStore(
		state => state.setVisible
	)
	const changeVisibleVeilBackground = useVeilBackgroundStore(
		state => state.setVisible
	)

	const closeMenu = () => {
		changeVisibleHamburger(false)
		changeVisibleVeilBackground(false)
	}

	const { logout, isPending } = useLogout(closeMenu)

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
			Выйти
		</button>
	)
}

export default LogoutButton
