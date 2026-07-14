import { CSSProperties, InputHTMLAttributes } from 'react'
import { FieldError, FieldErrorsImpl, Merge } from 'react-hook-form'

export interface IFieldProps {
	error?: FieldError | Merge<FieldError, FieldErrorsImpl<any>> | undefined
}

type TypeInputPropsField = InputHTMLAttributes<HTMLInputElement> &
	IFieldProps

export interface IField extends TypeInputPropsField {}

export interface IUploadField {
	currentFile?: string
	folder?: string
	value?: string
	onChange: (...event: any[]) => void
	placeholder: string
	error?: FieldError
	style?: CSSProperties
	canDelete?: boolean
	disabled?: boolean
	showFilePath?: boolean
	onUploadComplete?: (fileUrl: string) => Promise<void> | void
	uploadSuccessMessage?: string
	onDelete?: () => Promise<void>
}
