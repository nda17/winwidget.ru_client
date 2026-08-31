import type { Config } from 'tailwindcss'

const config: Config = {
	content: ['./src/**/*.{js,ts,jsx,tsx,mdx,scss}'],
	theme: {
		extend: {
			colors: {
				primary: '#7b3fa0',
				accent: '#ff9902',
				secondary: '#161d25',
				'crm-bg': '#f8f5ff',
				'crm-surface': '#ffffff',
				'crm-surface-muted': '#faf8ff',
				'crm-border': '#e0d6f0',
				'crm-border-strong': '#c4a8e8',
				'crm-text': '#1a1a1a',
				'crm-muted': '#675b70',
				'crm-success': '#25834b',
				'crm-warning': '#81540d',
				'crm-danger': '#c0392b',
				'crm-info': '#27628a'
			},
			fontFamily: {
				sans: [
					'system-ui',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'sans-serif'
				],
				display: [
					'system-ui',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'sans-serif'
				]
			},
			backgroundImage: {
				'brand-gradient':
					'linear-gradient(120deg, #470b58 0%, #c21b84 42%, #fa595e 72%, #f8bd31 100%)'
			},
			boxShadow: {
				panel: '0 18px 52px rgba(71, 11, 88, 0.08)',
				floating: '0 24px 70px rgba(31, 18, 42, 0.2)'
			},
			borderRadius: {
				panel: '1.25rem'
			}
		}
	},
	plugins: []
}

export default config
