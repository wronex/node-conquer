#!/usr/bin/env node

var watchr	= require('watchr'),
	program = require('commander'),
	clc		= require('cli-color'),
	spawn	= require('child_process').spawn,
	path	= require('path'),
	logger	= require('./logger.js');

var extensions	= ['.js', '.json', '.coffee'], // All file extensions to watch.
	appPath 	= '', 		// Path to the script.
	app 		= 'app.js', // The script to run. 
	appParams 	= [], 		// Parameters that will be sent to the parser.
	parser 		= 'node' 	// The parser that should run the script.
	instance	= null; 	// Instance of the parser process.

// Configure commander for the commands it should accept from the user.
program
	.version('1.0.1')
	.usage('[options] <app.js> [app options]')
	.option('-e, --extensions [".js,.txt"]', 'watch for changes to these file extensions');

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
appParams = process.argv.slice(process.argv.indexOf(app) + 1);

// Select parser based on file extension.
if (path.extname(app) == '.coffee') {
	parser = 'coffee';
	if (process.platform.substr(0, 3) == 'win')
		parser = 'coffee.cmd';
}

if (program.extensions) {
	// Convert the file extensions to a list.
	extensions = program.extensions.split(',');
	for (var i = 0; i < program.extensions.length; i++) {
		// Make sure the file extension has the correct format: '.ext'
		var ext = '.' + program.extensions[i].replace(/(^\s?\.?)|(\s?$)/g, '');
		program.extensions[i] = ext.toLowerCase();
	}
	
	logger.log('Watching extensions: ' + clc.green(program.extensions.join(', ')));
}

/** Kills the parser. */
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

/** Starts and instance of the parser. */
function start(noMsg) {
	if ((noMsg || false) !== true)
		logger.log('Starting', clc.green(app), 'with', clc.magenta(parser));
	
	if (instance)
		return;
	
	// Spawn an instance of the parser.
	instance = spawn(parser, [app].concat(appParams));
	
	// Redirect the parser's output to the console.
	instance.stdout.on('data', function (data) { logger.appLog(app, data.toString()); });
	instance.stderr.on('data', function (data) { logger.appError(app, data.toString()); });
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

// Watch the directory supplied by the user.
watchr.watch({
	path: appPath,
	listener: function(eventName, filePath, fileCurrentStat, filePreviousStat) {
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

// Listen for uncaught exceptions that might be thrown by this script.
process.on('uncaughtException', function(error){
	logger.error(error.toString());
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