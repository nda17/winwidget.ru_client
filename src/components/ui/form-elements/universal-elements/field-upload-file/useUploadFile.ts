import fileService from '@/services/file/file.service'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { ChangeEvent, useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

interface IUseUploadFileOptions {
	onUploadComplete?: (fileUrl: string) => Promise<void> | void
	successMessage?: string
}

export const useUploadFile = (
	onChange: (...event: any[]) => void,
	folder?: string,
	options: IUseUploadFileOptions = {}
) => {
	const { onUploadComplete, successMessage } = options
	const [isProcessing, setIsProcessing] = useState(false)
	const { mutateAsync } = useMutation({
		mutationKey: ['upload-file'],
		mutationFn: (data: FormData) => fileService.upload(data, folder)
	})

	const uploadFile = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files

			if (!files?.length) {
				return
			}

			const formData = new FormData()
			formData.append('file', files[0])
			const toastId = toast.loading('Загружаем файл...')

			setIsProcessing(true)
			try {
				const { data } = await mutateAsync(formData)
				const fileUrl = data[0]?.url

				if (!fileUrl) {
					throw new Error('Не удалось загрузить файл')
				}

				await onUploadComplete?.(fileUrl)
				onChange(fileUrl)
				toast.success(successMessage || 'Файл загружен', {
					id: toastId
				})
			} catch (error) {
				const message = axios.isAxiosError(error)
					? error.response?.data?.message || 'Не удалось загрузить файл'
					: error instanceof Error
						? error.message
						: 'Не удалось загрузить файл'

				toast.error(`Ошибка загрузки файла: ${message}`, {
					id: toastId
				})
			} finally {
				setIsProcessing(false)
				e.target.value = ''
			}
		},
		[mutateAsync, onChange, onUploadComplete, successMessage]
	)

	return useMemo(
		() => ({ uploadFile, isLoading: isProcessing }),
		[uploadFile, isProcessing]
	)
}
