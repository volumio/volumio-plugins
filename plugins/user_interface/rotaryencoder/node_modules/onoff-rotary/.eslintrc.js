module.exports = {
	root: true,
	parser: 'babel-eslint',
	parserOptions: {
		ecmaVersion: 6,
		sourceType: 'module'
	},
	extends: 'airbnb-base',
	env: {
		'browser': true
	},
	rules: {
		'no-comma-dangle': 'off',
		'comma-dangle': [
			'error',
			'always-multiline'
		],
		indent: [
			'warn',
			'tab',
			{
				SwitchCase: 1,
			},
		],
		'object-curly-spacing': [
			'error',
			'always'
		],
		'import/no-unresolved': 'off', // does not work with the ember resolver
		'max-len': [
			'error',
			120,
			{
				'ignorePattern': 'Logger\\.|computed\\(|observer\\(',
			}
		],
		'no-param-reassign': 'off', // tbd
		'func-names': 'off', //tbd
		'prefer-arrow-callback': 'off', // tbd
		'prefer-rest-params': 'off', //tbd
		'new-cap': [
			'error',
			{
				properties: false,
				capIsNewExceptions: [
					'A', // Ember.A()
				]
			}
		],
		'no-underscore-dangle': 'off',
		'consistent-this': [
			'error',
			'that',
		],
		'no-alert': 'off', //tbd
		'newline-after-var': 'error',
		'newline-before-return': 'error',
		'no-multiple-empty-lines': [
			'error',
			{
				'max': 1,
			},
		],
		'newline-per-chained-call': [
			'error',
			{
				'ignoreChainWithDepth': 2,
			},
		],
	},
};
