var assert = require('assert-plus');
var jdiff = require('json-diff');

function AssertDiff() {
  assert.ok.apply(assert.ok, arguments);
}

AssertDiff.options = {strict: false};

Object.keys(assert).forEach(function(k) {
  AssertDiff[k] = function() {
    assert[k].apply(assert[k], arguments);
  };
});

AssertDiff.deepStrictEqual = function deepStrictEqual() {
  try {
    assert.deepStrictEqual.apply(assert.deepStrictEqual, arguments);
  } catch (e) {
    throw new assert.AssertionError({
      message: addDiffToMessage(e.message, jdiff.diffString(e.expected, e.actual)),
      stackStartFunction: assert.AssertionError
    })
  }
};

AssertDiff.deepEqual = function deepEqual() {
  try {
    assert.deepEqual.apply(assert.deepEqual, arguments);
  } catch (e) {
    throw new assert.AssertionError({
      message: addDiffToMessage(e.message, jdiff.diffString(e.expected, e.actual)),
      stackStartFunction: assert.AssertionError
    })
  }
  if (AssertDiff.options.strict && jdiff.diff(arguments[0], arguments[1])) {
    throw new assert.AssertionError({
      message: addDiffToMessage(arguments[2], jdiff.diffString(arguments[0], arguments[1])),
      stackStartFunction: assert.AssertionError
    })
  }
};

function addDiffToMessage(message, diff) {
  var msg = message ? message : '';
  var resetCliColorAttributes = '\u001b[m';

  return msg + resetCliColorAttributes + '\n' + diff;
}

AssertDiff.deepEqualOrig = assert.deepEqual;

module.exports = AssertDiff;
