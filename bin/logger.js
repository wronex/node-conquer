#!/usr/bin/env node

var clc		= require('cli-color'),
	util	= require('util');

/** Writes the supplied parameters to the log. */
function log() {
	arguments[0] = clc.cyan('[conquer]') + ' ' + arguments[0];
	console.log.apply(console, arguments);
}

/** Writes the supplied parameters to the log as a warning. */
function warn() {
	log(clc.yellow(util.format.apply(null, Array.prototype.slice.call(arguments, 0))));
}

/** Writes the supplied parameters to the log as an error. */
function error() {
	log(clc.red(util.format.apply(null, Array.prototype.slice.call(arguments, 0))));
}

function appLog(app, msg) {
	app = clc.yellow('[' + app + ']');
	msg = msg.replace(/\n?$/g, '');
	console.log.apply(console, arguments, ' ', msg);
}

function appError(app, msg) {
	appLog(app, clc.red(msg));
}


// Public methods:
exports.log = log;
exports.warn = warn;
exports.error = error;
exports.appLog = appLog;
exports.appError = appError;