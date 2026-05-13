import { IUser } from '@/shared/types/user.types'

export interface IUserEditInput extends Omit<
	IUser,
	'createdAt' | 'rights' | 'avatarPath'
> {
	avatarPath?: string | null
	isPhoneVerified?: boolean
	isUser?: boolean
	isAdmin?: boolean
	isDev?: boolean
}
