module.exports = {
	norpc: true,
	testCommand: 'yarn run test',
	compileCommand: 'yarn run build',
	providerOptions: {
		default_balance_ether: '10000000000000000000000000',
	},
	mocha: {
		fgrep: '[skip-on-coverage]',
		invert: true,
	},
}
