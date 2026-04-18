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
import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import toast from 'react-hot-toast'
import { Controller, useForm } from 'react-hook-form'
import styles from './Cabinet.module.scss'

type EmailBindingForm = { email: string; code: string }
type PhoneBindingForm = { phone: string; code: string }

const DEFAULT_AVATAR = '/uploads/user-avatar/avatar-default.png'

const CabinetProfile = () => {
	const { user } = useUser()
	const queryClient = useQueryClient()
	const { onSubmit, isLoading: isSaving } = useProfileEdit()

	const handleDeleteAvatar = async () => {
		const currentAvatar = user?.avatarPath
		if (currentAvatar && currentAvatar.startsWith('/uploads/')) {
			try {
				await fileService.delete(currentAvatar)
			} catch {
				// файл мог быть уже удалён — продолжаем
			}
		}
		try {
			await userService.updateProfile({ avatarPath: null })
			queryClient.invalidateQueries({ queryKey: ['get-profile'] })
		} catch {
			toast.error('Не удалось удалить фото профиля')
		}
	}
	const {
		emailCodeRequested,
		phoneCodeRequested,
		isSendingEmailCode,
		isVerifyingEmailCode,
		isSendingPhoneCode,
		isVerifyingPhoneCode,
		requestEmailCode,
		confirmEmailCode,
		requestPhoneCode,
		confirmPhoneCode,
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

	const phoneRegistration = regPhone('phone', {
		required: 'Введите номер телефона',
		pattern: { value: validPhone, message: 'Проверьте правильность ввода' }
	})

	return (
		<div>
			{/* ── Identity binding ─────────────────────────────────── */}
			<div className={styles.section}>
				<p className={styles.sectionTitle}>Способы входа</p>
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
				</div>
			</div>

			{/* ── Profile edit ──────────────────────────────────────── */}
			<div className={styles.section}>
				<p className={styles.sectionTitle}>Редактирование профиля</p>
				<form onSubmit={handleProfileSubmit}>
					<div className={styles.field}>
						<label className={styles.label}>Фото профиля</label>
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
									onDelete={handleDeleteAvatar}
								/>
							)}
						/>
					</div>

					<div className={styles.field}>
						<label className={styles.label}>Имя</label>
						<input
							className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
							placeholder="Имя"
							defaultValue={user?.name || ''}
							{...register('name', {
								pattern: {
									value: validName,
									message: 'Мин. длина 2 символа'
								}
							})}
						/>
						{errors.name && (
							<span className={styles.errorMsg}>
								{errors.name.message}
							</span>
						)}
					</div>

					<div className={styles.field}>
						<label className={styles.label}>Новый пароль</label>
						<input
							type="password"
							className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
							placeholder="Оставьте пустым, чтобы не менять"
							{...register('password', {
								pattern: {
									value: validPassword,
									message:
										'Мин. 6 символов: цифра, строчная и заглавная буква'
								}
							})}
						/>
						{errors.password && (
							<span className={styles.errorMsg}>
								{errors.password.message}
							</span>
						)}
					</div>

					<button type="submit" className={styles.btn} disabled={isSaving}>
						{isSaving ? 'Сохранение...' : 'Сохранить'}
					</button>
				</form>
			</div>
		</div>
	)
}

export default CabinetProfile
