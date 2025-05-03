module.exports = {
	languageOptions: {
		ecmaVersion: 'latest',
	},
	rules: {
		indent: ['error', 'tab'],
		'linebreak-style': [
			'error',
			'windows'
		],
		'no-console': [
			'error',
			{
				'allow': [
					'error'
				]
			}
		],
		quotes: ['error', 'single'],
		'semi': [
			'error',
			'always'
		],
		'no-unused-vars': [
			'error',
			{
				'vars': 'all',
				'args': 'after-used',
				'ignoreRestSiblings': false
			}
		]
	}
};