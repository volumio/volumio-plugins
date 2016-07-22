exports['test that logs all failures'] = function(assert) {
	var tools = require('../lib/tools');

	assert.equal(true, tools.isNumeric(1), 'Test numeric');
	assert.equal(false, tools.isNumeric('a'), 'Test non numeric');

	assert.equal(true, tools.isSet(tools), 'Test isSet');

	assert.equal('0cc175b9c0f1b6a831c399e269772661', tools.hash('a'), 'Test hash');
	assert.equal('86f7e437faa5a7fce15d1ddcb9eaeaea377667b8', tools.hash('a', 'sha1'), 'Test hash');
	assert.equal('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb', tools.hash('a', 'sha256'), 'Test hash');
	assert.equal('1f40fc92da241694750979ee6cf582f2d5d7d28e18335de05abc54d0560e0f5302860c652bf08d560252aa5e74210546f369fbbbce8c12cfc7957b2652fe9a75', tools.hash('a', 'sha512'), 'Test hash');

	assert.equal(false, tools.validateEmail('test'), 'Test validateEmail');
	assert.equal(true, tools.validateEmail('tareqzubidee@gmail.com'), 'Test validateEmail');
}
 
if (module == require.main) require('test').run(exports)