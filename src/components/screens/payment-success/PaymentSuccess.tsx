'use client'
import styles from '@/assets/styles/payment-success.module.scss'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect } from 'react'

const PaymentSuccess = () => {
	const queryClient = useQueryClient()

	useEffect(() => {
		queryClient.invalidateQueries({ queryKey: ['get-profile'] })
	}, [queryClient])

	return (
		<div className={styles.wrapper}>
			<h1 className={styles.title}>Оплата принята</h1>
			<p className={styles.description}>
				Подписка PREMIUM активируется автоматически в течение нескольких
				секунд. Если доступ не появился — обнови страницу
			</p>
			<div className={styles.actions}>
				<Link
					href={PUBLIC_PAGES.PREMIUM_CONTENT}
					className={styles.button}
				>
					Перейти к контенту
				</Link>
				<Link
					href={PUBLIC_PAGES.USER_PROFILE}
					className={styles['button-secondary']}
				>
					В профиль
				</Link>
			</div>
		</div>
	)
}

export default PaymentSuccess
