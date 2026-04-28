'use client'

import widgetService from '@/services/widget/widget.service'
import { Widget, WidgetConfig } from '@/services/widget/widget.types'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import toast from 'react-hot-toast'
import DirectLinkQr from './DirectLinkQr'
import styles from './WheelSettingsModal.module.scss'

type Tab = 'main' | 'bonuses' | 'integrations' | 'code' | 'info'

interface Props {
	widget: Widget
	onClose: () => void
	onSaved: (updated: Widget) => void
}

const WheelSettingsModal = ({ widget, onClose, onSaved }: Props) => {
	const [tab, setTab] = useState<Tab>('main')
	const [config, setConfig] = useState<WidgetConfig>({ ...widget.config })
	const [name, setName] = useState(widget.name)
	const titleId = useId()
	const [cooldownInput, setCooldownInput] = useState(
		String(widget.config.spinCooldownDays ?? 0)
	)
	const [confirmReset, setConfirmReset] = useState(false)
	const [confirmResetAttempts, setConfirmResetAttempts] = useState(false)
	const [savedSnapshot, setSavedSnapshot] = useState(() =>
		JSON.stringify({ name: widget.name, config: widget.config })
	)
	const currentSnapshot = JSON.stringify({ name, config })
	const hasUnsavedChanges = currentSnapshot !== savedSnapshot

	const DEFAULT_CONFIG: WidgetConfig = {
		color: '#4705fb',
		bgColor: '',
		autoOpenDelay: 45,
		spinDuration: 5,
		buttonSide: 'right',
		buttonPulse: true,
		buttonBottom: 3,
		buttonOffset: 3,
		buttonSize: 60,
		bubbleEnabled: true,
		bubbleText: 'Испытайте удачу!',
		alreadyPlayedTitle: '🎉 Вы уже участвовали!',
		alreadyPlayedSubtitle:
			'Каждый посетитель может крутить колесо только один раз',
		hideIfPlayed: false,
		dataType: 'PHONE',
		title: 'Крутите колесо!',
		subtitle: '',
		winMessage: 'Поздравляем! Не пропустите звонок, мы скоро свяжемся',
		privacyUrl:
			'https://winwidget.ru/legal-documentation/consent-processing',
		developInfoActive: true,
		buttonText: 'Крутить!',
		filterDuplicates: false,
		buttonColor: '',
		centerColor: '#ffffff',
		arrowColor: '#ffcc00',
		spinCooldownDays: 0,
		spinResetToken: '',
		actionButton: null,
		bonuses: [
			{ name: 'Бонус #1', active: true },
			{ name: 'Бонус #2', active: true },
			{ name: 'Бонус #3', active: true },
			{ name: 'Бонус #4', active: true },
			{ name: 'Бонус #5', active: true },
			{ name: 'Бонус #6', active: true },
			{ name: 'Бонус #7', active: true },
			{ name: 'Бонус #8', active: true }
		],
		integrations: {
			email: '',
			webhookUrl: '',
			telegramChatId: '',
			yandexMetrikaId: '',
			vkPixelId: '',
			bitrix24WebhookUrl: '',
			roistatEnabled: false,
			amoCrmDomain: '',
			amoCrmToken: ''
		}
	}

	const saveMutation = useMutation({
		mutationFn: (data: { name: string; config: WidgetConfig }) =>
			widgetService.updateWidget(widget.id, data),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			toast.success('Сохранено', { id: toastId })
			setName(updated.name)
			setConfig(updated.config)
			setCooldownInput(String(updated.config.spinCooldownDays ?? 0))
			setSavedSnapshot(
				JSON.stringify({ name: updated.name, config: updated.config })
			)
			onSaved(updated)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка сохранения', {
				id: toastId
			})
		}
	})

	const resetAttemptsMutation = useMutation({
		mutationFn: (newToken: string) =>
			widgetService.updateWidget(widget.id, {
				name,
				config: { ...config, spinResetToken: newToken }
			}),
		onMutate: () =>
			toast.loading('Сбрасываем попытки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			toast.success('Попытки всех посетителей сброшены', { id: toastId })
			setName(updated.name)
			setConfig(updated.config)
			setCooldownInput(String(updated.config.spinCooldownDays ?? 0))
			setSavedSnapshot(
				JSON.stringify({ name: updated.name, config: updated.config })
			)
			onSaved(updated)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка сброса', {
				id: toastId
			})
		}
	})

	const setField = <K extends keyof WidgetConfig>(
		key: K,
		value: WidgetConfig[K]
	) => {
		setConfig(prev => ({ ...prev, [key]: value }))
	}

	const setBonus = (
		index: number,
		field: 'name' | 'active' | 'probability' | 'color' | 'neverWin',
		value: string | boolean | number
	) => {
		setConfig(prev => {
			const bonuses = [...prev.bonuses]
			bonuses[index] = { ...bonuses[index], [field]: value }
			return { ...prev, bonuses }
		})
	}

	const apiUrl =
		process.env.NEXT_PUBLIC_MODE === 'production'
			? process.env.NEXT_PUBLIC_PRODUCTION_HOST || 'https://winwidget.ru'
			: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'
	const publicSiteUrl = (
		process.env.NEXT_PUBLIC_SITE_URL ||
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? 'https://winwidget.ru'
			: '')
	).replace(/\/$/, '')
	const scriptCode = `<script src="${apiUrl}/widgets/wheel.js" data-key="${widget.publicKey}" async></script>`
	const directLink = `${publicSiteUrl}/page-wheel/${widget.publicKey}`

	const handleSave = () => {
		const activeCount = config.bonuses.filter(b => b.active).length
		const canWinCount = config.bonuses.filter(
			b => b.active && !b.neverWin
		).length
		if (canWinCount === 0) {
			toast.error('Хотя бы один сектор должен иметь возможность выиграть')
			return
		}
		if (activeCount < 2) {
			toast.error('Минимум 2 бонуса должны участвовать в розыгрыше')
			return
		}
		if (activeCount > 8) {
			toast.error('Максимум 8 бонусов могут участвовать в розыгрыше')
			return
		}
		const spin = config.spinDuration ?? 5
		if (spin < 3 || spin > 10) {
			toast.error('Длительность анимации должна быть от 3 до 10 секунд')
			return
		}
		const bottom = config.buttonBottom
		if (!bottom || bottom < 1 || bottom > 50) {
			toast.error('Высота кнопки: введите число от 1 до 50')
			return
		}
		const cooldown = config.spinCooldownDays ?? 0
		if (cooldown > 365) {
			toast.error('Повторное участие: введите число от 0 до 365')
			return
		}
		const invalidBonus = config.bonuses.findIndex(b => {
			const p = b.probability ?? 1
			return p < 1 || p > 100
		})
		if (invalidBonus !== -1) {
			toast.error(
				`Бонус #${invalidBonus + 1}: вес должен быть от 1 до 100`
			)
			return
		}
		const sanitizedConfig: WidgetConfig = {
			...config,
			bonuses: config.bonuses.map((b, i) => ({
				...b,
				name: b.name.trim() || `Бонус #${i + 1}`,
				probability: b.probability ?? 1
			}))
		}
		const sanitizedName = name.trim() || 'Виджет'
		setName(sanitizedName)
		setConfig(sanitizedConfig)
		saveMutation.mutate({
			name: sanitizedName,
			config: sanitizedConfig
		})
	}

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть настройки виджета"
			/>
			<div
				className={styles.modal}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
			>
				<button
					type="button"
					className={styles.closeBtn}
					onClick={onClose}
				>
					✕
				</button>
				<h2 id={titleId} className={styles.modalTitle}>
					Настройки
				</h2>

				<div className={styles.tabs}>
					{(
						['main', 'bonuses', 'integrations', 'code', 'info'] as Tab[]
					).map(t => (
						<button
							key={t}
							className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
							onClick={() => setTab(t)}
						>
							{t === 'main' && 'Главные'}
							{t === 'bonuses' && 'Бонусы'}
							{t === 'integrations' && 'Интеграции'}
							{t === 'code' && 'Код'}
							{t === 'info' && 'Инфо'}
						</button>
					))}
				</div>

				<div className={styles.tabContent}>
					{tab === 'main' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Внешний вид
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Название виджета:</p>
									<input
										className={styles.input}
										value={name}
										onChange={e => setName(e.target.value)}
										placeholder="Виджет"
										maxLength={15}
									/>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Основной цвет:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.color}
											onChange={e => setField('color', e.target.value)}
										/>
										<input
											className={styles.input}
											value={config.color}
											onChange={e => setField('color', e.target.value)}
											placeholder="#4705fb"
											maxLength={7}
										/>
										{config.color && config.color !== '#4705fb' && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => setField('color', '#4705fb')}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет кромки барабана, фона карточки и секторов по
										умолчанию (если не задан свой цвет сектора).
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет фона виджета</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.bgColor || '#4705fb'}
											onChange={e => setField('bgColor', e.target.value)}
										/>
										<input
											className={styles.input}
											value={config.bgColor || ''}
											onChange={e => setField('bgColor', e.target.value)}
											placeholder="#4705fb"
											maxLength={7}
										/>
										{config.bgColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => setField('bgColor', '')}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет фона карточки (фон под колесом). Оставьте пустым
										для стандартного градиента.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет кнопки «Крутить»:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.buttonColor || '#6a11cb'}
											onChange={e =>
												setField('buttonColor', e.target.value)
											}
										/>
										<input
											className={styles.input}
											value={config.buttonColor || ''}
											onChange={e =>
												setField('buttonColor', e.target.value)
											}
											placeholder="По умолчанию (градиент)"
											maxLength={7}
										/>
										{config.buttonColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => setField('buttonColor', '')}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Оставьте пустым для стандартного градиента
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Цвет волчка (центральный круг колеса):
									</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.centerColor || '#ffffff'}
											onChange={e =>
												setField('centerColor', e.target.value)
											}
										/>
										<input
											className={styles.input}
											value={config.centerColor || ''}
											onChange={e =>
												setField('centerColor', e.target.value)
											}
											placeholder="#ffffff"
											maxLength={7}
										/>
										{config.centerColor &&
											config.centerColor !== '#ffffff' && (
												<button
													type="button"
													className={styles.clearColorBtn}
													onClick={() =>
														setField('centerColor', '#ffffff')
													}
													title="Сбросить к белому"
												>
													✕
												</button>
											)}
									</div>
									<p className={styles.hint}>
										Цвет круглого элемента в центре колеса фортуны.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет стрелки:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.arrowColor || '#ffcc00'}
											onChange={e =>
												setField('arrowColor', e.target.value)
											}
										/>
										<input
											className={styles.input}
											value={config.arrowColor || ''}
											onChange={e =>
												setField('arrowColor', e.target.value)
											}
											placeholder="#ffcc00"
											maxLength={7}
										/>
										{config.arrowColor &&
											config.arrowColor !== '#ffcc00' && (
												<button
													type="button"
													className={styles.clearColorBtn}
													onClick={() => setField('arrowColor', '#ffcc00')}
													title="Сбросить к стандартному"
												>
													✕
												</button>
											)}
									</div>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Поведение колеса
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Длительность анимации прокрутки (сек):
									</p>
									<input
										className={styles.input}
										type="number"
										value={config.spinDuration ?? ''}
										onChange={e => {
											const val = parseInt(e.target.value)
											setField(
												'spinDuration',
												isNaN(val) ? ('' as any) : val
											)
										}}
										placeholder="5"
									/>
									<p className={styles.hint}>
										От 3 до 10 секунд. Рекомендуемое значение 5-7 секунд.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Кнопка открытия
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Кнопка открытия — пульсация
									</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="buttonPulse"
											checked={config.buttonPulse ?? true}
											onChange={e =>
												setField('buttonPulse', e.target.checked)
											}
										/>
										<label
											htmlFor="buttonPulse"
											className={styles.checkLabel}
										>
											Включить пульсацию кнопки
										</label>
									</div>
									<p className={styles.hint}>
										Дополнительный эффект со свечением на кнопке открытия
										виджета.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Сторона расположения кнопки для открытия виджета на
										вашем сайте:
									</p>
									<select
										className={styles.input}
										value={config.buttonSide ?? 'right'}
										onChange={e =>
											setField(
												'buttonSide',
												e.target.value as 'left' | 'right'
											)
										}
									>
										<option value="right">Справа</option>
										<option value="left">Слева</option>
									</select>
									<p className={styles.hint}>
										Можно настроить с какой стороны экрана будет кнопка
										открытия виджета.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Отображение облачка:</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="wheelBubbleEnabled"
											checked={config.bubbleEnabled ?? true}
											onChange={e =>
												setField('bubbleEnabled', e.target.checked)
											}
										/>
										<label
											htmlFor="wheelBubbleEnabled"
											className={styles.checkLabel}
										>
											Показывать облачко рядом с кнопкой
										</label>
									</div>
									<p className={styles.hint}>
										Если выключить, останется только плавающая кнопка.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Текст облачка у кнопки:</p>
									<input
										className={styles.input}
										value={config.bubbleText ?? ''}
										onChange={e => setField('bubbleText', e.target.value)}
										placeholder="Испытайте удачу!"
										maxLength={80}
									/>
									<p className={styles.hint}>
										Подсказка рядом с плавающей кнопкой. Если оставить
										пустым, будет показан стандартный текст.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Высота кнопки от низа экрана:{' '}
										<strong>{config.buttonBottom ?? 3}%</strong>
									</p>
									<input
										type="range"
										min={1}
										max={50}
										value={config.buttonBottom ?? 3}
										onChange={e =>
											setField('buttonBottom', Number(e.target.value))
										}
										className={styles.input}
										style={{
											padding: '8px 0',
											background: 'transparent',
											border: 'none'
										}}
									/>
									<p className={styles.hint}>
										Отступ от нижнего края экрана в процентах. 3 — почти
										внизу, 50 — по центру.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Отступ кнопки от края экрана:{' '}
										<strong>{config.buttonOffset ?? 3}%</strong>
									</p>
									<input
										type="range"
										min={1}
										max={50}
										value={config.buttonOffset ?? 3}
										onChange={e =>
											setField('buttonOffset', Number(e.target.value))
										}
										className={styles.input}
										style={{
											padding: '8px 0',
											background: 'transparent',
											border: 'none'
										}}
									/>
									<p className={styles.hint}>
										Отступ кнопки от левого или правого края экрана в
										процентах. 3 — почти у края, 50 — по центру.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Размер кнопки открытия:{' '}
										<strong>{config.buttonSize ?? 60}px</strong>
									</p>
									<input
										type="range"
										min={40}
										max={100}
										value={config.buttonSize ?? 60}
										onChange={e =>
											setField('buttonSize', Number(e.target.value))
										}
										className={styles.input}
										style={{
											padding: '8px 0',
											background: 'transparent',
											border: 'none'
										}}
									/>
									<p className={styles.hint}>
										Размер иконки плавающей кнопки в пикселях. По умолчанию
										60px.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Количество секунд до авто-открытия виджета:
									</p>
									<input
										className={styles.input}
										type="number"
										min="0"
										value={config.autoOpenDelay ?? ''}
										onChange={e =>
											setField(
												'autoOpenDelay',
												e.target.value ? parseInt(e.target.value) : null
											)
										}
										placeholder="Оставьте пустым для отключения"
									/>
									<p className={styles.hint}>
										Через сколько секунд виджет откроется автоматически
										после открытия страницы вашего сайта. Оставьте пустым
										для отключения. Если пользователь уже учавствовал,
										данная настройка игнорируется при любых значениях.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Форма и сообщения
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Сбор данных клиента:</p>
									<select
										className={styles.input}
										value={config.dataType}
										onChange={e =>
											setField(
												'dataType',
												e.target.value as WidgetConfig['dataType']
											)
										}
									>
										<option value="PHONE">Номер телефона</option>
										<option value="EMAIL">Email</option>
										<option value="PHONE_AND_EMAIL">
											Номер телефона и Email
										</option>
										<option value="NONE">Ничего не собираем</option>
									</select>
									<p className={styles.hint}>
										Какие данные клиента нужно собрать в обмен на попытку
										покрутить барабан.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Заголовок виджета:</p>
									<input
										className={styles.input}
										value={config.title}
										onChange={e => setField('title', e.target.value)}
										placeholder="Крутите колесо!"
										maxLength={80}
									/>
									<p className={styles.hint}>Информация для посетителя.</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Подзаголовок виджета:</p>
									<input
										className={styles.input}
										value={config.subtitle}
										onChange={e => setField('subtitle', e.target.value)}
										placeholder={
											config.dataType === 'EMAIL'
												? 'Введите свою почту, чтобы выиграть приз'
												: config.dataType === 'PHONE_AND_EMAIL'
													? 'Введите свой номер телефона и почту, чтобы выиграть приз'
													: config.dataType === 'NONE'
														? 'Крутите барабан, чтобы выиграть приз'
														: 'Введите свой номер телефона, чтобы выиграть приз'
										}
										maxLength={150}
									/>
									<p className={styles.hint}>Информация для посетителя.</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Сообщение после выигрыша:</p>
									<input
										className={styles.input}
										value={config.winMessage}
										onChange={e => setField('winMessage', e.target.value)}
										placeholder="Поздравляем! Не пропустите звонок, мы скоро свяжемся"
										maxLength={150}
									/>
									<p className={styles.hint}>
										Текст для посетителя после остановки колеса и
										определения выигрыша.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Антифрод уведомление «уже участвовали» — заголовок:
									</p>
									<input
										className={styles.input}
										value={config.alreadyPlayedTitle ?? ''}
										onChange={e =>
											setField('alreadyPlayedTitle', e.target.value)
										}
										placeholder="🎉 Вы уже участвовали!"
										maxLength={80}
									/>
									<p className={styles.hint}>
										Если посетитель повторно откроет виджет, он увидит это
										уведомление в интерфейсе.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Антифрод уведомление «уже участвовали» — подзаголовок:
									</p>
									<input
										className={styles.input}
										value={config.alreadyPlayedSubtitle ?? ''}
										onChange={e =>
											setField('alreadyPlayedSubtitle', e.target.value)
										}
										placeholder="Каждый посетитель может крутить колесо только один раз"
										maxLength={150}
									/>
									<p className={styles.hint}>
										Если посетитель повторно откроет виджет, он увидит это
										уведомление в интерфейсе.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ссылка на политику конфиденциальности:
									</p>
									<input
										className={styles.input}
										value={config.privacyUrl}
										onChange={e => setField('privacyUrl', e.target.value)}
										placeholder="https://winwidget.ru/legal-documentation/consent-processing"
										maxLength={500}
									/>
									<p className={styles.hint}>
										По умолчанию ссылка ведёт на политику нашего сервиса.
										Можно оставить как есть или добавить свою ссылку.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Текст в кнопке старта вращения:
									</p>
									<input
										className={styles.input}
										value={config.buttonText}
										onChange={e => setField('buttonText', e.target.value)}
										placeholder="Крутить!"
										maxLength={40}
									/>
									<p className={styles.hint}>
										Текст в кнопке для старта вращения
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Повторное участие
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Скрыть виджет после участия:
									</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="hideIfPlayed"
											checked={config.hideIfPlayed ?? false}
											onChange={e =>
												setField('hideIfPlayed', e.target.checked)
											}
										/>
										<label
											htmlFor="hideIfPlayed"
											className={styles.checkLabel}
										>
											Скрывать кнопку и виджет, если посетитель уже крутил
										</label>
									</div>
									<p className={styles.hint}>
										Виджет и кнопка полностью исчезнут для тех, кто уже
										участвовал
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Повторное участие — раз в N дней:
									</p>
									<input
										className={styles.input}
										type="number"
										min="0"
										max="365"
										value={cooldownInput}
										onChange={e => {
											const raw = e.target.value
											if (!/^\d*$/.test(raw)) return
											setCooldownInput(raw)
											if (raw !== '') {
												setField('spinCooldownDays', parseInt(raw))
											}
										}}
										onBlur={() => {
											const val = parseInt(cooldownInput)
											const normalized = isNaN(val) ? 0 : Math.max(0, val)
											setCooldownInput(String(normalized))
											setField('spinCooldownDays', normalized)
										}}
										placeholder="0"
									/>
									<p className={styles.hint}>
										0 — крутить можно только единоразово. Любое другое
										число — посетитель сможет крутить снова через указанное
										количество дней.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Фильтр заявок:</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="filterDuplicates"
											checked={config.filterDuplicates}
											onChange={e =>
												setField('filterDuplicates', e.target.checked)
											}
										/>
										<label
											htmlFor="filterDuplicates"
											className={styles.checkLabel}
										>
											Не учитывать повторные контакты
										</label>
									</div>
									<p className={styles.hint}>
										Дополнительный антифрод-фактор. Если посетитель введёт
										номер телефона или email, который уже есть в базе этого
										виджета — повторная заявка не сохранится и уведомления
										о заявках не будут вам отправлены.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Опасные действия
									</h3>
								</div>

								<div className={styles.dangerActions}>
									{!confirmResetAttempts ? (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmResetAttempts(true)}
											disabled={
												resetAttemptsMutation.isPending ||
												saveMutation.isPending
											}
										>
											Сбросить попытки всех посетителей
										</button>
									) : (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Все посетители смогут крутить колесо заново.
												Действие необратимо.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													onClick={() => {
														resetAttemptsMutation.mutate(
															crypto.randomUUID()
														)
														setConfirmResetAttempts(false)
													}}
													disabled={resetAttemptsMutation.isPending}
												>
													{resetAttemptsMutation.isPending
														? 'Сброс...'
														: 'Да, сбросить'}
												</button>
												<button
													type="button"
													className={styles.cancelBtn}
													onClick={() => setConfirmResetAttempts(false)}
												>
													Отмена
												</button>
											</div>
										</div>
									)}

									{!confirmReset ? (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmReset(true)}
										>
											Сбросить все настройки до значений по умолчанию
										</button>
									) : (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Все настройки виджета будут заменены на
												стандартные. Действие необратимо после сохранения.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													disabled={saveMutation.isPending}
													onClick={() => {
														setConfig(DEFAULT_CONFIG)
														setCooldownInput('0')
														setConfirmReset(false)
														saveMutation.mutate({
															name: name.trim() || 'Колесо',
															config: DEFAULT_CONFIG
														})
													}}
												>
													Да, сбросить
												</button>
												<button
													type="button"
													className={styles.cancelBtn}
													onClick={() => setConfirmReset(false)}
												>
													Отмена
												</button>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{tab === 'bonuses' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Правила выпадения
									</h3>
								</div>
								<p className={styles.hint}>
									Укажите от 2 до 8 бонусов. <b>Вес (от 1 до 100)</b>
									<br />
									<br /> управляет частотой выпадения сектора: чем больше
									вес, тем чаще он выпадает.
									<br />
									Все веса суммируются, и каждый сектор получает долю
									пропорционально своему весу.
									<br />
									<br />
									Пример: колесо из 3х секторов с весами 1, 1, 8 — третий
									выпадет в 80% случаев.
									<br />
									<br />
									Галочка <b>«никогда не выигрывает»</b> показывает сектор
									на колесе, но исключает его из розыгрыша — вес при этом
									игнорируется.
								</p>
							</div>
							{config.bonuses.map((bonus, i) => (
								<div key={i} className={styles.bonusBlock}>
									<p className={styles.label}>Бонус #{i + 1}</p>
									<input
										className={styles.input}
										value={bonus.name}
										onChange={e => setBonus(i, 'name', e.target.value)}
										placeholder={`Бонус #${i + 1}`}
										maxLength={50}
									/>
									<div className={styles.colorRow}>
										<div className={styles.colorRowField}>
											<span className={styles.colorRowLabel}>Цвет</span>
											<div
												style={{
													display: 'flex',
													gap: '6px',
													alignItems: 'center'
												}}
											>
												<input
													type="color"
													className={styles.colorPicker}
													value={bonus.color || '#4705fb'}
													onChange={e =>
														setBonus(i, 'color', e.target.value)
													}
												/>
												<input
													className={styles.input}
													value={bonus.color || ''}
													onChange={e =>
														setBonus(i, 'color', e.target.value)
													}
													placeholder="#4705fb"
													maxLength={7}
												/>
											</div>
										</div>
										<div className={styles.colorRowField}>
											<span className={styles.colorRowLabel}>Вес</span>
											<input
												className={styles.input}
												type="number"
												min="1"
												max="100"
												value={bonus.probability ?? 1}
												onChange={e =>
													setBonus(
														i,
														'probability',
														parseInt(e.target.value) || 1
													)
												}
												style={{ width: '80px' }}
											/>
										</div>
									</div>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id={`bonus-active-${i}`}
											checked={bonus.active}
											onChange={e =>
												setBonus(i, 'active', e.target.checked)
											}
										/>
										<label
											htmlFor={`bonus-active-${i}`}
											className={styles.checkLabel}
										>
											участвует в розыгрыше
										</label>
									</div>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id={`bonus-neverwin-${i}`}
											checked={bonus.neverWin ?? false}
											onChange={e =>
												setBonus(i, 'neverWin', e.target.checked)
											}
										/>
										<label
											htmlFor={`bonus-neverwin-${i}`}
											className={styles.checkLabel}
										>
											никогда не выигрывает
										</label>
									</div>
								</div>
							))}
						</div>
					)}

					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Уведомления
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Отправка заявок на Email</p>
									<input
										className={styles.input}
										type="email"
										value={config.integrations.email || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												email: e.target.value
											})
										}
										placeholder="your@email.com"
										maxLength={200}
									/>
									<p className={styles.hint}>
										Новые заявки будут отправляться на этот email
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Отправка заявок в Telegram
									</p>
									<input
										className={styles.input}
										value={config.integrations.telegramChatId || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												telegramChatId: e.target.value
											})
										}
										placeholder="-1234567890"
										maxLength={50}
									/>
									<p className={styles.hint}>
										Напишите боту <b>@winwidget_bot</b> команду /start,
										затем укажите сюда ваш Telegram ID. Узнать ID можно
										через бот <b>@getmyid_bot</b>
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Webhooks и CRM
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Внешний URL (Webhook)</p>
									<input
										className={styles.input}
										type="url"
										value={config.integrations.webhookUrl || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												webhookUrl: e.target.value
											})
										}
										placeholder="https://example.com/webhook"
										maxLength={500}
									/>
									<p className={styles.hint}>
										На указанный URL придёт POST-запрос с данными:{' '}
										<b>name</b> — название виджета, <b>lead</b> — контакт,{' '}
										<b>phone</b>, <b>email</b>, <b>bonus</b> — выигранный
										приз, <b>time</b> — время выигрыша
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Отправка заявок в Битрикс24
									</p>
									<input
										className={styles.input}
										type="url"
										value={config.integrations.bitrix24WebhookUrl || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												bitrix24WebhookUrl: e.target.value
											})
										}
										placeholder="https://name.bitrix24.ru/rest/1/ключ/"
										maxLength={500}
									/>
									<p className={styles.hint}>
										Укажите URL вашего входящего вебхука из Битрикс24.
										Перейдите в Битрикс24 → Приложения → Вебхуки → Входящий
										вебхук → скопируйте «Пример URL для вызова REST». Новые
										заявки будут создаваться как лиды в CRM
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>amoCRM — домен аккаунта</p>
									<input
										className={styles.input}
										value={config.integrations.amoCrmDomain || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												amoCrmDomain: e.target.value
											})
										}
										placeholder="mycompany.amocrm.ru"
										maxLength={100}
									/>
									<p className={styles.hint}>
										Домен вашего аккаунта amoCRM, например{' '}
										<b>mycompany.amocrm.ru</b>
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>amoCRM — токен доступа</p>
									<input
										className={styles.input}
										type="password"
										value={config.integrations.amoCrmToken || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												amoCrmToken: e.target.value
											})
										}
										placeholder="Долгосрочный токен из настроек API"
										maxLength={500}
									/>
									<p className={styles.hint}>
										Перейдите в amoCRM → Настройки → Интеграции → API →
										скопируйте долгосрочный токен. При каждой заявке будут
										создаваться сделка и контакт
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>Аналитика</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Яндекс Метрика — ID счётчика
									</p>
									<input
										className={styles.input}
										value={config.integrations.yandexMetrikaId || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												yandexMetrikaId: e.target.value
											})
										}
										placeholder="12345678"
										maxLength={20}
									/>
									<p className={styles.hint}>
										При открытии виджета отправляется цель <b>ip3_open</b>,
										при отправке заявки — <b>ip3_send</b>. Счётчик метрики
										должен быть установлен на странице сайта
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ретаргетинг ВКонтакте — ID пикселя
									</p>
									<input
										className={styles.input}
										value={config.integrations.vkPixelId || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												vkPixelId: e.target.value
											})
										}
										placeholder="VK-RTRG-12345-ABCDEF"
										maxLength={50}
									/>
									<p className={styles.hint}>
										При открытии виджета отправляется событие{' '}
										<b>ip3_open</b>, при отправке заявки — <b>ip3_send</b>.
										Пиксель VK должен быть установлен на странице сайта
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Roistat</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="roistatEnabled"
											checked={config.integrations.roistatEnabled ?? false}
											onChange={e =>
												setField('integrations', {
													...config.integrations,
													roistatEnabled: e.target.checked
												})
											}
										/>
										<label
											htmlFor="roistatEnabled"
											className={styles.checkLabel}
										>
											Включить отправку целей в Roistat
										</label>
									</div>
									<p className={styles.hint}>
										При открытии виджета отправляется цель <b>ip3_open</b>,
										при отправке заявки — <b>ip3_send</b>. Код Roistat
										должен быть подключён на странице сайта
									</p>
								</div>
							</div>
						</div>
					)}

					{tab === 'code' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Установка на сайт
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Код виджета</p>
									<p className={styles.hint}>
										Вставьте этот код перед закрывающим тегом &lt;/body&gt;
									</p>
									<textarea
										className={`${styles.input} ${styles.codeArea}`}
										readOnly
										value={scriptCode}
										onClick={e =>
											(e.target as HTMLTextAreaElement).select()
										}
									/>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() => {
											navigator.clipboard.writeText(scriptCode)
											toast.success('Код скопирован')
										}}
									>
										Скопировать
									</button>
									<DirectLinkQr
										value={directLink}
										downloadName={`winwidget-wheel-${widget.publicKey}.png`}
									/>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Прямая ссылка
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Прямая ссылка</p>
									<p className={styles.hint}>
										Если не требуется подключение виджета к сайту
									</p>
									<div className={styles.directLink}>
										<input
											className={styles.input}
											readOnly
											value={directLink}
											onClick={e =>
												(e.target as HTMLInputElement).select()
											}
										/>
										<a
											href={directLink}
											target="_blank"
											rel="noopener noreferrer"
											className={styles.openLink}
										>
											Открыть
										</a>
									</div>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() => {
											navigator.clipboard.writeText(directLink)
											toast.success('Ссылка скопирована')
										}}
									>
										Скопировать
									</button>
								</div>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Как работает колесо
									</h3>
								</div>
								<p className={styles.infoText}>
									Посетитель открывает колесо, оставляет контакт и крутит
									барабан. После выигрыша заявка сохраняется в кабинете и
									отправляется в подключённые интеграции.
								</p>
								<ul className={styles.infoList}>
									<li>
										В разделе «Главные» настройте внешний вид, кнопку
										открытия и тексты формы.
									</li>
									<li>
										В «Бонусах» задайте секторы колеса, вероятность и
										активность призов.
									</li>
									<li>
										В «Интеграциях» подключите email, Telegram, webhook,
										CRM и аналитику.
									</li>
									<li>
										В «Коде» скопируйте скрипт на сайт или используйте
										прямую ссылку/QR-код.
									</li>
								</ul>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Что проверить перед запуском
									</h3>
								</div>
								<ul className={styles.infoList}>
									<li>
										Укажите понятные названия бонусов и отключите лишние
										сектора.
									</li>
									<li>
										Выберите тип контакта: телефон, email или оба поля.
									</li>
									<li>
										Настройте ограничение повторной игры, если один
										посетитель не должен крутить колесо несколько раз.
									</li>
									<li>
										После установки откройте сайт в новом окне и отправьте
										тестовую заявку.
									</li>
								</ul>
							</div>
						</div>
					)}
				</div>

				<div className={styles.stickyFooter}>
					<p
						className={`${styles.saveStatus} ${
							hasUnsavedChanges ? styles.saveStatusDirty : ''
						}`}
					>
						{hasUnsavedChanges
							? 'Есть несохранённые изменения'
							: 'Изменений нет'}
					</p>
					<div className={styles.footerActions}>
						<button
							type="button"
							className={styles.cancelBtn}
							onClick={onClose}
							disabled={saveMutation.isPending}
						>
							Отмена
						</button>
						<button
							type="button"
							className={styles.saveBtn}
							onClick={handleSave}
							disabled={saveMutation.isPending || !hasUnsavedChanges}
						>
							{saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default WheelSettingsModal
