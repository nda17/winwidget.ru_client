'use client'
import styles from '@/components/screens/(auth)/auth-form/AuthForm.module.scss'
import { IAuthFormProps } from '@/components/screens/(auth)/auth-form/auth-form.interface'
import AuthToggle from '@/components/screens/(auth)/auth-form/auth-toggle/AuthToggle'
import SocialMediaButtons from '@/components/screens/(auth)/auth-form/social-media-buttons/SocialMediaButtons'
import useAuthForm from '@/components/screens/(auth)/auth-form/useAuthForm'
import FieldEmail from '@/components/ui/form-elements/auth-page/field-email/FieldEmail'
import FieldPassword from '@/components/ui/form-elements/auth-page/field-password/FieldPassword'
import FieldPhone from '@/components/ui/form-elements/auth-page/field-phone/FieldPhone'
import FieldSmsCode from '@/components/ui/form-elements/auth-page/field-sms-code/FieldSmsCode'
import {
	validEmail,
	validPassword,
	validPhone,
	validPhoneCode
} from '@/shared/regex'
import clsx from 'clsx'
import { NextPage } from 'next'

const AuthForm: NextPage<IAuthFormProps> = ({ isLogin, authMessage }) => {
	const {
		handleSubmit,
		isLoading,
		onSubmit,
		register,
		formState: { errors, touchedFields, isSubmitted },
		authMethod,
		setAuthMethod,
		isPhoneCodeRequested,
		isEmailCodeRequested,
		emailValue,
		phoneValue,
		phoneInputRef,
		phoneMask,
		resendEmailCode,
		startTelegramAuth,
		isTelegramAuthLoading,
		isTelegramAuthRequested,
		telegramAuthUrl,
		authMessage: currentAuthMessage,
		resetEmailCodeStep,
		resetPhoneCodeStep,
		resetTelegramAuthStep
	} = useAuthForm(isLogin, authMessage)

	return (
		<form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
			<div className={styles['auth-method-toggle']}>
				<button
					type="button"
					className={clsx(
						styles['method-button'],
						authMethod === 'email' && styles['method-button-active']
					)}
					onClick={() => setAuthMethod('email')}
				>
					Email
				</button>
				<button
					type="button"
					className={clsx(
						styles['method-button'],
						authMethod === 'phone' && styles['method-button-active']
					)}
					onClick={() => setAuthMethod('phone')}
				>
					Телефон
				</button>
			</div>

			{currentAuthMessage && (
				<div className={styles['auth-alert']} role="alert">
					{currentAuthMessage}
				</div>
			)}

			{authMethod === 'email' ? (
				<>
					<FieldEmail
						{...register('email', {
							required: 'Введите email',
							pattern: {
								value: validEmail,
								message: 'Проверьте правильность ввода email'
							}
						})}
						placeholder="Email:"
						type="email"
						error={errors.email}
						data-validated={
							touchedFields.email || isSubmitted ? 'true' : undefined
						}
						disabled={!isLogin && isEmailCodeRequested}
					/>
					{!isLogin && isEmailCodeRequested && (
						<>
							<FieldSmsCode
								{...register('code', {
									required: 'Введите код из email',
									pattern: {
										value: validPhoneCode,
										message: 'Код должен содержать 4-6 цифр'
									}
								})}
								placeholder="Код из email:"
								type="text"
								error={errors.code}
								data-validated={
									touchedFields.code || isSubmitted ? 'true' : undefined
								}
							/>
							<div className={styles['verification-hint']}>
								Код отправлен на email {emailValue}. Срок действия 10
								минут.
							</div>
							<div className={styles['link-actions']}>
								<button
									type="button"
									className={styles['link-button']}
									onClick={resendEmailCode}
									disabled={isLoading}
								>
									Отправить код повторно
								</button>
								<button
									type="button"
									className={styles['link-button']}
									onClick={resetEmailCodeStep}
									disabled={isLoading}
								>
									Изменить email
								</button>
							</div>
						</>
					)}
				</>
			) : (
				<>
					{(() => {
						const phoneRegister = register('phone', {
							required: 'Введите номер телефона',
							pattern: {
								value: validPhone,
								message: 'Проверьте правильность ввода номера телефона'
							}
						})

						return (
							<FieldPhone
								{...phoneRegister}
								placeholder="Телефон:"
								type="tel"
								error={errors.phone}
								data-validated={
									touchedFields.phone || isSubmitted ? 'true' : undefined
								}
								data-mask-empty={
									phoneMask.isMaskEmpty ? 'true' : undefined
								}
								disabled={!isLogin && isPhoneCodeRequested}
								onFocus={phoneMask.onFocus}
								onClick={phoneMask.onClick}
								onKeyDown={phoneMask.onKeyDown}
								onBeforeInput={phoneMask.onBeforeInput}
								onInput={phoneMask.onInput}
								onPaste={phoneMask.onPaste}
								onBlur={phoneMask.onBlur}
								ref={element => {
									phoneRegister.ref(element)
									phoneInputRef.current = element
								}}
							/>
						)
					})()}
					{!isLogin && isPhoneCodeRequested && (
						<>
							<FieldSmsCode
								{...register('code', {
									required: 'Введите код из SMS',
									pattern: {
										value: validPhoneCode,
										message: 'Код должен содержать 4-6 цифр'
									}
								})}
								placeholder="Код из SMS:"
								type="text"
								error={errors.code}
								data-validated={
									touchedFields.code || isSubmitted ? 'true' : undefined
								}
							/>
							<div className={styles['verification-hint']}>
								Код отправлен на номер {phoneValue}
							</div>
							<div className={styles['link-actions']}>
								<button
									type="button"
									className={styles['link-button']}
									onClick={resetPhoneCodeStep}
									disabled={isLoading}
								>
									Изменить номер
								</button>
							</div>
						</>
					)}
				</>
			)}

			<FieldPassword
				{...register('password', {
					required:
						!isLogin && authMethod === 'email' && isEmailCodeRequested
							? false
							: 'Введите пароль',
					pattern:
						!isLogin && authMethod === 'email' && isEmailCodeRequested
							? undefined
							: {
									value: validPassword,
									message:
										'Мин. длина 6 символов. Должен содержать 1 цифру 0-9, 1 строчную букву a-z и 1 заглавную букву A-Z.'
								}
				})}
				placeholder="Пароль:"
				type="password"
				error={errors.password}
				data-validated={
					touchedFields.password || isSubmitted ? 'true' : undefined
				}
				disabled={
					!isLogin && authMethod === 'email' && isEmailCodeRequested
				}
			/>

			<div className={clsx(styles['wrapper-button'])}>
				<button
					type="submit"
					className={clsx(styles['button-primary'])}
					disabled={isLoading}
				>
					{isLoading
						? 'Загрузка...'
						: isLogin
							? 'Войти'
							: authMethod === 'phone'
								? !isPhoneCodeRequested
									? 'Получить код'
									: 'Зарегистрироваться'
								: !isEmailCodeRequested
									? 'Получить код'
									: 'Подтвердить email'}
				</button>
			</div>

			<div className={styles['social-section']}>
				<div className={styles['section-divider']}>
					<span>или продолжить через</span>
				</div>
				<SocialMediaButtons
					onTelegramAuthStart={startTelegramAuth}
					isTelegramAuthLoading={isTelegramAuthLoading}
				/>
				{isTelegramAuthRequested && (
					<div className={styles['telegram-auth-box']}>
						<div className={styles['verification-hint']}>
							В Auth_bot нажмите Start, затем кнопку подтверждения входа.
							Статус на сайте обновится автоматически.
						</div>
						<div className={styles['link-actions']}>
							{telegramAuthUrl && (
								<button
									type="button"
									className={styles['link-button']}
									onClick={() => {
										window.open(
											telegramAuthUrl,
											'_blank',
											'noopener,noreferrer'
										)
									}}
								>
									Открыть Auth_bot ещё раз
								</button>
							)}
							<button
								type="button"
								className={styles['link-button']}
								onClick={resetTelegramAuthStep}
							>
								Сбросить
							</button>
						</div>
					</div>
				)}
			</div>

			<AuthToggle isLogin={isLogin} />
		</form>
	)
}

export default AuthForm
