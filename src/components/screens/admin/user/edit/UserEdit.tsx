'use client'
import { IUserEditInput } from '@/components/screens/admin/user/edit/user-edit.interface'
import styles from '@/components/screens/admin/user/edit/UserEdit.module.scss'
import { useUserEdit } from '@/components/screens/admin/user/edit/useUserEdit'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import CheckboxRights from '@/components/ui/form-elements/admin-page/checkbox-rights/CheckboxRights'
import FieldEmail from '@/components/ui/form-elements/admin-page/field-email/FieldEmail'
import FieldId from '@/components/ui/form-elements/admin-page/field-id/FieldId'
import FieldName from '@/components/ui/form-elements/admin-page/field-name/FieldName'
import FieldPassword from '@/components/ui/form-elements/admin-page/field-password/FieldPassword'
import Button from '@/components/ui/form-elements/universal-elements/button/Button'
import FieldUploadFile from '@/components/ui/form-elements/universal-elements/field-upload-file/FieldUploadFile'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import UserInfo from '@/components/ui/user-info/UserInfo'
import { UserRole } from '@/services/auth/auth.types'
import {
	validEmail,
	validId,
	validName,
	validPassword,
	validPhone
} from '@/shared/regex'
import { IParamsUrl } from '@/shared/types/params-url.types'
import clsx from 'clsx'
import { NextPage } from 'next'
import { Controller, useForm } from 'react-hook-form'

