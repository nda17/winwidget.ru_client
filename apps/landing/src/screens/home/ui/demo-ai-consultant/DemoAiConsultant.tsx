'use client'

import type { FormEvent } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import styles from './DemoAiConsultant.module.scss'

type ChatEntry = {
	id: number
	type: 'operator' | 'visitor' | 'event'
	text: string
}

const DEMO_INACTIVITY_MS = 30_000
const DEMO_RESPONSE_MS = 900
const QUICK_QUESTIONS = [
	'Сколько стоит?',
	'Как установить?',
	'Откуда берутся ответы?'
]

const createInitialEntries = (): ChatEntry[] => [
	{
		id: 1,
		type: 'operator',
		text: 'Здравствуйте! Я Alex, AI-оператор. Готов помочь и ответить на ваши вопросы о товарах, услугах и условиях компании.'
	}
]

const getScriptedAnswer = (question: string): string => {
	const normalized = question.toLocaleLowerCase('ru-RU')

	if (
		/(погод|новост|политик|анекдот|столиц|рецепт|фильм)/.test(normalized)
	) {
		return 'Эта тема не относится к Winwidget. Задайте вопрос о виджетах, настройке или тарифах — с этим я помогу.'
	}

	if (/(цен|стоит|тариф|оплат)/.test(normalized)) {
		return 'Тарифы различаются количеством виджетов и доступными возможностями. Актуальные цены указаны в блоке «Выберите удобный тариф» на этой странице.'
	}

	if (/(установ|подключ|код|сайт)/.test(normalized)) {
		return 'Создайте AI-консультанта в кабинете, добавьте промпт, проверьте ответы и опубликуйте настройки. Затем вставьте на сайт одну строку кода.'
	}

	if (/(откуд|ответ|информац|промпт|файл|pdf|word)/.test(normalized)) {
		return 'Я отвечаю только по текстовой инструкции, заданной владельцем виджета. Я не обхожу сайт и не читаю PDF или Word. Если в промпте нет ответа, честно сообщу об этом.'
	}

	if (/(привет|здравств|кто ты|ты кто)/.test(normalized)) {
		return 'Здравствуйте! Я Alex, демонстрационный AI-оператор Winwidget. Могу рассказать, как работает чат, как его установить и откуда он берёт ответы.'
	}

	return 'В демонстрационной инструкции нет данных для точного ответа. В боевом виджете владелец сайта может дополнить промпт нужной информацией.'
}

interface Props {
	open: boolean
	onClose: () => void
}

