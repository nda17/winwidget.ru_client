import { errorCatch } from '@/shared/api'
import { useMutation } from '@tanstack/react-query'
import {
	ChangeEvent,
	MutableRefObject,
	useCallback,
	useMemo,
	useState
} from 'react'
import toast from 'react-hot-toast'

interface IUseUploadFileOptions {
	operationLockRef: MutableRefObject<boolean>
	successMessage?: string
}

export const useUploadFile = (
	onChange: (fileUrl: string) => void,
	onUpload: (file: File) => Promise<string>,
	options: IUseUploadFileOptions
) => {
	const { operationLockRef, successMessage } = options
	const [isProcessing, setIsProcessing] = useState(false)
	const { mutateAsync } = useMutation({
		mutationKey: ['upload-file'],
		mutationFn: onUpload
	})

	const uploadFile = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files

			if (!files?.length || operationLockRef.current) {
				e.target.value = ''
				return
			}

			operationLockRef.current = true
			const toastId = toast.loading('Загружаем фото...')
			setIsProcessing(true)
			try {
				const fileUrl = await mutateAsync(files[0])
				onChange(fileUrl)
				toast.success(successMessage || 'Фото загружено', {
					id: toastId
				})
			} catch (error) {
				const message = errorCatch(error) || 'Не удалось загрузить фото'

				toast.error(`Ошибка загрузки фото: ${message}`, {
					id: toastId
				})
			} finally {
				operationLockRef.current = false
				setIsProcessing(false)
				e.target.value = ''
			}
		},
		[mutateAsync, onChange, operationLockRef, successMessage]
	)

	return useMemo(
		() => ({ uploadFile, isLoading: isProcessing }),
		[uploadFile, isProcessing]
	)
}
