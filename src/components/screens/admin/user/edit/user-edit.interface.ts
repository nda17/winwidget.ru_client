import { IUser } from '@/shared/types/user.types'

export interface IUserEditInput extends Omit<
	IUser,
	'createdAt' | 'rights'
> {
	isPhoneVerified?: boolean
	isUser?: boolean
	isAdmin?: boolean
}
