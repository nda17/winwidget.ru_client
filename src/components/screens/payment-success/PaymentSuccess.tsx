'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import subscriptionService from '@/services/subscription/subscription.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import styles from '@/assets/styles/payment-success.module.scss'

const planLabel: Record<string, string> = {
	EASY: 'Easy',
	HARD: 'Hard'
}

const PaymentSuccess = () => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [isVerifying, setIsVerifying] = useState(false)
	const [verified, setVerified] = useState(false)

	const { data: subscription } = useQuery({
		queryKey: ['subscription'],
		queryFn: subscriptionService.getMySubscription,
		refetchInterval: verified ? false : 3000,
		enabled: auth
	})

	const isActivated =
		verified &&
		subscription?.status === 'ACTIVE' &&
		subscription?.plan !== 'TRIAL'

	const handleVerify = useCallback(async () => {
		setIsVerifying(true)
		try {
			await subscriptionService.verifyPayment()
			queryClient.invalidateQueries({ queryKey: ['subscription'] })
			queryClient.invalidateQueries({ queryKey: ['widgets'] })
			setVerified(true)
		} finally {
			setIsVerifying(false)
		}
	}, [queryClient])

	useEffect(() => {
		handleVerify()
	}, [handleVerify])

	if (isActivated) {
		return (
			<section
				className={styles.page}
				aria-labelledby="payment-success-title"
			>
				<article className={styles.card}>
					<div className={`${styles.icon} ${styles.iconSuccess}`}>✓</div>
					<h1 id="payment-success-title" className={styles.title}>
						Подписка активирована!
					</h1>
					<p className={styles.description}>
						Тариф{' '}
						<span className={styles.planName}>
							{planLabel[subscription!.plan] ?? subscription!.plan}
						</span>{' '}
						успешно подключён. Виджеты уже работают.
					</p>
					<div className={styles.actions}>
						<Link href={PUBLIC_PAGES.CABINET} className={styles.button}>
							Перейти в кабинет
						</Link>
					</div>
				</article>
			</section>
		)
	}

	return (
		<section
			className={styles.page}
			aria-labelledby="payment-status-title"
		>
			<article className={styles.card}>
				<div className={`${styles.icon} ${styles.iconLoading}`}>
					<div className={styles.spinner} />
				</div>
				<h1 id="payment-status-title" className={styles.title}>
					Ожидаем ответа от платёжной системы...
				</h1>
				<p className={styles.description}>
					Обычно это занимает несколько секунд. Если подписка не
					активировалась — нажмите кнопку ниже.
				</p>
				<div className={styles.actions}>
					<button
						type="button"
						className={styles.button}
						onClick={handleVerify}
						disabled={isVerifying}
					>
						{isVerifying ? 'Проверяем...' : 'Проверить статус'}
					</button>
					<Link
						href={PUBLIC_PAGES.CABINET}
						className={styles.buttonSecondary}
					>
						В кабинет
					</Link>
				</div>
			</article>
		</section>
	)
}

export default PaymentSuccess
