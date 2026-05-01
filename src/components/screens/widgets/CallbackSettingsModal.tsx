'use client'

import callbackService from '@/services/callback/callback.service'
import {
	Callback,
	CallbackConfig
} from '@/services/callback/callback.types'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import toast from 'react-hot-toast'
import DirectLinkQr from './DirectLinkQr'
import styles from './CallbackSettingsModal.module.scss'

type Tab = 'main' | 'form' | 'integrations' | 'code' | 'info'

interface Props {
	callback: Callback
	onClose: () => void
	onSaved: (updated: Callback) => void
}

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Главные' },
	{ id: 'form', label: 'Форма' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Код' },
	{ id: 'info', label: 'Инфо' }
]

const DEFAULT_CONFIG: CallbackConfig = {
	color: '#4705fb',
	bgColor: '',
	buttonColor: '',
	openButtonColor: '',
	buttonSide: 'right',
	buttonPulse: true,
	buttonBottom: 3,
	buttonOffset: 3,
	buttonSize: 60,
	autoOpenDelay: null,
	bubbleEnabled: true,
	bubbleText: 'Перезвоним!',
	title: 'Заказать звонок',
	subtitle: 'Оставьте номер телефона — мы перезвоним в удобное время',
	submitButtonText: 'Заказать звонок',
	successTitle: 'Спасибо! Мы перезвоним',
	successSubtitle: 'Ожидайте звонка в выбранное время',
	privacyUrl:
		'https://winwidget.ru/legal-documentation/consent-processing',
	developInfoActive: true,
	filterDuplicates: false,
	timeSlots: [
		'9:00–11:00',
		'11:00–13:00',
		'13:00–15:00',
		'15:00–17:00',
		'17:00–19:00'
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

const getDefaultConfig = (): CallbackConfig => ({
	...DEFAULT_CONFIG,
	timeSlots: [...DEFAULT_CONFIG.timeSlots],
	integrations: { ...DEFAULT_CONFIG.integrations }
})

const CallbackSettingsModal = ({ callback, onClose, onSaved }: Props) => {
	const titleId = useId()
	const [tab, setTab] = useState<Tab>('main')
	const [cfg, setCfg] = useState<CallbackConfig>({ ...callback.config })
	const [name, setName] = useState(callback.name)
	const [installDomain, setInstallDomain] = useState(
		callback.installDomain ?? ''
	)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [savedSnapshot, setSavedSnapshot] = useState(
		JSON.stringify({
			name: callback.name,
			installDomain: callback.installDomain ?? '',
			config: callback.config
		})
	)
	const currentSnapshot = JSON.stringify({
		name,
		installDomain,
		config: cfg
	})
	const hasUnsavedChanges = currentSnapshot !== savedSnapshot

	const mutation = useMutation({
		mutationFn: (data?: {
			name: string
			installDomain?: string
			config: CallbackConfig
		}) =>
			callbackService.updateCallback(callback.id, {
				name: data?.name ?? name,
				installDomain: data?.installDomain ?? installDomain,
				config: data?.config ?? cfg
			}),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			toast.success('Сохранено', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setCfg(updated.config)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: updated.config
				})
			)
			onSaved(updated)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка сохранения', {
				id: toastId
			})
		}
	})

	const set = (patch: Partial<CallbackConfig>) =>
		setCfg(prev => ({ ...prev, ...patch }))

	const setIntegration = (key: string, value: string | boolean) =>
		setCfg(prev => ({
			...prev,
			integrations: { ...(prev.integrations || {}), [key]: value }
		}))

	const apiUrl =
		process.env.NEXT_PUBLIC_MODE === 'production'
			? process.env.NEXT_PUBLIC_PRODUCTION_HOST ||
				'https://api.winwidget.ru'
			: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'
	const publicSiteUrl = (
		process.env.NEXT_PUBLIC_SITE_URL ||
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? 'https://winwidget.ru'
			: '')
	).replace(/\/$/, '')

	const embedCode = `<script src="${apiUrl}/widgets/callback.js" data-key="${callback.publicKey}" async></script>`
	const previewUrl = `${publicSiteUrl}/page-callback/${callback.publicKey}`
	const bubbleText = cfg.bubbleText ?? DEFAULT_CONFIG.bubbleText

	const addSlot = () => set({ timeSlots: [...(cfg.timeSlots || []), ''] })

	const updateSlot = (i: number, val: string) => {
		const slots = [...(cfg.timeSlots || [])]
		slots[i] = val
		set({ timeSlots: slots })
	}

	const removeSlot = (i: number) => {
		const slots = [...(cfg.timeSlots || [])]
		slots.splice(i, 1)
		set({ timeSlots: slots })
	}

	const handleResetDefaults = () => {
		const resetConfig = getDefaultConfig()
		setCfg(resetConfig)
		setConfirmResetDefaults(false)
		mutation.mutate({ name, config: resetConfig })
	}

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть"
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
					aria-label="Закрыть"
				>
					✕
				</button>

				<h2 id={titleId} className={styles.modalTitle}>
					Настройки
				</h2>

				<div className={styles.tabs} role="tablist">
					{TABS.map(t => (
						<button
							key={t.id}
							role="tab"
							aria-selected={tab === t.id}
							className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
							onClick={() => setTab(t.id)}
						>
							{t.label}
						</button>
					))}
				</div>

				<div className={styles.tabContent}>
					{/* ── Основное ── */}
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
										maxLength={15}
									/>
									<p className={styles.hint}>
										Отображается только в вашем кабинете.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Основной цвет:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={cfg.color || '#4705fb'}
											onChange={e => set({ color: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.color || '#4705fb'}
											onChange={e => set({ color: e.target.value })}
											placeholder="#4705fb"
										/>
										{cfg.color && cfg.color !== '#4705fb' && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ color: '#4705fb' })}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет плавающей кнопки и акцентов внутри формы.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет фона формы:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={cfg.bgColor || '#ffffff'}
											onChange={e => set({ bgColor: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.bgColor || ''}
											onChange={e => set({ bgColor: e.target.value })}
											placeholder="#ffffff"
										/>
										{cfg.bgColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ bgColor: '' })}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет фона окна формы. Оставьте пустым для стандартного
										белого.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет кнопки открытия:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={cfg.openButtonColor || cfg.color || '#4705fb'}
											onChange={e =>
												set({ openButtonColor: e.target.value })
											}
										/>
										<input
											className={styles.input}
											value={cfg.openButtonColor || ''}
											onChange={e =>
												set({ openButtonColor: e.target.value })
											}
											placeholder="По умолчанию — основной цвет"
											maxLength={7}
										/>
										{cfg.openButtonColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ openButtonColor: '' })}
												title="Сбросить"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет плавающей кнопки, которая открывает виджет.
										Оставьте пустым, чтобы использовать основной цвет.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Сторона экрана:</p>
									<select
										className={styles.input}
										value={cfg.buttonSide}
										onChange={e =>
											set({
												buttonSide: e.target.value as 'left' | 'right'
											})
										}
									>
										<option value="right">Справа</option>
										<option value="left">Слева</option>
									</select>
									<p className={styles.hint}>
										С какой стороны экрана будет показана кнопка.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет кнопки отправки:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={cfg.buttonColor || cfg.color || '#4705fb'}
											onChange={e => set({ buttonColor: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.buttonColor || ''}
											onChange={e => set({ buttonColor: e.target.value })}
											placeholder="По умолчанию — основной цвет"
										/>
										{cfg.buttonColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ buttonColor: '' })}
												title="Сбросить"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет кнопки «Заказать звонок» внутри формы. Оставьте
										пустым для использования основного цвета.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Размер кнопки открытия:{' '}
										<strong>{cfg.buttonSize ?? 60}px</strong>
									</p>
									<input
										type="range"
										min={40}
										max={100}
										value={cfg.buttonSize ?? 60}
										onChange={e =>
											set({
												buttonSize: parseInt(e.target.value) || 60
											})
										}
										className={styles.input}
										style={{
											padding: '8px 0',
											background: 'transparent',
											border: 'none'
										}}
									/>
									<p className={styles.hint}>
										Размер плавающей кнопки в пикселях. По умолчанию 60px.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Высота кнопки от низа экрана:{' '}
										<strong>{cfg.buttonBottom ?? 3}%</strong>
									</p>
									<input
										type="range"
										min={1}
										max={50}
										value={cfg.buttonBottom ?? 3}
										onChange={e =>
											set({
												buttonBottom: parseFloat(e.target.value) || 3
											})
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
										<strong>{cfg.buttonOffset ?? 3}%</strong>
									</p>
									<input
										type="range"
										min={1}
										max={50}
										value={cfg.buttonOffset ?? 3}
										onChange={e =>
											set({
												buttonOffset: parseFloat(e.target.value) || 3
											})
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
									<div className={styles.checkRow}>
										<input
											id="cbPulse"
											type="checkbox"
											checked={cfg.buttonPulse !== false}
											onChange={e =>
												set({ buttonPulse: e.target.checked })
											}
										/>
										<label htmlFor="cbPulse" className={styles.checkLabel}>
											Пульсация кнопки
										</label>
									</div>
									<p className={styles.hint}>
										Дополнительный эффект свечения на плавающей кнопке.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Автооткрытие
									</h3>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Задержка автооткрытия (секунд):
									</p>
									<input
										type="number"
										className={styles.input}
										value={cfg.autoOpenDelay ?? ''}
										min={0}
										placeholder="Не открывать автоматически"
										onChange={e =>
											set({
												autoOpenDelay: e.target.value
													? parseInt(e.target.value)
													: null
											})
										}
									/>
									<p className={styles.hint}>
										Через сколько секунд виджет откроется автоматически.
										Оставьте пустым для отключения.
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
									{!confirmResetDefaults ? (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmResetDefaults(true)}
										>
											Сбросить все настройки до значений по умолчанию
										</button>
									) : (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Все настройки обратного звонка будут заменены на
												стандартные. Действие необратимо после сохранения.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													disabled={mutation.isPending}
													onClick={handleResetDefaults}
												>
													Да, сбросить
												</button>
												<button
													type="button"
													className={styles.cancelBtn}
													onClick={() => setConfirmResetDefaults(false)}
												>
													Отмена
												</button>
											</div>
										</div>
									)}
									<p className={styles.hint}>
										Сбросит цвета, тексты, слоты времени, автооткрытие,
										интеграции и фильтр дублей. Название в кабинете не
										изменится.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* ── Форма ── */}
					{tab === 'form' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Тексты кнопки и формы
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Отображение облачка:</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="callbackBubbleEnabled"
											checked={cfg.bubbleEnabled ?? true}
											onChange={e =>
												set({ bubbleEnabled: e.target.checked })
											}
										/>
										<label
											htmlFor="callbackBubbleEnabled"
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
										value={bubbleText}
										onChange={e => set({ bubbleText: e.target.value })}
										placeholder="Перезвоним!"
										maxLength={60}
									/>
									<p className={styles.hint}>
										Короткая фраза рядом с плавающей кнопкой. Она помогает
										объяснить, зачем нажимать на кнопку.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Заголовок формы:</p>
									<input
										className={styles.input}
										value={cfg.title}
										onChange={e => set({ title: e.target.value })}
										placeholder="Заказать звонок"
									/>
									<p className={styles.hint}>
										Крупный заголовок внутри окна обратного звонка.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Описание формы:</p>
									<input
										className={styles.input}
										value={cfg.subtitle}
										onChange={e => set({ subtitle: e.target.value })}
										placeholder="Оставьте номер — перезвоним в удобное время"
									/>
									<p className={styles.hint}>
										Описание под заголовком формы.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Текст кнопки отправки:</p>
									<input
										className={styles.input}
										value={cfg.submitButtonText}
										onChange={e =>
											set({ submitButtonText: e.target.value })
										}
										placeholder="Заказать звонок"
									/>
									<p className={styles.hint}>
										Текст кнопки, на которую нажимает посетитель.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Экран успеха
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Заголовок:</p>
									<input
										className={styles.input}
										value={cfg.successTitle}
										onChange={e => set({ successTitle: e.target.value })}
										placeholder="Спасибо! Мы перезвоним"
									/>
									<p className={styles.hint}>
										Крупный текст на экране подтверждения.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Подзаголовок:</p>
									<input
										className={styles.input}
										value={cfg.successSubtitle}
										onChange={e =>
											set({ successSubtitle: e.target.value })
										}
										placeholder="Ожидайте звонка в выбранное время"
									/>
									<p className={styles.hint}>
										Дополнительный текст под заголовком экрана успеха.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Слоты времени
									</h3>
								</div>

								<div className={styles.slotList}>
									{(cfg.timeSlots || []).map((slot, i) => (
										<div key={i} className={styles.slotRow}>
											<input
												className={styles.slotInput}
												value={slot}
												onChange={e => updateSlot(i, e.target.value)}
												placeholder="Например: 10:00–12:00"
											/>
											<button
												type="button"
												className={styles.removeBtn}
												onClick={() => removeSlot(i)}
												aria-label="Удалить слот"
											>
												✕
											</button>
										</div>
									))}
								</div>

								<button
									type="button"
									className={styles.addBtn}
									onClick={addSlot}
								>
									+ Добавить слот
								</button>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>Телефон</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ссылка на политику конфиденциальности:
									</p>
									<input
										className={styles.input}
										value={cfg.privacyUrl}
										onChange={e => set({ privacyUrl: e.target.value })}
										placeholder="https://example.com/privacy"
									/>
									<p className={styles.hint}>
										По умолчанию ведёт на нашу политику. Замените на ссылку
										своей политики конфиденциальности.
									</p>
								</div>

								<details className={styles.advancedBlock}>
									<summary className={styles.advancedSummary}>
										Дополнительно
									</summary>
									<div className={styles.advancedContent}>
										<div className={styles.field}>
											<div className={styles.checkRow}>
												<input
													id="cbFilterDuplicates"
													type="checkbox"
													checked={cfg.filterDuplicates === true}
													onChange={e =>
														set({ filterDuplicates: e.target.checked })
													}
												/>
												<label
													htmlFor="cbFilterDuplicates"
													className={styles.checkLabel}
												>
													Фильтровать дубли (один звонок с устройства)
												</label>
											</div>
											<p className={styles.hint}>
												Если посетитель уже оставлял заявку с этого
												устройства — повторная не будет сохранена.
											</p>
										</div>
									</div>
								</details>
							</div>
						</div>
					)}

					{/* ── Интеграции ── */}
					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Уведомления
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Email для заявок:</p>
									<input
										type="email"
										className={styles.input}
										value={cfg.integrations?.email || ''}
										onChange={e => setIntegration('email', e.target.value)}
										placeholder="you@example.com"
									/>
									<p className={styles.hint}>
										Уведомление о каждой новой заявке придёт на этот email.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Telegram chat ID:</p>
									<input
										className={styles.input}
										value={cfg.integrations?.telegramChatId || ''}
										onChange={e =>
											setIntegration('telegramChatId', e.target.value)
										}
										placeholder="-100xxxxxxxxxx"
									/>
									<p className={styles.hint}>
										Напишите боту <b>@winwidget_bot</b> команду /start,
										затем укажите сюда ваш Telegram ID. Узнать ID можно
										через бот <b>@getmyid_bot</b>.
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
									<p className={styles.label}>Внешний URL (Webhook):</p>
									<input
										className={styles.input}
										value={cfg.integrations?.webhookUrl || ''}
										onChange={e =>
											setIntegration('webhookUrl', e.target.value)
										}
										placeholder="https://example.com/webhook"
									/>
									<p className={styles.hint}>
										POST-запрос с полями: <b>phone</b>, <b>timeSlot</b>,{' '}
										<b>timezone</b>, <b>url</b>, <b>time</b>.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Битрикс24 — входящий webhook:
									</p>
									<input
										className={styles.input}
										value={cfg.integrations?.bitrix24WebhookUrl || ''}
										onChange={e =>
											setIntegration('bitrix24WebhookUrl', e.target.value)
										}
										placeholder="https://b24-xxxxx.bitrix24.ru/rest/1/key/"
									/>
									<p className={styles.hint}>
										Укажите URL входящего вебхука из Битрикс24. Новые
										заявки будут создаваться как лиды в CRM.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>amoCRM — домен аккаунта:</p>
									<input
										className={styles.input}
										value={cfg.integrations?.amoCrmDomain || ''}
										onChange={e =>
											setIntegration('amoCrmDomain', e.target.value)
										}
										placeholder="example.amocrm.ru"
									/>
									<p className={styles.hint}>
										Домен вашего аккаунта amoCRM, например{' '}
										<b>mycompany.amocrm.ru</b>.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>amoCRM — токен доступа:</p>
									<input
										type="password"
										className={styles.input}
										value={cfg.integrations?.amoCrmToken || ''}
										onChange={e =>
											setIntegration('amoCrmToken', e.target.value)
										}
										placeholder="Долгосрочный токен из настроек API"
									/>
									<p className={styles.hint}>
										Перейдите в amoCRM → Настройки → Интеграции → API →
										скопируйте долгосрочный токен.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>Аналитика</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Яндекс Метрика — ID счётчика:
									</p>
									<input
										className={styles.input}
										value={cfg.integrations?.yandexMetrikaId || ''}
										onChange={e =>
											setIntegration('yandexMetrikaId', e.target.value)
										}
										placeholder="12345678"
									/>
									<p className={styles.hint}>
										При открытии виджета отправляется цель <b>wcb_open</b>,
										при отправке заявки — <b>wcb_send</b>. Счётчик должен
										быть установлен на странице сайта.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ретаргетинг ВКонтакте — ID пикселя:
									</p>
									<input
										className={styles.input}
										value={cfg.integrations?.vkPixelId || ''}
										onChange={e =>
											setIntegration('vkPixelId', e.target.value)
										}
										placeholder="VK-RTRG-000000-xxxxx"
									/>
									<p className={styles.hint}>
										При открытии виджета отправляется событие{' '}
										<b>wcb_open</b>, при отправке заявки — <b>wcb_send</b>.
										Пиксель VK должен быть установлен на странице сайта.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Roistat:</p>
									<div className={styles.checkRow}>
										<input
											id="cbRoistat"
											type="checkbox"
											checked={cfg.integrations?.roistatEnabled || false}
											onChange={e =>
												setIntegration('roistatEnabled', e.target.checked)
											}
										/>
										<label
											htmlFor="cbRoistat"
											className={styles.checkLabel}
										>
											Включить отправку целей в Roistat
										</label>
									</div>
									<p className={styles.hint}>
										При открытии виджета отправляется цель <b>wcb_open</b>,
										при отправке заявки — <b>wcb_send</b>. Код Roistat
										должен быть подключён на странице сайта.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* ── Код ── */}
					{tab === 'code' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Установка на сайт
									</h3>
								</div>

								<div className={styles.field}>
									<label
										className={styles.label}
										htmlFor={`${titleId}-install-domain`}
									>
										Домен установки виджета
									</label>
									<input
										id={`${titleId}-install-domain`}
										className={styles.input}
										value={installDomain}
										placeholder="site.ru"
										onChange={e => setInstallDomain(e.target.value)}
									/>
									<div className={styles.domainHint}>
										<p>
											Указанный домен сайта и сайт, на котором фактически
											будет добавлен код виджета, должны совпадать, иначе
											виджет не появится после добавления кода.
										</p>
										<p>
											Прямая ссылка и QR-код работают без указания домена.
										</p>
										<p>
											Формат добавления домена: https://page.example.ru,
											https://example.ru, www.example.ru, example.ru
										</p>
									</div>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Скрипт для вставки на сайт:
									</p>
									<textarea
										readOnly
										className={`${styles.input} ${styles.codeArea}`}
										rows={3}
										value={embedCode}
										onClick={e =>
											(e.target as HTMLTextAreaElement).select()
										}
									/>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() => {
											navigator.clipboard.writeText(embedCode)
											toast.success('Скопировано!')
										}}
									>
										Копировать код
									</button>
									<p className={styles.hint}>
										Вставьте этот код перед закрывающим тегом &lt;/body&gt;
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Прямая ссылка
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Прямая ссылка на виджет:</p>
									<div className={styles.directLink}>
										<input
											className={styles.input}
											readOnly
											value={previewUrl}
											onClick={e =>
												(e.target as HTMLInputElement).select()
											}
										/>
										<a
											href={previewUrl}
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
											navigator.clipboard.writeText(previewUrl)
											toast.success('Скопировано!')
										}}
									>
										Копировать ссылку
									</button>
									<p className={styles.hint}>
										Используйте, если не нужно подключать виджет к сайту —
										подходит для рассылок, рекламы и мессенджеров.
									</p>
									<DirectLinkQr
										value={previewUrl}
										downloadName={`winwidget-callback-${callback.publicKey}.png`}
									/>
								</div>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Как работает обратный звонок
									</h3>
								</div>
								<p className={styles.infoText}>
									Виджет открывает форму заказа звонка. Посетитель
									оставляет телефон, при необходимости выбирает удобное
									время, а заявка сохраняется в кабинете и отправляется в
									подключённые каналы.
								</p>
								<ul className={styles.infoList}>
									<li>
										В «Главных» настройте кнопку, положение, цвета и тексты
										окна.
									</li>
									<li>
										В «Форме» задайте поля, тексты успеха и варианты
										времени звонка.
									</li>
									<li>
										В «Интеграциях» подключите уведомления, CRM, webhook и
										аналитику.
									</li>
									<li>
										В «Коде» установите виджет на сайт или используйте
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
										Проверьте номер телефона в тестовой заявке и выбранный
										временной слот.
									</li>
									<li>
										Убедитесь, что заявки приходят в нужный email, Telegram
										или CRM.
									</li>
									<li>
										Настройте защиту от дублей, если повторные заявки от
										одного контакта нежелательны.
									</li>
									<li>
										Проверьте мобильную версию: кнопка должна быть заметной
										и не мешать покупке.
									</li>
								</ul>
							</div>
						</div>
					)}
				</div>

				<div className={styles.stickyFooter}>
					<p
						className={`${styles.saveStatus} ${hasUnsavedChanges ? styles.saveStatusDirty : ''}`}
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
							disabled={mutation.isPending}
						>
							Отмена
						</button>
						<button
							type="button"
							className={styles.saveBtn}
							disabled={mutation.isPending || !hasUnsavedChanges}
							onClick={() => mutation.mutate(undefined)}
						>
							{mutation.isPending ? 'Сохранение...' : 'Сохранить'}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default CallbackSettingsModal
