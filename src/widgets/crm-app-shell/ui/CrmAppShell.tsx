'use client'

import styles from '@/widgets/crm-app-shell/ui/CrmAppShell.module.scss'
import {
	CRM_NAVIGATION,
	type CrmNavigationItem
} from '@/widgets/crm-app-shell/model/crm-navigation'
import { AppIcon, BrandLogo, Drawer, StatusBadge } from '@/shared/ui'
import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type FormEvent, type PropsWithChildren, useState } from 'react'
import toast from 'react-hot-toast'

interface CrmNavigationProps {
	ariaLabel: string
	onNavigate?: () => void
}

const isNavigationItemActive = (
	pathname: string,
	item: CrmNavigationItem
) => pathname === item.href || pathname.startsWith(`${item.href}/`)

const CrmNavigation = ({ ariaLabel, onNavigate }: CrmNavigationProps) => {
	const pathname = usePathname()

	return (
		<nav aria-label={ariaLabel}>
			<ul className={styles.navigationList}>
				{CRM_NAVIGATION.map(item => {
					const isActive = isNavigationItemActive(pathname, item)

					return (
						<li key={item.href}>
							<Link
								href={item.href}
								className={clsx(
									styles.navigationLink,
									isActive && styles.navigationLinkActive
								)}
								aria-current={isActive ? 'page' : undefined}
								onClick={onNavigate}
							>
								<span className={styles.navigationIcon}>
									<AppIcon name={item.icon} size={20} />
								</span>
								<span>{item.label}</span>
							</Link>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}

const CrmMobileNavigation = () => {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<>
			<button
				type="button"
				className={styles.mobileMenuButton}
				aria-label="Открыть навигацию CRM"
				aria-expanded={isOpen}
				onClick={() => setIsOpen(true)}
			>
				<AppIcon name="menu" size={20} />
			</button>

			<Drawer
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				title="Навигация CRM"
				side="left"
			>
				<div className={styles.mobileNavigation}>
					<CrmNavigation
						ariaLabel="Мобильная навигация CRM"
						onNavigate={() => setIsOpen(false)}
					/>
					<p className={styles.mobileCaption}>
						Интерфейс работает на локальных демо-данных
					</p>
				</div>
			</Drawer>
		</>
	)
}

const CrmAppShell = ({ children }: PropsWithChildren) => {
	const pathname = usePathname()
	const [searchQuery, setSearchQuery] = useState('')

	const handleSearch = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (!searchQuery.trim()) {
			toast.error('Введите запрос для поиска')
			return
		}

		toast('Демо-режим: поиск пока не подключён к данным')
	}

	return (
		<div className={styles.shell}>
			<a className={styles.skipLink} href="#crm-main-content">
				Перейти к содержимому
			</a>

			<aside className={styles.sidebar} aria-label="CRM">
				<div className={styles.sidebarBrand}>
					<BrandLogo href="/inbox" />
				</div>
				<div className={styles.sidebarNavigation}>
					<CrmNavigation ariaLabel="Основная навигация CRM" />
				</div>
				<p className={styles.sidebarCaption}>
					Интерфейс работает на локальных демо-данных
				</p>
			</aside>

			<div className={styles.workspace}>
				<header className={styles.topbar}>
					<CrmMobileNavigation key={pathname} />

					<form
						className={styles.searchForm}
						role="search"
						onSubmit={handleSearch}
					>
						<label className={styles.visuallyHidden} htmlFor="crm-search">
							Поиск по CRM
						</label>
						<input
							id="crm-search"
							name="query"
							type="search"
							autoComplete="off"
							className={styles.searchInput}
							placeholder="Поиск по CRM"
							value={searchQuery}
							onChange={event => setSearchQuery(event.target.value)}
						/>
						<button
							type="submit"
							className={styles.searchButton}
							aria-label="Найти"
						>
							<AppIcon name="search" size={18} />
						</button>
					</form>

					<div className={styles.prototypeBadge}>
						<StatusBadge tone="info">Локальный прототип</StatusBadge>
					</div>
				</header>

				<main
					id="crm-main-content"
					className={styles.content}
					tabIndex={-1}
				>
					{children}
				</main>
			</div>
		</div>
	)
}

export default CrmAppShell
