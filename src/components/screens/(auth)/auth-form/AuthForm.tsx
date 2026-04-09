'use client'
import styles from '@/components/screens/(auth)/auth-form/AuthForm.module.scss'
import { IAuthFormProps } from '@/components/screens/(auth)/auth-form/auth-form.interface'
import AuthToggle from '@/components/screens/(auth)/auth-form/auth-toggle/AuthToggle'
import SocialMediaButtons from '@/components/screens/(auth)/auth-form/social-media-buttons/SocialMediaButtons'
import useAuthForm from '@/components/screens/(auth)/auth-form/useAuthForm'
import FieldEmail from '@/components/ui/form-elements/auth-page/field-email/FieldEmail'
import FieldPassword from '@/components/ui/form-elements/auth-page/field-password/FieldPassword'
import { validEmail, validPassword } from '@/shared/regex'
import clsx from 'clsx'
import { NextPage } from 'next'

const AuthForm: NextPage<IAuthFormProps> = ({ isLogin }) => {
	const {
		handleSubmit,
		isLoading,
		onSubmit,
		register,
		formState: { errors }
	} = useAuthForm(isLogin)

	return (
		<form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
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
			/>

			<FieldPassword
				{...register('password', {
					required: 'Введите пароль',
					pattern: {
						value: validPassword,
						message:
							'Мин. длина 6 символов. Должен содержать 1 цифру 0-9, 1 строчную букву a-z и 1 заглавную букву A-Z.'
					}
				})}
				placeholder="Пароль:"
				type="password"
				error={errors.password}
			/>

			<div className={clsx(styles['wrapper-button'])}>
				<button
					type="submit"
					className={clsx(
						styles['button-primary'],
						isLogin ? 'bg-green-500' : 'bg-yellow-700',
						isLoading ? 'opacity-75 cursor-not-allowed' : ''
					)}
					disabled={isLoading}
				>
					{isLoading
						? 'Загрузка...'
						: isLogin
							? 'Войти'
							: 'Зарегистрироваться'}
				</button>
			</div>

			<SocialMediaButtons />

			<AuthToggle isLogin={isLogin} />
		</form>
	)
}

export default AuthForm
