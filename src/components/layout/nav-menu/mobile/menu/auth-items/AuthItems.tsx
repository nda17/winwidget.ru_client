import LogoutButton from '@/components/layout/nav-menu/mobile/menu/logout-button/LogoutButton'
import MenuItem from '@/components/layout/nav-menu/mobile/menu/menu-item/MenuItem'
import { ADMIN_PAGES } from '@/config/pages/admin.config'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import useUser from '@/hooks/useUser'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { NextPage } from 'next'

const AuthItems: NextPage = () => {
	const { user, isLoading } = useUser()
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)

	if (!isAuthResolved || (auth && isLoading)) {
		return null
	}

	return (
		<>
			{auth && (
				<MenuItem
					item={{
						icon: 'MdSettings',
						link: PUBLIC_PAGES.USER_PROFILE,
						title: 'Профиль'
					}}
				/>
			)}

			{user?.isManager && (
				<MenuItem
					item={{
						icon: 'MdGroup',
						link: PUBLIC_PAGES.MANAGER,
						title: 'Менеджер'
					}}
				/>
			)}

			{user?.isAdmin && (
				<MenuItem
					item={{
						icon: 'MdOutlineLock',
						link: ADMIN_PAGES.HOME,
						title: 'Админ'
					}}
				/>
			)}

			{!auth && (
				<MenuItem
					item={{
						icon: 'MdLogout',
						link: PUBLIC_PAGES.LOGIN,
						title: 'Войти'
					}}
				/>
			)}

			{auth && <LogoutButton />}
		</>
	)
}

export default AuthItems
