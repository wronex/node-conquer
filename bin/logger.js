#!/usr/bin/env node

var clc		= require('cli-color'),
	util	= require('util');

/**
 * Writes the supplied message to the log.
 * @param {String} msg - the message.
 * @param {Function} [color] - the clc coloring function to use on each message.
 * @param {String} [prefix] - a message prefix. Defaults to '[conquer]'.
 */
function write(msg, color, prefix) {
	if (!prefix)
		prefix = clc.cyan('[conquer]');

	// Print each line of the message on its own line.
	var messages = msg.split('\n');
	for (var i = 0; i < messages.length; i++) {
		var message = messages[i].replace(/(\s?$)|(\n?$)/gm, '');
		if (message && message.length > 0)
			console.log(prefix, color ? color(message) : message);
	}
}

/** Writes the supplied parameters to the log. */
function log() {
	var msg = util.format.apply(null, Array.prototype.slice.call(arguments, 0));
	write(msg);
}

/** Writes the supplied parameters to the log as a warning. */
function warn() {
	var msg = util.format.apply(null, Array.prototype.slice.call(arguments, 0));
	write(msg, clc.yellow);
}

/** Writes the supplied parameters to the log as an error. */
function error() {
	var msg = util.format.apply(null, Array.prototype.slice.call(arguments, 0));
	write(msg, clc.red);
}

/**
 * Writes the supplied message from the running application to the log.
 * @param {String} app - the name of the running application.
 * @param {String} msg - the message.
 * @param {Boolean} isError - indicates if the message is an error message.
 */
function appLog(app, msg, isError) {
	write(msg, 
		isError ? clc.red : null, 
		clc.yellow('[' + app + ']'));
}

// Public interface:
exports.log = log;
exports.warn = warn;
exports.error = error;
exports.appLog = appLog;