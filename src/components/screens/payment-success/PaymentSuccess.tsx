'use client'

import { PUBLIC_PAGES } from '@/config/pages/public.config'
import subscriptionService, {
	type IPaymentVerification
} from '@/services/subscription/subscription.service'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import styles from './payment-success.module.scss'

const MAX_AUTO_VERIFY_ATTEMPTS = 10
const AUTO_VERIFY_INTERVAL_MS = 3000

const planLabel: Record<string, string> = {
	EASY: 'Easy',
	HARD: 'Hard'
}

const PaymentSuccess = () => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [isVerifying, setIsVerifying] = useState(false)
	const [verification, setVerification] =
		useState<IPaymentVerification | null>(null)
	const [verificationError, setVerificationError] = useState('')
	const [autoVerifyAttempts, setAutoVerifyAttempts] = useState(0)

	const { data: subscription } = useQuery({
		queryKey: ['subscription'],
		queryFn: subscriptionService.getMySubscription,
		enabled: auth && verification?.activated === true
	})

	const activatedPlan = verification?.plan ?? subscription?.plan
	const isActivated = verification?.activated === true
	const isCancelled =
		verification?.status === 'cancelled' ||
		verification?.status === 'not_found'

	const handleVerify = useCallback(async () => {
		setIsVerifying(true)
		setVerificationError('')
		try {
			const result = await subscriptionService.verifyPayment()
			setVerification(result)
			queryClient.invalidateQueries({ queryKey: ['pending-payment'] })

			if (result.activated) {
				queryClient.invalidateQueries({ queryKey: ['subscription'] })
				queryClient.invalidateQueries({ queryKey: ['widgets'] })
			}

			if (result.status !== 'pending') {
				setAutoVerifyAttempts(0)
			}
		} catch (error: any) {
			setVerificationError(
				error?.response?.data?.message ||
					'Не удалось проверить статус платежа'
			)
		} finally {
			setIsVerifying(false)
		}
	}, [queryClient])

	useEffect(() => {
		handleVerify()
	}, [handleVerify])

	useEffect(() => {
		if (
			verification?.status !== 'pending' ||
			isVerifying ||
			autoVerifyAttempts >= MAX_AUTO_VERIFY_ATTEMPTS
		) {
			return
		}

		const timeoutId = window.setTimeout(() => {
			setAutoVerifyAttempts(attempts => attempts + 1)
			handleVerify()
		}, AUTO_VERIFY_INTERVAL_MS)

		return () => window.clearTimeout(timeoutId)
	}, [autoVerifyAttempts, handleVerify, isVerifying, verification?.status])

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
							{activatedPlan
								? (planLabel[activatedPlan] ?? activatedPlan)
								: 'выбранный'}
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

	if (isCancelled || verificationError) {
		return (
			<section
				className={styles.page}
				aria-labelledby="payment-cancelled-title"
			>
				<article className={styles.card}>
					<div className={`${styles.icon} ${styles.iconWarning}`}>!</div>
					<h1 id="payment-cancelled-title" className={styles.title}>
						Оплата не завершена
					</h1>
					<p className={styles.description}>
						{verificationError ||
							verification?.message ||
							'Платёж не был подтверждён. Деньги не списаны, подписка не изменена.'}
					</p>
					<div className={styles.actions}>
						<Link href={PUBLIC_PAGES.PAYMENT} className={styles.button}>
							Выбрать тариф
						</Link>
						<Link
							href={PUBLIC_PAGES.PAYMENT}
							className={styles.buttonSecondary}
						>
							На страницу оплаты
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
					Оплата ещё не подтверждена
				</h1>
				<p className={styles.description}>
					{verification?.message ||
						'Если вы только что оплатили, подтверждение может занять несколько секунд. Если вы вышли из оплаты, подписка не активируется.'}
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
						href={PUBLIC_PAGES.PAYMENT}
						className={styles.buttonSecondary}
					>
						На страницу оплаты
					</Link>
				</div>
			</article>
		</section>
	)
}

export default PaymentSuccess
