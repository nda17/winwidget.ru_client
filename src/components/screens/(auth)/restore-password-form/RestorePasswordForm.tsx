'use client'
import styles from '@/components/screens/(auth)/auth-form/AuthForm.module.scss'
import useRestorePasswordForm from '@/components/screens/(auth)/restore-password-form/useRestorePasswordForm'
import FieldEmail from '@/components/ui/form-elements/auth-page/field-email/FieldEmail'
import { validEmail } from '@/shared/regex'
import clsx from 'clsx'
import { NextPage } from 'next'

const RestorePasswordForm: NextPage = () => {
	const {
		handleSubmit,
		isLoading,
		onSubmit,
		register,
		formState: { errors }
	} = useRestorePasswordForm()

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

			<div className={clsx(styles['wrapper-button'])}>
				<button
					type="submit"
					className={clsx(
						styles['button-primary'],
						'bg-red-600',
						isLoading ? 'opacity-75 cursor-not-allowed' : ''
					)}
					disabled={isLoading}
				>
					Восстановить пароль
				</button>
			</div>
		</form>
	)
}

export default RestorePasswordForm
