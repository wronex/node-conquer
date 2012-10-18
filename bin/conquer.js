#!/usr/bin/env node

var watchr	= require('watchr'),
	program = require('commander'),
	clc		= require('cli-color'),
	spawn	= require('child_process').spawn,
	path	= require('path'),
	logger	= require('./logger.js');

var extensions	= ['.js', '.json', '.coffee'], // All file extensions to watch.
	appPath 	= './', 	// Path to the script.
	app 		= 'app.js', // The script to run.
	appParams 	= [], 		// Parameters that will be sent to the parser.
	parser 		= 'node'	// The parser that should run the script.
	instance	= null; 	// Instance of the parser process.

/**
 * Parses the supplied string of comma seperated file extensions and returns a 
 *   list.
 * @param {String} str - a string on the format ".ext1,.ext2,.ext3".
 * @retruns {String[]} - a list of all the found extensions in @a str.
 */
function extensionsParser(str) {
	// Convert the file extensions string to a list.
	var list = str.split(',');
	for (var i = 0; i < list.length; i++) {
		// Make sure the file extension has the correct format: '.ext'
		var ext = '.' + list[i].replace(/(^\s?\.?)|(\s?$)/g, '');
		list[i] = ext.toLowerCase();
	}
	console.log('%j', list)
	return list;
}

/** 
 * Kills the parser. 
 * @param {Boolean} [noMsg] - indicates if no message should be written to the 
 *   log. Defaults to false.
 */
function kill(noMsg) {
	if (!instance)
		return;

	if ((noMsg || false) !== true)
		logger.log('Killed', clc.green(app));
	
	instance.kill();
	instance = null;
}

/** Restarts the parser. */
function restart() {
	logger.log('Restarting', clc.green(app));
	kill(true);
	start(true);
}

/** 
 * Starts and instance of the parser if none is running.
 * @param {Boolean} [noMsg] - indicates if no message should be written to the 
 *   log. Defaults to false.
 */
function start(noMsg) {
	if ((noMsg || false) !== true)
		logger.log('Starting', clc.green(app), 'with', clc.magenta(parser));
	
	if (instance)
		return;
	
	// Spawn an instance of the parser that will run the app.
	instance = spawn(parser, [app].concat(appParams));
	
	// Redirect the parser/app's output to the console.
	instance.stdout.on('data', function (data) { logger.appLog(app, data.toString()); });
	instance.stderr.on('data', function (data) { logger.appLog(app, data.toString(), true); });
	instance.stderr.on('data', function (data) {
		if (/^execvp\(\)/.test(data.toString())) {
			logger.error('Failed to restart child process.');
			process.exit(0);
		}
	});
	instance.on('exit', function (code, signal) {
		if (signal == 'SIGUSR2') {
			logger.error('Signal interuption.');
			restart();
		};
	});
}

// Listen for uncaught exceptions that might be thrown by this script.
process.on('uncaughtException', function(error){
	logger.error(error.stack.toString());
	restart();
});

// Make sure to kill the parser process when this process is killed.
process.on('exit', function(code) {
	kill();
});

if (process.platform.substr(0, 3) !== 'win') {
	process.on('SIGINT', function() {
		logger.warn('User killed process');
		kill();
		process.exit(0);
	});

	process.on('SIGTERM', function() {
		kill();
		process.exit(0);
	});
}

// Configure commander for the commands it should accept from the user.
program
	.version('1.0.2')
	.usage('[options] <app.js> [app options]')
	.option('-e, --extensions [".js,.txt"]', 
			'watch for changes to these file extensions', 
			extensionsParser);

program.on('--help', function(){
	console.log('  Example:');
	console.log('');
	console.log('    $ conquer -e ".js, .json" server.js --port 80');
	console.log('');
	console.log('    Will start server.js on port 80 using Node. It will monitor all .js and');
	console.log('    .json files in the same directory (and subdirectories) as server.js for');
	console.log('    changes.');
	console.log('');
});

program.parse(process.argv);

// The input file should be the first argument.
if (program.args.length == 0) {
	logger.warn('No input file!');
	process.exit(0);
	return;
}
app = program.args[0];
appPath = path.dirname(app);

// All arguments after the input file (app) are app parameters that will be 
// passed to the parser.
appParams = process.argv.slice(process.argv.indexOf(app) + 1);

// Select parser based on file extension.
if (path.extname(app) == '.coffee') {
	parser = 'coffee';
	if (process.platform.substr(0, 3) == 'win')
		parser = 'coffee.cmd';
}

if (program.extensions) {
	extensions = program.extensions;
	logger.log('Watching extensions: ' + clc.green(extensions.join(', ')));
}

// Watch the directory supplied by the user.
watchr.watch({
	path: appPath,
	listener: function(eventName, filePath, fileCurrentStat, filePreviousStat) {
		// We are only interesed in files with extensions that are part of the 
		// extensions array.
		var ext = path.extname(filePath).toLowerCase();
		if (extensions.indexOf(ext) != -1) {
			logger.log(clc.green(path.basename(filePath)), 'changed');
			restart();
		}
	},
	next: function(err,watcher) {
		if (err) 
			throw err;
			
		logger.log('Watcher setup successfully');
		start();
	}
});