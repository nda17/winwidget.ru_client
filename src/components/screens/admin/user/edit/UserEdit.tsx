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
	validPassword
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
			<SubHeading text="Редактирование данных пользователя" />
			<UserInfo
				avatarPath={data?.avatarPath}
				name={data?.name}
				isLoading={isLoading}
			/>
			{isLoading ? (
				<SkeletonLoader count={6} className="h-5 mb-4" />
			) : (
				<>
					<form onSubmit={handleSubmit(onSubmit)}>
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
							{...register('phone')}
						/>
						<FieldPassword
							type="password"
							error={errors.password}
							placeholder="Password"
							{...register('password', {
								pattern: {
									value: validPassword,
									message:
										'Мин. длина 6 символов. Должен содержать 1 цифру 0-9, 1 строчную букву a-z и 1 заглавную букву A-Z.'
								}
							})}
						/>
						<Button>Save</Button>
					</form>
				</>
			)}
		</div>
	)
}

export default UserEdit
