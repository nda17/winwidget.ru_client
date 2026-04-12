'use client'
import styles from '@/components/screens/profile/Profile.module.scss'
import { useProfileEdit } from '@/components/screens/profile/useProfileEdit'
import { useProfileIdentityBinding } from '@/components/screens/profile/useProfileIdentityBinding'
import FieldCode from '@/components/ui/form-elements/admin-page/field-code/FieldCode'
import FieldEmail from '@/components/ui/form-elements/admin-page/field-email/FieldEmail'
import FieldName from '@/components/ui/form-elements/admin-page/field-name/FieldName'
import FieldPassword from '@/components/ui/form-elements/admin-page/field-password/FieldPassword'
import FieldPhone from '@/components/ui/form-elements/admin-page/field-phone/FieldPhone'
import Button from '@/components/ui/form-elements/universal-elements/button/Button'
import FieldUploadFile from '@/components/ui/form-elements/universal-elements/field-upload-file/FieldUploadFile'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import UserInfo from '@/components/ui/user-info/UserInfo'
import { usePhoneMask } from '@/hooks/usePhoneMask'
import useUser from '@/hooks/useUser'
import { IProfileEditInput } from '@/services/user/user.service'
import {
	validEmail,
	validName,
	validPassword,
	validPhone,
	validPhoneCode
} from '@/shared/regex'
import { clsx } from 'clsx'
import { NextPage } from 'next'
import { useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'

type EmailBindingForm = {
	email: string
	code: string
}

type PhoneBindingForm = {
	phone: string
	code: string
}

const Profile: NextPage = () => {
	const { user, isLoading } = useUser()
	const { onSubmit, isLoading: isProfileUpdateLoading } = useProfileEdit()
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
	const {
		handleSubmit,
		register,
		control,
		reset,
		formState: { errors }
	} = useForm<IProfileEditInput>({ mode: 'onChange' })
	const {
		register: registerEmailBinding,
		handleSubmit: handleEmailBindingSubmit,
		reset: resetEmailBindingForm,
		trigger: triggerEmailBinding,
		watch: watchEmailBinding,
		formState: {
			errors: emailBindingErrors,
			touchedFields: emailBindingTouchedFields,
			isSubmitted: isEmailBindingSubmitted
		}
	} = useForm<EmailBindingForm>({
		mode: 'onChange',
		defaultValues: {
			email: user?.email || '',
			code: ''
		}
	})
	const {
		register: registerPhoneBinding,
		handleSubmit: handlePhoneBindingSubmit,
		reset: resetPhoneBindingForm,
		trigger: triggerPhoneBinding,
		watch: watchPhoneBinding,
		setValue: setPhoneBindingValue,
		formState: {
			errors: phoneBindingErrors,
			touchedFields: phoneBindingTouchedFields,
			isSubmitted: isPhoneBindingSubmitted
		}
	} = useForm<PhoneBindingForm>({
		mode: 'onChange',
		defaultValues: {
			phone: user?.phone || '',
			code: ''
		}
	})
	const phoneInputRef = useRef<HTMLInputElement>(null)
	const phoneMask = usePhoneMask(setPhoneBindingValue, phoneInputRef)
	const emailValue = watchEmailBinding('email')
	const phoneValue = watchPhoneBinding('phone')

	const handleProfileSubmit = handleSubmit(async (data) => {
		const isSuccess = await onSubmit(data)

		if (isSuccess) {
			reset({
				name: data.name || '',
				avatarPath: undefined,
				password: ''
			})
		}
	})

	const handleEmailCodeRequest = async () => {
		const isValid = await triggerEmailBinding('email')
		if (!isValid) {
			return
		}

		const isSuccess = await requestEmailCode(emailValue.trim())

		if (isSuccess) {
			resetEmailBindingForm({
				email: emailValue.trim(),
				code: ''
			})
		}
	}

	const handlePhoneCodeRequest = async () => {
		const isValid = await triggerPhoneBinding('phone')
		if (!isValid) {
			return
		}

		const isSuccess = await requestPhoneCode(phoneValue.trim())

		if (isSuccess) {
			resetPhoneBindingForm({
				phone: phoneValue.trim(),
				code: ''
			})
		}
	}

	const handleEmailVerification = handleEmailBindingSubmit(
		async (data) => {
			const isSuccess = await confirmEmailCode({
				email: data.email.trim(),
				code: data.code.trim()
			})

			if (isSuccess) {
				resetEmailBindingForm({
					email: '',
					code: ''
				})
				resetEmailBinding()
			}
		}
	)

	const handlePhoneVerification = handlePhoneBindingSubmit(
		async (data) => {
			const isSuccess = await confirmPhoneCode({
				phone: data.phone.trim(),
				code: data.code.trim()
			})

			if (isSuccess) {
				resetPhoneBindingForm({
					phone: '',
					code: ''
				})
				phoneMask.reset()
				resetPhoneBinding()
			}
		}
	)

	const resetEmailFlow = () => {
		resetEmailBindingForm({
			email: '',
			code: ''
		})
		resetEmailBinding()
	}

	const resetPhoneFlow = () => {
		resetPhoneBindingForm({
			phone: '',
			code: ''
		})
		phoneMask.reset()
		resetPhoneBinding()
	}

	const phoneRegistration = registerPhoneBinding('phone', {
		required: 'Введите номер телефона',
		pattern: {
			value: validPhone,
			message: 'Проверьте правильность ввода'
		}
	})

	return (
		<div className={styles.wrapper}>
			<Heading text="Профиль" />

			{isLoading ? (
				<div className={styles['profile-content']}>
					<div className={styles['profile-summary-section']}>
						<div className={styles['loading-user-info']}>
							<SkeletonLoader
								count={1}
								circle
								className={styles['loading-avatar']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-user-name']}
							/>
						</div>
						<div className={styles['profile-meta']}>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-line']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-line']}
							/>
						</div>
					</div>
					<div className={styles['profile-identity-section']}>
						<SubHeading text="Способы входа" />
						<div className={styles['loading-identity-grid']}>
							<div className={styles['identity-card']}>
								<SkeletonLoader
									count={1}
									className={styles['loading-input']}
								/>
								<SkeletonLoader
									count={1}
									className={styles['loading-input']}
								/>
								<SkeletonLoader
									count={1}
									className={styles['loading-button']}
								/>
							</div>
							<div className={styles['identity-card']}>
								<SkeletonLoader
									count={1}
									className={styles['loading-input']}
								/>
								<SkeletonLoader
									count={1}
									className={styles['loading-input']}
								/>
								<SkeletonLoader
									count={1}
									className={styles['loading-button']}
								/>
							</div>
						</div>
					</div>
					<div className={styles['profile-edit-section']}>
						<SubHeading text="Редактирование профиля" />
						<div className={styles['loading-form']}>
							<SkeletonLoader
								count={1}
								className={styles['loading-upload']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-input']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-input']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-button']}
							/>
						</div>
					</div>
				</div>
			) : (
				<div className={styles['profile-content']}>
					<div className={styles['profile-summary-section']}>
						<UserInfo
							avatarPath={user?.avatarPath}
							name={user?.name}
							isLoading={isLoading}
						/>
						<div className={styles['profile-meta']}>
							{user?.email && (
								<p className={clsx(styles['info-field'])}>
									<span className={styles['info-label']}>Email:</span>{' '}
									{user.email}
								</p>
							)}
							{user?.phone && (
								<p className={clsx(styles['info-field'])}>
									<span className={styles['info-label']}>Телефон:</span>{' '}
									{user.phone}
								</p>
							)}
							{!user?.email && !user?.phone && (
								<p className={clsx(styles['info-field'])}>
									Пока не привязан ни email, ни телефон.
								</p>
							)}
						</div>
					</div>

					<div className={styles['profile-identity-section']}>
						<SubHeading text="Способы входа" />
						<div className={styles['identity-grid']}>
							<form
								onSubmit={handleEmailVerification}
								className={styles['identity-card']}
							>
								<p className={styles['identity-title']}>Email</p>
								<p className={styles['identity-description']}>
									{user?.email
										? `Текущий email: ${user.email}`
										: 'Добавьте email для входа.'}
								</p>
								<FieldEmail
									type="email"
									error={emailBindingErrors.email}
									placeholder={user?.email ? 'Новый email' : 'Email'}
									aria-invalid={
										emailBindingTouchedFields.email ||
										isEmailBindingSubmitted
											? 'true'
											: undefined
									}
									{...registerEmailBinding('email', {
										required: 'Введите email',
										pattern: {
											value: validEmail,
											message: 'Проверьте правильность ввода'
										}
									})}
								/>
								{emailCodeRequested && (
									<>
										<FieldCode
											type="text"
											error={emailBindingErrors.code}
											placeholder="Код из email"
											aria-invalid={
												emailBindingTouchedFields.code ||
												isEmailBindingSubmitted
													? 'true'
													: undefined
											}
											{...registerEmailBinding('code', {
												required: 'Введите код из email',
												pattern: {
													value: validPhoneCode,
													message: 'Введите корректный код'
												}
											})}
										/>
										<p className={styles['identity-hint']}>
											Код отправлен на {emailValue}. После подтверждения
											email станет новым способом входа.
										</p>
									</>
								)}
								<div className={styles['identity-actions']}>
									<Button
										type="button"
										disabled={isSendingEmailCode || isVerifyingEmailCode}
										onClick={handleEmailCodeRequest}
									>
										{isSendingEmailCode
											? 'Отправка...'
											: emailCodeRequested
												? 'Отправить код повторно'
												: user?.email
													? 'Сменить email'
													: 'Привязать email'}
									</Button>
									{emailCodeRequested && (
										<Button
											disabled={isSendingEmailCode || isVerifyingEmailCode}
										>
											{isVerifyingEmailCode
												? 'Подтверждение...'
												: 'Подтвердить email'}
										</Button>
									)}
								</div>
								{emailCodeRequested && (
									<button
										type="button"
										className={styles['identity-reset']}
										onClick={resetEmailFlow}
									>
										Сбросить ввод
									</button>
								)}
							</form>

							<form
								onSubmit={handlePhoneVerification}
								className={styles['identity-card']}
							>
								<p className={styles['identity-title']}>Телефон</p>
								<p className={styles['identity-description']}>
									{user?.phone
										? `Текущий телефон: ${user.phone}`
										: 'Добавьте телефон для входа.'}
								</p>
								<FieldPhone
									error={phoneBindingErrors.phone}
									placeholder={
										phoneMask.isMaskEmpty ? 'Новый телефон' : undefined
									}
									aria-invalid={
										phoneBindingTouchedFields.phone ||
										isPhoneBindingSubmitted
											? 'true'
											: undefined
									}
									{...phoneRegistration}
									ref={(element) => {
										phoneRegistration.ref(element)
										phoneInputRef.current = element
									}}
									onFocus={phoneMask.onFocus}
									onClick={phoneMask.onClick}
									onKeyDown={phoneMask.onKeyDown}
									onBeforeInput={phoneMask.onBeforeInput}
									onInput={phoneMask.onInput}
									onPaste={phoneMask.onPaste}
									onBlur={(event) => {
										phoneMask.onBlur(event)
										phoneRegistration.onBlur(event)
									}}
								/>
								{phoneCodeRequested && (
									<>
										<FieldCode
											type="text"
											error={phoneBindingErrors.code}
											placeholder="Код из SMS"
											aria-invalid={
												phoneBindingTouchedFields.code ||
												isPhoneBindingSubmitted
													? 'true'
													: undefined
											}
											{...registerPhoneBinding('code', {
												required: 'Введите код из SMS',
												pattern: {
													value: validPhoneCode,
													message: 'Введите корректный код'
												}
											})}
										/>
										<p className={styles['identity-hint']}>
											Код отправлен на {phoneValue}. После подтверждения
											телефон станет новым способом входа.
										</p>
									</>
								)}
								<div className={styles['identity-actions']}>
									<Button
										type="button"
										disabled={isSendingPhoneCode || isVerifyingPhoneCode}
										onClick={handlePhoneCodeRequest}
									>
										{isSendingPhoneCode
											? 'Отправка...'
											: phoneCodeRequested
												? 'Отправить код повторно'
												: user?.phone
													? 'Сменить телефон'
													: 'Привязать телефон'}
									</Button>
									{phoneCodeRequested && (
										<Button
											disabled={isSendingPhoneCode || isVerifyingPhoneCode}
										>
											{isVerifyingPhoneCode
												? 'Подтверждение...'
												: 'Подтвердить телефон'}
										</Button>
									)}
								</div>
								{phoneCodeRequested && (
									<button
										type="button"
										className={styles['identity-reset']}
										onClick={resetPhoneFlow}
									>
										Сбросить ввод
									</button>
								)}
							</form>
						</div>
					</div>

					<div className={styles['profile-edit-section']}>
						<SubHeading text="Редактирование профиля" />
						<form
							onSubmit={handleProfileSubmit}
							className={styles['profile-edit-form']}
						>
							<Controller
								control={control}
								name="avatarPath"
								render={({ field: { value, onChange } }) => (
									<FieldUploadFile
										onChange={onChange}
										value={value}
										currentFile={
											user?.avatarPath ||
											'/uploads/user-avatar/avatar-default.png'
										}
										folder="user-avatar"
										placeholder="Фото профиля"
									/>
								)}
							/>
							<FieldName
								type="text"
								error={errors.name}
								defaultValue={user?.name || ''}
								placeholder="Имя"
								{...register('name', {
									pattern: {
										value: validName,
										message:
											'Минимальная длина должна быть более 2 символов. Можно использовать цифры, начиная со второго символа, и специальный символ «-».'
									}
								})}
							/>
							<FieldPassword
								type="password"
								error={errors.password}
								placeholder="Новый пароль"
								{...register('password', {
									pattern: {
										value: validPassword,
										message:
											'Мин. длина 6 символов. Должен содержать 1 цифру 0-9, 1 строчную букву a-z и 1 заглавную букву A-Z.'
									}
								})}
							/>
							<div className={styles['profile-edit-actions']}>
								<Button disabled={isProfileUpdateLoading}>
									{isProfileUpdateLoading ? 'Сохранение...' : 'Сохранить'}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	)
}

export default Profile
