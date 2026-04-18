import LogoutButton from '@/components/layout/nav-menu/desktop/menu/logout-button/LogoutButton'
import MenuItem from '@/components/layout/nav-menu/desktop/menu/menu-item/MenuItem'
import { ADMIN_PAGES } from '@/config/pages/admin.config'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import useUser from '@/hooks/useUser'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { NextPage } from 'next'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

const AuthItems: NextPage = () => {
	const { user, isLoading } = useUser()
	const auth = useAuthStore(state => state.auth)
	const isAuthResolved = useAuthStore(state => state.isAuthResolved)

	const isPending = !isAuthResolved || (auth && isLoading)

	useEffect(() => {
		if (!isPending) return
		const id = toast.loading('Загрузка...', { id: 'auth-loading' })
		return () => toast.dismiss(id)
	}, [isPending])

	if (isPending) {
		return null
	}

	return (
		<>
			{!auth && (
				<MenuItem
					item={{
						icon: 'MdApps',
						link: '/#tools',
						title: 'Виджеты'
					}}
				/>
			)}
			{!auth && (
				<MenuItem
					item={{
						icon: 'MdDiamond',
						link: '/#pricing',
						title: 'Тарифы'
					}}
				/>
			)}
			{!auth && (
				<MenuItem
					item={{
						icon: 'MdHelpOutline',
						link: '/#faq',
						title: 'Вопросы'
					}}
				/>
			)}
			{auth && (
				<MenuItem
					item={{
						icon: 'MdSpaceDashboard',
						link: PUBLIC_PAGES.CABINET,
						title: 'Личный кабинет'
					}}
				/>
			)}

			{auth && (
				<MenuItem
					item={{
						icon: 'MdPayment',
						link: PUBLIC_PAGES.PAYMENT,
						title: 'Оплата'
					}}
				/>
			)}

			{user?.isAdmin && (
				<MenuItem
					item={{
						icon: 'MdOutlineLock',
						link: ADMIN_PAGES.HOME,
						title: 'Админ панель'
					}}
				/>
			)}

			{!auth && (
				<MenuItem
					item={{
						icon: 'MdLogin',
						link: PUBLIC_PAGES.LOGIN,
						title: 'Вход'
					}}
				/>
			)}

			{!auth && (
				<MenuItem
					item={{
						icon: 'MdPersonAdd',
						link: PUBLIC_PAGES.REGISTER,
						title: 'Регистрация'
					}}
				/>
			)}

			{auth && <LogoutButton />}
		</>
	)
}

export default AuthItems
