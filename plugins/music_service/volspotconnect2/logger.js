// A simple logger wrapper for NodeJS
// https://github.com/ashthespy

const chalk = require('chalk');
const util = require('util');

// Template for a pretty console
const template = {
  log: chalk.bold.white,
  debug: chalk.bold.cyan,
  info: chalk.blue,
  error: chalk.bold.red,
  warn: chalk.keyword('orange'),
  cmd: chalk.green,
  var: chalk.bold.underline.cyanBright,
  evnt: chalk.bold.green,
  state: chalk.bold.cyanBright
};

const prettyLog = (chalkFnc, args) => {
  console.log(chalk.green('[SpotifyConnect]'),
    chalkFnc(...args.map((x) => {
      if (x instanceof Error) { return x.stack || x.message; } else if (typeof x === 'string') { return x; } else {
        return util.inspect(x, {
          showHidden: true,
          depth: null
        });
      }
    }))
  );
};

module.exports = {
  log: (...args) => {
    prettyLog(template.log, args);
    return args[0];
  },

  debug: (...args) => {
    prettyLog(template.debug, args);
    return args[0];
  },

  info: (...args) => {
    prettyLog(template.info, args);
    return args[0];
  },

  warn: (...args) => {
    prettyLog(template.warn, args);
    return args[0];
  },

  error: (...args) => {
    prettyLog(template.error, args);
    return args[0];
  },

  cmd: (...args) => {
    prettyLog(template.cmd, args);
    return args[0];
  },

  var: (...args) => {
    prettyLog(template.var, args);
    return args[0];
  },

  evnt: (...args) => {
    prettyLog(template.evnt, args);
    return args[0];
  },

  state: (...args) => {
    prettyLog(template.state, args);
    return args[0];
  }

};