const UserEdit: NextPage<IParamsUrl> = ({ params }) => {
	const {
		handleSubmit,
		register,
		formState: { errors },
		setValue,
		control
	} = useForm<IUserEditInput>({ mode: 'onChange' })

	const { isLoading, data, onSubmit } = useUserEdit(setValue, params)

	return (
		<div className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />
			{isLoading ? (
				<div className={styles['loading-content']}>
					<div className={styles['loading-section']}>
						<SubHeading text="Редактирование данных пользователя" />
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
						<div className={styles['loading-meta']}>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-line']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-line']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-line']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-line']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-line-short']}
							/>
						</div>
					</div>
					<div className={styles['loading-section']}>
						<SubHeading text="Поля редактирования" />
						<div className={styles['loading-form']}>
							<SkeletonLoader
								count={1}
								className={styles['loading-upload']}
							/>
							<div className={styles['loading-checkboxes']}>
								<SkeletonLoader
									count={1}
									className={styles['loading-checkbox']}
								/>
								<SkeletonLoader
									count={1}
									className={styles['loading-checkbox']}
								/>
								<SkeletonLoader
									count={1}
									className={styles['loading-checkbox']}
								/>
								<SkeletonLoader
									count={1}
									className={styles['loading-checkbox']}
								/>
							</div>
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
								className={styles['loading-input']}
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
				<div className={styles.content}>
					<div className={styles['summary-section']}>
						<SubHeading text="Редактирование данных пользователя" />
						<UserInfo
							avatarPath={data?.avatarPath}
							name={data?.name}
							isLoading={isLoading}
						/>
						<div className={styles['summary-meta']}>
							<p className={styles['info-field']}>
								<span className={styles['info-label']}>ID:</span> {data.id}
							</p>
							<p className={styles['info-field']}>
								<span className={styles['info-label']}>Email:</span>{' '}
								{data.email || 'Нет данных'}
							</p>
							<p className={styles['info-field']}>
								<span className={styles['info-label']}>Телефон:</span>{' '}
								{data.phone || 'Нет данных'}
							</p>
							<p className={styles['info-field']}>
								<span className={styles['info-label']}>Статус:</span>{' '}
								<span className={styles['info-status']}>
									{data.email
										? data.verificationToken
											? 'Email не подтвержден'
											: 'Email подтвержден'
										: data.isPhoneVerified
											? 'Телефон подтвержден'
											: 'Телефон не подтвержден'}
								</span>
							</p>
							<p className={styles['info-field']}>
								<span className={styles['info-label']}>Роли:</span>{' '}
								{data.rights.join(', ')}
							</p>
							<p className={styles['info-field']}>
								<span className={styles['info-label']}>
									Дата регистрации:
								</span>{' '}
								{data.createdAt.replace(/\T.*/, '')}
							</p>
						</div>
					</div>
					<div className={styles['edit-section']}>
						<SubHeading text="Поля редактирования" />
						<form
							onSubmit={handleSubmit(onSubmit)}
							className={styles['edit-form']}
						>
						<Controller
							control={control}
							name="avatarPath"
							render={({ field: { value, onChange } }) => (
								<FieldUploadFile
									onChange={onChange}
									value={value}
									currentFile={
										data?.avatarPath ||
										'/uploads/user-avatar/avatar-default.png'
									}
									folder="user-avatar"
									placeholder="Фото профиля"
								/>
							)}
						/>
						<div className={clsx(styles['wrapper-checkbox'])}>
							<div className={styles.checkbox}>
								<p>USER</p>
								<Controller
									control={control}
									name="isUser"
									render={({ field }) => (
										<CheckboxRights
											required
											type="checkbox"
											defaultChecked={data.rights.includes(UserRole.USER)}
											{...register('isUser', { value: field.value })}
										/>
									)}
								/>
							</div>
							<div className={styles.checkbox}>
								<p>ADMIN</p>
								<Controller
									control={control}
									name="isAdmin"
									render={({ field }) => (
										<CheckboxRights
											type="checkbox"
											defaultChecked={data.rights.includes(UserRole.ADMIN)}
											{...register('isAdmin', { value: field.value })}
										/>
									)}
								/>
							</div>
							<div className={styles.checkbox}>
								<p>MANAGER</p>
								<Controller
									control={control}
									name="isManager"
									render={({ field }) => (
										<CheckboxRights
											type="checkbox"
											defaultChecked={data.rights.includes(
												UserRole.MANAGER
											)}
											{...register('isManager', { value: field.value })}
										/>
									)}
								/>
							</div>
							<div className={styles.checkbox}>
								<p>PREMIUM</p>
								<Controller
									control={control}
									name="isPremium"
									render={({ field }) => (
										<CheckboxRights
											type="checkbox"
											defaultChecked={data.rights.includes(
												UserRole.PREMIUM
											)}
											{...register('isPremium', { value: field.value })}
										/>
									)}
								/>
							</div>
						</div>
						<FieldId
							type="text"
							error={errors.id}
							defaultValue={data.id}
							placeholder="ID"
							{...register('id', {
								pattern: {
									value: validId,
									message:
										'Минимальная и максимальная длина - 25 символов. Первые 2 символа - буквы. Далее идут буквы и цифры.'
								}
							})}
						/>
						<FieldName
							type="text"
							error={errors.name}
							defaultValue={data.name}
							placeholder="Имя"
							{...register('name', {
								pattern: {
									value: validName,
									message:
										'Минимальная длина должна быть более 2 символов. Можно использовать цифры, начиная со второго символа, и специальный символ «-».'
								}
							})}
						/>
						<FieldEmail
							type="email"
							error={errors.email}
							defaultValue={data?.email}
							placeholder="Email"
							{...register('email', {
								pattern: {
									value: validEmail,
									message: 'Проверьте правильность ввода email'
								}
							})}
						/>
						<FieldEmail
							type="tel"
							error={errors.phone}
							defaultValue={data?.phone || ''}
							placeholder="Телефон"
							{...register('phone', {
								pattern: {
									value: validPhone,
									message: 'Проверьте правильность ввода номера телефона'
								}
							})}
						/>
						<FieldPassword
							type="password"
							error={errors.password}
							placeholder="Пароль"
							{...register('password', {
								pattern: {
									value: validPassword,
									message:
										'Мин. длина 6 символов. Должен содержать 1 цифру 0-9, 1 строчную букву a-z и 1 заглавную букву A-Z.'
								}
							})}
						/>
							<div className={styles.actions}>
								<Button>Сохранить</Button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	)
}

export default UserEdit
