'use client'
import styles from '@/assets/styles/payment-success.module.scss'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import useUser from '@/hooks/useUser'
import paymentService from '@/services/payment/payment.service'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 20000

const PaymentSuccess = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const [isVerifying, setIsVerifying] = useState(false)

	useEffect(() => {
		queryClient.invalidateQueries({ queryKey: ['get-profile'] })

		const interval = setInterval(() => {
			queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		}, POLL_INTERVAL_MS)

		const timeout = setTimeout(() => {
			clearInterval(interval)
		}, POLL_TIMEOUT_MS)

		return () => {
			clearInterval(interval)
			clearTimeout(timeout)
		}
	}, [queryClient])

	const handleVerify = async () => {
		setIsVerifying(true)
		try {
			const response = await paymentService.verifyPayment()
			if (response.data.activated) {
				queryClient.invalidateQueries({ queryKey: ['get-profile'] })
			}
		} finally {
			setIsVerifying(false)
		}
	}

	if (user?.isPremium) {
		return (
			<div className={styles.wrapper}>
				<h1 className={styles.title}>Подписка активирована</h1>
				<p className={styles.description}>
					Теперь вам доступен весь премиум-контент
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

	return (
		<div className={styles.wrapper}>
			<h1 className={styles.title}>
				Ожидаем ответа от платежной системы...
			</h1>
			<p className={styles.description}>
				Нажмите кнопку ниже чтобы запросить статус платежа вручную
			</p>
			<div className={styles.actions}>
				<button
					className={styles.button}
					onClick={handleVerify}
					disabled={isVerifying}
				>
					{isVerifying ? 'Проверяем...' : 'Проверить статус'}
				</button>
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
