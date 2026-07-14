'use client'

import { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './DemoCalculator.module.scss'

const SITE_TYPES = [
	{ value: 'store', label: 'Интернет-магазин', price: 35_000 },
	{ value: 'landing', label: 'Лендинг', price: 18_000 },
	{ value: 'corporate', label: 'Корпоративный сайт', price: 28_000 }
] as const

const formatPrice = (value: number) =>
	new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0
	}).format(value)

interface Props {
	open: boolean
	onClose: () => void
}

const DemoCalculator = ({ open, onClose }: Props) => {
	const dialogTitleId = useId()
	const modalRef = useRef<HTMLDivElement>(null)
	const [siteType, setSiteType] =
		useState<(typeof SITE_TYPES)[number]['value']>('store')
	const [promotion, setPromotion] = useState(true)
	const [developer, setDeveloper] = useState<'yes' | 'no'>('no')
	const [result, setResult] = useState<number | null>(null)

	useEffect(() => {
		if (!open) return

		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		modalRef.current?.focus()

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			document.body.style.overflow = previousOverflow
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [onClose, open])

	useEffect(() => {
		if (open) return
		setSiteType('store')
		setPromotion(true)
		setDeveloper('no')
		setResult(null)
	}, [open])

	const calculate = () => {
		const selectedSite = SITE_TYPES.find(item => item.value === siteType)
		const total =
			(selectedSite?.price ?? 0) +
			(promotion ? 20_000 : 0) +
			(developer === 'yes' ? 45_000 : 0)

		setResult(total)
		toast.success('Демонстрационный расчёт готов')
	}

	if (!open) return null

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть демо калькулятора"
			/>
			<div
				ref={modalRef}
				className={styles.modal}
				role="dialog"
				aria-modal="true"
				aria-labelledby={dialogTitleId}
				tabIndex={-1}
			>
				<button
					type="button"
					className={styles.closeBtn}
					onClick={onClose}
					aria-label="Закрыть"
				>
					&times;
				</button>

				{result === null ? (
					<>
						<h2 id={dialogTitleId} className={styles.title}>
							Укажите параметры
						</h2>

						<div className={styles.fields}>
							<div className={styles.field}>
								<label
									htmlFor="demo-calculator-site"
									className={styles.label}
								>
									Выберите тип сайта
								</label>
								<select
									id="demo-calculator-site"
									className={styles.select}
									value={siteType}
									onChange={event =>
										setSiteType(
											event.target
												.value as (typeof SITE_TYPES)[number]['value']
										)
									}
								>
									{SITE_TYPES.map(item => (
										<option key={item.value} value={item.value}>
											{item.label}
										</option>
									))}
								</select>
							</div>

							<fieldset className={styles.fieldset}>
								<legend className={styles.label}>
									Требуется ли продвижение?
								</legend>
								<div className={styles.options} role="radiogroup">
									{[
										{ value: true, label: 'Да' },
										{ value: false, label: 'Нет' }
									].map(option => (
										<button
											key={option.label}
											type="button"
											className={`${styles.option} ${promotion === option.value ? styles.optionSelected : ''}`}
											onClick={() => setPromotion(option.value)}
											role="radio"
											aria-checked={promotion === option.value}
										>
											<span className={styles.optionMark} />
											{option.label}
										</button>
									))}
								</div>
							</fieldset>

							<div className={styles.field}>
								<label
									htmlFor="demo-calculator-developer"
									className={styles.label}
								>
									Требуется ли разработчик?
								</label>
								<select
									id="demo-calculator-developer"
									className={styles.select}
									value={developer}
									onChange={event =>
										setDeveloper(event.target.value as 'yes' | 'no')
									}
								>
									<option value="no">Нет</option>
									<option value="yes">Да</option>
								</select>
							</div>
						</div>

						<button
							type="button"
							className={styles.calculateBtn}
							onClick={calculate}
						>
							Рассчитать
						</button>
					</>
				) : (
					<div className={styles.result}>
						<p className={styles.resultLabel}>Ориентировочная стоимость</p>
						<h2 id={dialogTitleId} className={styles.resultPrice}>
							от {formatPrice(result)}
						</h2>
						<p className={styles.resultText}>
							Точная цена зависит от деталей проекта. Создайте свой
							калькулятор и собирайте заявки прямо на сайте.
						</p>
						<a href="/register" className={styles.ctaBtn}>
							Попробовать бесплатно
						</a>
						<button
							type="button"
							className={styles.restartBtn}
							onClick={() => setResult(null)}
						>
							Рассчитать заново
						</button>
					</div>
				)}

				<p className={styles.demoTag}>Демонстрационный режим</p>
			</div>
		</div>
	)
}

export default DemoCalculator
