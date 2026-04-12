import { UserRole } from '@/services/auth/auth.types'

export type UserLoginMethod =
	| 'EMAIL'
	| 'PHONE'
	| 'GOOGLE'
	| 'GITHUB'
	| 'YANDEX'

export interface IUser {
	id: string
	name?: string
	email?: string | null
	phone?: string | null
	isPhoneVerified?: boolean
	loginMethods?: UserLoginMethod[]
	password?: string
	avatarPath?: string
	rights: UserRole[]
	createdAt: string
}
