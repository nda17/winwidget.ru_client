import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const pricingPath = new URL(
	'../src/screens/payment/ui/pricing/Pricing.tsx',
	import.meta.url
)

const sourceText = await readFile(pricingPath, 'utf8')
const sourceFile = ts.createSourceFile(
	pricingPath.pathname,
	sourceText,
	ts.ScriptTarget.Latest,
	true,
	ts.ScriptKind.TSX
)

const findArrowFunction = name => {
	let result = null

	const visit = node => {
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text === name &&
			ts.isArrowFunction(node.initializer)
		) {
			result = node.initializer
			return
		}

		ts.forEachChild(node, visit)
	}

	visit(sourceFile)
	return result
}

test('anonymous payment redirects to login before opening checkout', () => {
	const handler = findArrowFunction('handlePaymentClick')

	assert.ok(handler)
	assert.ok(ts.isBlock(handler.body))

	const statements = [...handler.body.statements]
	const authGuardIndex = statements.findIndex(
		statement =>
			ts.isIfStatement(statement) &&
			statement.expression.getText(sourceFile).replaceAll(' ', '') ===
				'!auth'
	)
	const paymentStartIndex = statements.findIndex(statement =>
		statement.getText(sourceFile).includes('startPayment(')
	)

	assert.equal(authGuardIndex, 0)
	assert.ok(paymentStartIndex > authGuardIndex)

	const authGuard = statements[authGuardIndex]
	assert.ok(ts.isIfStatement(authGuard))

	const guardText = authGuard.thenStatement
		.getText(sourceFile)
		.replace(/\s+/g, '')

	assert.match(
		guardText,
		/toast\.error\(PAYMENT_COPY\.authenticationRequiredText\)/
	)
	assert.match(guardText, /router\.push\(PUBLIC_PAGES\.LOGIN\)/)
	assert.match(guardText, /return/)
	assert.doesNotMatch(
		guardText,
		/openPaymentWindow|window\.open|startPayment/
	)
})
