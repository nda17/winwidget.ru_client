'use client'

import { useProfileEdit } from '@/components/screens/profile/useProfileEdit'
import { useProfileIdentityBinding } from '@/components/screens/profile/useProfileIdentityBinding'
import FieldUploadFile from '@/components/ui/form-elements/universal-elements/field-upload-file/FieldUploadFile'
import { usePhoneMask } from '@/hooks/usePhoneMask'
import useUser from '@/hooks/useUser'
import fileService from '@/services/file/file.service'
import userService, {
	IProfileEditInput
} from '@/services/user/user.service'
import {
	validEmail,
	validName,
	validPassword,
	validPhone,
	validPhoneCode
} from '@/shared/regex'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import styles from './Cabinet.module.scss'

type EmailBindingForm = { email: string; code: string }
type PhoneBindingForm = { phone: string; code: string }

const DEFAULT_AVATAR = '/avatar-default.png'

const isManagedAvatarFile = (avatarPath?: string | null) => {
	return Boolean(
		avatarPath &&
		avatarPath !== DEFAULT_AVATAR &&
		(avatarPath.startsWith('/uploads/') ||
			avatarPath.includes('/user-avatar/'))
	)
}

const deleteAvatarFileSilently = async (avatarPath?: string | null) => {
	if (!isManagedAvatarFile(avatarPath)) return

	try {
		await fileService.delete(avatarPath)
	} catch {
		// файл мог быть уже удалён или недоступен — профиль уже обновлён
	}
}

