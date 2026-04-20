export interface IAdminActions {
	editUrl: string
	userId: string
	onDelete?: (userId: string) => void
}
