'use client'
import styles from '@/components/screens/profile/Profile.module.scss'
import { useProfileEdit } from '@/components/screens/profile/useProfileEdit'
import FieldName from '@/components/ui/form-elements/admin-page/field-name/FieldName'
import FieldPassword from '@/components/ui/form-elements/admin-page/field-password/FieldPassword'
import Button from '@/components/ui/form-elements/universal-elements/button/Button'
import FieldUploadFile from '@/components/ui/form-elements/universal-elements/field-upload-file/FieldUploadFile'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import UserInfo from '@/components/ui/user-info/UserInfo'
import useUser from '@/hooks/useUser'
import { IProfileEditInput } from '@/services/user/user.service'
import { validName, validPassword } from '@/shared/regex'
import { clsx } from 'clsx'
import { NextPage } from 'next'
import { Controller, useForm } from 'react-hook-form'

const Profile: NextPage = () => {
	const { user, isLoading } = useUser()
	const { onSubmit, isLoading: isProfileUpdateLoading } = useProfileEdit()
	const {
		handleSubmit,
		register,
		control,
		reset,
		formState: { errors }
	} = useForm<IProfileEditInput>({ mode: 'onChange' })

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

	return (
		<div className={styles.wrapper}>
			<Heading text="Профиль" />

			{isLoading ? (
				<>
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
				</>
			) : (
				<>
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
										{user.email}{' '}
										<i className={styles['info-status']}>
											(
											{user.verificationToken
												? 'Требуется подтверждение'
												: 'Подтверждено'}
											)
										</i>
									</p>
								)}
								{user?.phone && (
									<p className={clsx(styles['info-field'])}>
										<span className={styles['info-label']}>Телефон:</span>{' '}
										{user.phone}{' '}
										<i className={styles['info-status']}>
											(
											{user.isPhoneVerified
												? 'Подтвержден'
												: 'Требуется подтверждение'}
											)
										</i>
									</p>
								)}
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
										{isProfileUpdateLoading
											? 'Сохранение...'
											: 'Сохранить'}
									</Button>
								</div>
							</form>
						</div>
					</div>
				</>
			)}
		</div>
	)
}

export default Profile