const CabinetProfile = () => {
	const { user } = useUser()
	const queryClient = useQueryClient()
	const { onSubmit, isLoading: isSaving } = useProfileEdit()
	const hasPaymentContact = Boolean(user?.email || user?.phone)
	const hasTelegram = Boolean(user?.loginMethods?.includes('TELEGRAM'))
	const shouldShowPaymentContactNotice = Boolean(
		user && hasTelegram && !hasPaymentContact
	)
	const [telegramBindingUrl, setTelegramBindingUrl] = useState('')
	const [telegramNotificationsUrl, setTelegramNotificationsUrl] =
		useState('')
	const { data: telegramNotifications } = useQuery({
		queryKey: ['profile-telegram-notifications'],
		queryFn: () => userService.fetchProfileTelegramNotifications(),
		enabled: Boolean(user)
	})
	const hasTelegramNotifications = Boolean(
		telegramNotifications?.connected
	)
	const isTelegramNotificationsConfigured = telegramNotifications
		? Boolean(
				telegramNotifications.telegramBotTokenConfigured &&
				telegramNotifications.telegramBotUsernameConfigured
			)
		: true

	const handleDeleteAvatar = async () => {
		const currentAvatar = user?.avatarPath
		await userService.updateProfile({ avatarPath: null })
		await queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		await deleteAvatarFileSilently(currentAvatar)
	}

	const handleUploadAvatar = async (avatarPath: string) => {
		const previousAvatar = user?.avatarPath

		try {
			await userService.updateProfile({ avatarPath })
		} catch (error) {
			await deleteAvatarFileSilently(avatarPath)
			throw error
		}

		await queryClient.invalidateQueries({ queryKey: ['get-profile'] })

		if (previousAvatar !== avatarPath) {
			await deleteAvatarFileSilently(previousAvatar)
		}
	}
	const {
		emailCodeRequested,
		phoneCodeRequested,
		isSendingEmailCode,
		isVerifyingEmailCode,
		isSendingPhoneCode,
		isVerifyingPhoneCode,
		telegramBindingRequested,
		telegramNotificationsBindingRequested,
		isStartingTelegramBinding,
		isStartingTelegramNotifications,
		requestEmailCode,
		confirmEmailCode,
		requestPhoneCode,
		confirmPhoneCode,
		requestTelegramBinding,
		requestTelegramNotificationsBinding,
		resetEmailBinding,
		resetPhoneBinding
	} = useProfileIdentityBinding()

	// ── Main profile form ──────────────────────────────────────────
	const {
		handleSubmit,
		register,
		reset,
		control,
		formState: { errors }
	} = useForm<IProfileEditInput>({ mode: 'onChange' })

	const handleProfileSubmit = handleSubmit(async data => {
		const ok = await onSubmit(data)
		if (ok) reset({ name: data.name || '', password: '' })
	})

	// ── Email binding form ─────────────────────────────────────────
	const {
		register: regEmail,
		handleSubmit: handleEmailSubmit,
		reset: resetEmailForm,
		trigger: triggerEmail,
		watch: watchEmail,
		formState: { errors: emailErrors }
	} = useForm<EmailBindingForm>({
		mode: 'onChange',
		defaultValues: { email: '', code: '' }
	})

	const emailValue = watchEmail('email')

	const handleEmailCodeRequest = async () => {
		const ok = await triggerEmail('email')
		if (!ok) return
		const sent = await requestEmailCode(emailValue.trim())
		if (sent) resetEmailForm({ email: emailValue.trim(), code: '' })
	}

	const handleEmailVerify = handleEmailSubmit(async data => {
		const ok = await confirmEmailCode({
			email: data.email.trim(),
			code: data.code.trim()
		})
		if (ok) {
			resetEmailForm({ email: '', code: '' })
			resetEmailBinding()
		}
	})

	const resetEmailFlow = () => {
		resetEmailForm({ email: '', code: '' })
		resetEmailBinding()
	}

	// ── Phone binding form ─────────────────────────────────────────
	const {
		register: regPhone,
		handleSubmit: handlePhoneSubmit,
		reset: resetPhoneForm,
		trigger: triggerPhone,
		watch: watchPhone,
		setValue: setPhoneValue,
		formState: { errors: phoneErrors }
	} = useForm<PhoneBindingForm>({
		mode: 'onChange',
		defaultValues: { phone: '', code: '' }
	})

	const phoneInputRef = useRef<HTMLInputElement>(null)
	const phoneMask = usePhoneMask(setPhoneValue, phoneInputRef)
	const phoneValue = watchPhone('phone')

	const handlePhoneCodeRequest = async () => {
		const ok = await triggerPhone('phone')
		if (!ok) return
		const sent = await requestPhoneCode(phoneValue.trim())
		if (sent) resetPhoneForm({ phone: phoneValue.trim(), code: '' })
	}

	const handlePhoneVerify = handlePhoneSubmit(async data => {
		const ok = await confirmPhoneCode({
			phone: data.phone.trim(),
			code: data.code.trim()
		})
		if (ok) {
			resetPhoneForm({ phone: '', code: '' })
			phoneMask.reset()
			resetPhoneBinding()
		}
	})

	const resetPhoneFlow = () => {
		resetPhoneForm({ phone: '', code: '' })
		phoneMask.reset()
		resetPhoneBinding()
	}

	const handleTelegramBindingStart = async () => {
		let telegramWindow: Window | null = null

		if (typeof window !== 'undefined') {
			telegramWindow = window.open('about:blank', '_blank')
		}

		const data = await requestTelegramBinding()

		if (!data) {
			telegramWindow?.close()
			return
		}

		setTelegramBindingUrl(data.botUrl)

		if (telegramWindow) {
			telegramWindow.location.href = data.botUrl
		} else if (typeof window !== 'undefined') {
			window.open(data.botUrl, '_blank', 'noopener,noreferrer')
		}
	}

	const handleTelegramStatusCheck = async () => {
		await queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		toast.success('Статус профиля обновлён')
	}

	const handleTelegramNotificationsStart = async () => {
		let telegramWindow: Window | null = null

		if (typeof window !== 'undefined') {
			telegramWindow = window.open('about:blank', '_blank')
		}

		const data = await requestTelegramNotificationsBinding()

		if (!data) {
			telegramWindow?.close()
			return
		}

		setTelegramNotificationsUrl(data.botUrl)

		if (telegramWindow) {
			telegramWindow.location.href = data.botUrl
		} else if (typeof window !== 'undefined') {
			window.open(data.botUrl, '_blank', 'noopener,noreferrer')
		}
	}

	const handleTelegramNotificationsStatusCheck = async () => {
		await queryClient.invalidateQueries({
			queryKey: ['profile-telegram-notifications']
		})
		toast.success('Статус Telegram-уведомлений обновлён')
	}

	const phoneRegistration = regPhone('phone', {
		required: 'Введите номер телефона',
		pattern: { value: validPhone, message: 'Проверьте правильность ввода' }
	})

	return (
		<div>
			{/* ── Profile edit ──────────────────────────────────────── */}
			<div className={styles.section}>
				<p className={styles.sectionTitle}>Редактирование профиля</p>
				<form onSubmit={handleProfileSubmit}>
					<div className={styles.field}>
						<p className={styles.label}>Фото профиля</p>
						<Controller
							control={control}
							name="avatarPath"
							render={({ field: { value, onChange } }) => (
								<FieldUploadFile
									onChange={onChange}
									value={value}
									currentFile={user?.avatarPath || DEFAULT_AVATAR}
									folder="user-avatar"
									placeholder="Фото профиля"
									canDelete
									onUploadComplete={handleUploadAvatar}
									uploadSuccessMessage="Фото профиля обновлено"
									onDelete={handleDeleteAvatar}
								/>
							)}
						/>
					</div>

					<div className={styles.field}>
						<label htmlFor="profile-name" className={styles.label}>
							Имя
						</label>
						<input
							id="profile-name"
							className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
							placeholder="Имя"
							defaultValue={user?.name || ''}
							{...register('name', {
								pattern: {
									value: validName,
									message: 'Мин. длина 2 символа'
								}
							})}
							aria-describedby={
								errors.name ? 'profile-name-error' : undefined
							}
						/>
						{errors.name && (
							<span id="profile-name-error" className={styles.errorMsg}>
								{errors.name.message}
							</span>
						)}
					</div>

					<div className={styles.field}>
						<label htmlFor="profile-password" className={styles.label}>
							Новый пароль
						</label>
						<input
							id="profile-password"
							type="password"
							className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
							placeholder="Введите новый пароль"
							{...register('password', {
								pattern: {
									value: validPassword,
									message:
										'Мин. 6 символов: цифра, строчная и заглавная буква'
								}
							})}
							aria-describedby={
								errors.password ? 'profile-password-error' : undefined
							}
						/>
						{errors.password && (
							<span
								id="profile-password-error"
								className={styles.errorMsg}
							>
								{errors.password.message}
							</span>
						)}
					</div>

					<button type="submit" className={styles.btn} disabled={isSaving}>
						{isSaving ? 'Сохранение...' : 'Сохранить'}
					</button>
				</form>
			</div>

			{/* ── Identity binding ─────────────────────────────────── */}
			<div className={styles.section}>
				<p className={styles.sectionTitle}>Способы входа</p>
				{shouldShowPaymentContactNotice && (
					<div className={styles.paymentContactNotice}>
						<p className={styles.paymentContactNoticeTitle}>
							Для оплаты привяжите email или телефон
						</p>
						<p className={styles.paymentContactNoticeText}>
							Telegram подходит для входа, но для создания платежа нужен
							подтверждённый email или телефон в профиле.
						</p>
					</div>
				)}
				<div className={styles.identityGrid}>
					{/* Email */}
					<form
						onSubmit={handleEmailVerify}
						className={styles.identityCard}
					>
						<p className={styles.identityTitle}>Email</p>
						<p className={styles.identityDesc}>
							{user?.email
								? `Текущий: ${user.email}`
								: 'Добавьте email для входа.'}
						</p>
						<div className={styles.field}>
							<input
								className={`${styles.input} ${emailErrors.email ? styles.inputError : ''}`}
								placeholder={user?.email ? 'Новый email' : 'Email'}
								{...regEmail('email', {
									required: 'Введите email',
									pattern: {
										value: validEmail,
										message: 'Проверьте правильность ввода'
									}
								})}
							/>
							{emailErrors.email && (
								<span className={styles.errorMsg}>
									{emailErrors.email.message}
								</span>
							)}
						</div>

						{emailCodeRequested && (
							<div className={styles.field}>
								<input
									className={`${styles.input} ${emailErrors.code ? styles.inputError : ''}`}
									placeholder="Код из email"
									{...regEmail('code', {
										required: 'Введите код',
										pattern: {
											value: validPhoneCode,
											message: 'Введите корректный код'
										}
									})}
								/>
								{emailErrors.code && (
									<span className={styles.errorMsg}>
										{emailErrors.code.message}
									</span>
								)}
								<span className={styles.hint}>
									Код отправлен на {emailValue}
								</span>
							</div>
						)}

						<div className={styles.btnRow}>
							<button
								type="button"
								className={styles.btn}
								disabled={isSendingEmailCode || isVerifyingEmailCode}
								onClick={handleEmailCodeRequest}
							>
								{isSendingEmailCode
									? 'Отправка...'
									: emailCodeRequested
										? 'Отправить повторно'
										: user?.email
											? 'Сменить email'
											: 'Привязать email'}
							</button>
							{emailCodeRequested && (
								<button
									type="submit"
									className={styles.btnOutline}
									disabled={isSendingEmailCode || isVerifyingEmailCode}
								>
									{isVerifyingEmailCode ? 'Проверка...' : 'Подтвердить'}
								</button>
							)}
						</div>
						{emailCodeRequested && (
							<button
								type="button"
								className={styles.resetLink}
								onClick={resetEmailFlow}
							>
								Сбросить
							</button>
						)}
					</form>

					{/* Phone */}
					<form
						onSubmit={handlePhoneVerify}
						className={styles.identityCard}
					>
						<p className={styles.identityTitle}>Телефон</p>
						<p className={styles.identityDesc}>
							{user?.phone
								? `Текущий: ${user.phone}`
								: 'Добавьте телефон для входа.'}
						</p>
						<div className={styles.field}>
							<input
								className={`${styles.input} ${phoneErrors.phone ? styles.inputError : ''}`}
								placeholder={
									phoneMask.isMaskEmpty ? '+7 (9__)' : undefined
								}
								{...phoneRegistration}
								ref={el => {
									phoneRegistration.ref(el)
									phoneInputRef.current = el
								}}
								onFocus={phoneMask.onFocus}
								onClick={phoneMask.onClick}
								onKeyDown={phoneMask.onKeyDown}
								onBeforeInput={phoneMask.onBeforeInput}
								onInput={phoneMask.onInput}
								onPaste={phoneMask.onPaste}
								onBlur={e => {
									phoneMask.onBlur(e)
									phoneRegistration.onBlur(e)
								}}
							/>
							{phoneErrors.phone && (
								<span className={styles.errorMsg}>
									{phoneErrors.phone.message}
								</span>
							)}
						</div>

						{phoneCodeRequested && (
							<div className={styles.field}>
								<input
									className={`${styles.input} ${phoneErrors.code ? styles.inputError : ''}`}
									placeholder="Код из SMS"
									{...regPhone('code', {
										required: 'Введите код',
										pattern: {
											value: validPhoneCode,
											message: 'Введите корректный код'
										}
									})}
								/>
								{phoneErrors.code && (
									<span className={styles.errorMsg}>
										{phoneErrors.code.message}
									</span>
								)}
								<span className={styles.hint}>
									Код отправлен на {phoneValue}
								</span>
							</div>
						)}

						<div className={styles.btnRow}>
							<button
								type="button"
								className={styles.btn}
								disabled={isSendingPhoneCode || isVerifyingPhoneCode}
								onClick={handlePhoneCodeRequest}
							>
								{isSendingPhoneCode
									? 'Отправка...'
									: phoneCodeRequested
										? 'Отправить повторно'
										: user?.phone
											? 'Сменить телефон'
											: 'Привязать телефон'}
							</button>
							{phoneCodeRequested && (
								<button
									type="submit"
									className={styles.btnOutline}
									disabled={isSendingPhoneCode || isVerifyingPhoneCode}
								>
									{isVerifyingPhoneCode ? 'Проверка...' : 'Подтвердить'}
								</button>
							)}
						</div>
						{phoneCodeRequested && (
							<button
								type="button"
								className={styles.resetLink}
								onClick={resetPhoneFlow}
							>
								Сбросить
							</button>
						)}
					</form>

					<div className={styles.identityCard}>
						<p className={styles.identityTitle}>Telegram</p>
						<p className={styles.identityDesc}>
							{hasTelegram
								? 'Telegram-аккаунт привязан.'
								: 'Привяжите Telegram-аккаунт для быстрого входа'}
						</p>

						{telegramBindingRequested && !hasTelegram && (
							<p className={styles.hint}>
								Откройте Auth_bot, нажмите Start и кнопку привязки. После
								этого проверьте статус.
							</p>
						)}

						<div className={styles.btnRow}>
							{hasTelegram ? (
								<button
									type="button"
									className={styles.btnOutline}
									disabled
								>
									Привязан
								</button>
							) : (
								<button
									type="button"
									className={styles.btn}
									disabled={isStartingTelegramBinding}
									onClick={handleTelegramBindingStart}
								>
									{isStartingTelegramBinding
										? 'Открываем...'
										: telegramBindingRequested
											? 'Открыть Auth_bot ещё раз'
											: 'Привязать Telegram'}
								</button>
							)}

							{telegramBindingRequested && !hasTelegram && (
								<button
									type="button"
									className={styles.btnOutline}
									onClick={handleTelegramStatusCheck}
								>
									Проверить статус
								</button>
							)}
						</div>

						{telegramBindingUrl && !hasTelegram && (
							<button
								type="button"
								className={styles.resetLink}
								onClick={() => {
									if (typeof window !== 'undefined') {
										window.open(
											telegramBindingUrl,
											'_blank',
											'noopener,noreferrer'
										)
									}
								}}
							>
								Открыть ссылку вручную
							</button>
						)}
					</div>
				</div>
			</div>

			{/* ── Notifications ─────────────────────────────────── */}
			<div className={styles.section}>
				<p className={styles.sectionTitle}>Настройка уведомлений</p>
				<div className={styles.identityCard}>
					<p className={styles.identityTitle}>Telegram-уведомления</p>
					<p className={styles.identityDesc}>
						{hasTelegramNotifications
							? telegramNotifications?.username
								? `Подключены: @${telegramNotifications.username}`
								: 'Подключены через инфо-бота.'
							: 'Разрешите инфо-боту писать вам сообщения, чтобы получать заявки с виджетов и другие сервисные уведомления.'}
					</p>

					{!isTelegramNotificationsConfigured && (
						<p className={styles.hint}>
							Info_bot пока не настроен. Подключение временно недоступно.
						</p>
					)}

					{telegramNotificationsBindingRequested &&
						!hasTelegramNotifications && (
							<p className={styles.hint}>
								Откройте Info_bot, нажмите Start и после этого проверьте
								статус.
							</p>
						)}

					<div className={styles.btnRow}>
						{hasTelegramNotifications ? (
							<button type="button" className={styles.btnOutline} disabled>
								Подключены
							</button>
						) : (
							<button
								type="button"
								className={styles.btn}
								disabled={
									isStartingTelegramNotifications ||
									!isTelegramNotificationsConfigured
								}
								onClick={handleTelegramNotificationsStart}
							>
								{isStartingTelegramNotifications
									? 'Открываем...'
									: telegramNotificationsBindingRequested
										? 'Открыть Info_bot ещё раз'
										: 'Подключить уведомления'}
							</button>
						)}

						{telegramNotificationsBindingRequested &&
							!hasTelegramNotifications && (
								<button
									type="button"
									className={styles.btnOutline}
									onClick={handleTelegramNotificationsStatusCheck}
								>
									Проверить статус
								</button>
							)}
					</div>

					{telegramNotificationsUrl && !hasTelegramNotifications && (
						<button
							type="button"
							className={styles.resetLink}
							onClick={() => {
								if (typeof window !== 'undefined') {
									window.open(
										telegramNotificationsUrl,
										'_blank',
										'noopener,noreferrer'
									)
								}
							}}
						>
							Открыть ссылку вручную
						</button>
					)}
				</div>
			</div>
		</div>
	)
}

export default CabinetProfile