const DemoAiConsultant = ({ open, onClose }: Props) => {
	const dialogTitleId = useId()
	const [entries, setEntries] = useState<ChatEntry[]>(createInitialEntries)
	const [input, setInput] = useState('')
	const [isJoined, setIsJoined] = useState(false)
	const [isTyping, setIsTyping] = useState(false)
	const entryIdRef = useRef(1)
	const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	)
	const inactivityTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null)
	const messagesRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const onCloseRef = useRef(onClose)

	const nextEntry = (
		type: ChatEntry['type'],
		text: string
	): ChatEntry => ({
		id: ++entryIdRef.current,
		type,
		text
	})

	const clearTimers = useCallback(() => {
		if (responseTimeoutRef.current) {
			clearTimeout(responseTimeoutRef.current)
			responseTimeoutRef.current = null
		}
		if (inactivityTimeoutRef.current) {
			clearTimeout(inactivityTimeoutRef.current)
			inactivityTimeoutRef.current = null
		}
	}, [])

	const scheduleLeave = () => {
		if (inactivityTimeoutRef.current) {
			clearTimeout(inactivityTimeoutRef.current)
		}

		inactivityTimeoutRef.current = setTimeout(() => {
			setEntries(current => [
				...current,
				nextEntry(
					'operator',
					'Похоже, вы отошли. Я не дождался ответа. Если появятся вопросы, напишите ещё раз — я подключусь к новому чату.'
				),
				nextEntry('event', 'Alex покинул чат')
			])
			setIsJoined(false)
			inactivityTimeoutRef.current = null
		}, DEMO_INACTIVITY_MS)
	}

	const sendQuestion = (rawQuestion: string) => {
		const question = rawQuestion.trim()
		if (!question || isTyping) return

		if (inactivityTimeoutRef.current) {
			clearTimeout(inactivityTimeoutRef.current)
			inactivityTimeoutRef.current = null
		}

		setEntries(current => [
			...current,
			...(!isJoined
				? [nextEntry('event', 'Alex присоединился к чату')]
				: []),
			nextEntry('visitor', question)
		])
		setInput('')
		setIsJoined(true)
		setIsTyping(true)

		responseTimeoutRef.current = setTimeout(() => {
			setEntries(current => [
				...current,
				nextEntry('operator', getScriptedAnswer(question))
			])
			setIsTyping(false)
			responseTimeoutRef.current = null
			scheduleLeave()
		}, DEMO_RESPONSE_MS)
	}

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		sendQuestion(input)
	}

	useEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	useEffect(() => {
		if (!open) {
			clearTimers()
			setEntries(createInitialEntries())
			setInput('')
			setIsJoined(false)
			setIsTyping(false)
			entryIdRef.current = 1
			return
		}

		document.body.style.overflow = 'hidden'
		const focusTimeout = setTimeout(() => inputRef.current?.focus(), 150)
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onCloseRef.current()
		}
		window.addEventListener('keydown', handleEscape)

		return () => {
			document.body.style.overflow = ''
			clearTimeout(focusTimeout)
			clearTimers()
			window.removeEventListener('keydown', handleEscape)
		}
	}, [clearTimers, open])

	useEffect(() => {
		messagesRef.current?.scrollTo({
			top: messagesRef.current.scrollHeight,
			behavior: 'smooth'
		})
	}, [entries, isTyping])

	if (!open) return null

	const hasVisitorMessage = entries.some(entry => entry.type === 'visitor')

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть AI-консультант"
			/>
			<section
				className={styles.chat}
				role="dialog"
				aria-modal="true"
				aria-labelledby={dialogTitleId}
			>
				<header className={styles.header}>
					<div className={styles.avatar} aria-hidden="true">
						A
					</div>
					<div className={styles.operator}>
						<div className={styles.operatorNameRow}>
							<h2 id={dialogTitleId}>Alex</h2>
							<span className={styles.aiBadge}>AI-оператор</span>
						</div>
						<p>Отвечает по инструкциям компании</p>
					</div>
					<button
						type="button"
						className={styles.closeButton}
						onClick={onClose}
						aria-label="Закрыть"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M6 6l12 12M18 6 6 18" />
						</svg>
					</button>
				</header>

				<div
					ref={messagesRef}
					className={styles.messages}
					aria-live="polite"
				>
					<p className={styles.demoNotice}>
						Локальное демо — без отправки данных в AI
					</p>
					{entries.map(entry =>
						entry.type === 'event' ? (
							<div key={entry.id} className={styles.eventMessage}>
								<span />
								{entry.text}
							</div>
						) : (
							<div
								key={entry.id}
								className={
									entry.type === 'operator'
										? styles.operatorMessageRow
										: styles.visitorMessageRow
								}
							>
								{entry.type === 'operator' && (
									<span
										className={styles.messageAvatar}
										aria-hidden="true"
									>
										A
									</span>
								)}
								<div className={styles.messageBody}>
									{entry.type === 'operator' && (
										<span className={styles.messageAuthor}>Alex · AI</span>
									)}
									<p>{entry.text}</p>
								</div>
							</div>
						)
					)}

					{isTyping && (
						<div className={styles.typingRow}>
							<span className={styles.messageAvatar} aria-hidden="true">
								A
							</span>
							<div className={styles.typing}>
								<span />
								<span />
								<span />
								<b>Alex печатает</b>
							</div>
						</div>
					)}
				</div>

				{!hasVisitorMessage && (
					<div className={styles.quickQuestions}>
						{QUICK_QUESTIONS.map(question => (
							<button
								type="button"
								key={question}
								onClick={() => sendQuestion(question)}
							>
								{question}
							</button>
						))}
					</div>
				)}

				<form className={styles.composer} onSubmit={handleSubmit}>
					<input
						ref={inputRef}
						type="text"
						value={input}
						onChange={event => setInput(event.target.value)}
						placeholder={isTyping ? 'Alex печатает…' : 'Задайте вопрос'}
						disabled={isTyping}
						maxLength={500}
						aria-label="Ваш вопрос"
					/>
					<button
						type="submit"
						disabled={!input.trim() || isTyping}
						aria-label="Отправить вопрос"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14" />
						</svg>
					</button>
				</form>

				<footer className={styles.footer}>
					Демо AI-консультанта ·{' '}
					<a href="https://winwidget.ru">winwidget.ru</a>
				</footer>
			</section>
		</div>
	)
}

export default DemoAiConsultant
