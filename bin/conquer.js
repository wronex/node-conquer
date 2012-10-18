#!/usr/bin/env node

var watchr	= require('watchr'),
	program = require('commander'),
	clc		= require('cli-color'),
	spawn	= require('child_process').spawn,
	path	= require('path'),
	fs		= require('fs'),
	logger	= require('./logger.js');

var extensions	= ['.js', '.json', '.coffee'], // All file extensions to watch.
	watchPaths 	= ['./'], 		// Paths to watch for changes.
	script 		= 'script', 	// The script to run.
	scriptParams= [], 			// Parameters that will be sent to the parser.
	parser 		= 'node',		// The parser that should run the script.
	instance	= null, 		// Instance of the parser process.
	restartOnCleanExit = false;	// Indicates if the parser should be restarted 
								// on clean exits (error code 0).

/**
 * Parses the supplied string of comma seperated file extensions and returns an 
 *   array of its values.
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
	return list;
}

/**
 * Parses the supplied string of comma seperated list and returns an array of
 *   its values.
 * @param {String} str - a string on the format "value1, value2, value2".
 * @retruns {String[]} - a list of all the found extensions in @a str.
 */
function listParser(str) {
	var list = str.split(',');
	for (var i = 0; i < list.length; i++)
		list[i] = list[i].replace(/(^\s?)|(\s?$)/g, '');
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
		logger.log('Killed', clc.green(script));
	
	instance.kill();
	instance = null;
}

/** Restarts the parser. */
function restart() {
	logger.log('Restarting', clc.green(script));
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
		logger.log('Starting', clc.green(script), 'with', clc.magenta(parser));
	
	if (instance)
		return;
	
	// Spawn an instance of the parser that will run the script.
	instance = spawn(parser, [script].concat(scriptParams));
	
	// Redirect the parser/script's output to the console.
	instance.stdout.on('data', function (data) { logger.scriptLog(script, data.toString()); });
	instance.stderr.on('data', function (data) { logger.scriptLog(script, data.toString(), true); });
	instance.stderr.on('data', function (data) {
		if (/^execvp\(\)/.test(data.toString())) {
			logger.error('Failed to restart child process.');
			process.exit(0);
		}
	});
	instance.on('exit', function (code, signal) {
		if (signal == 'SIGUSR2') {
			logger.error('Signal interuption');
			restart();
			return;
		}
		
		logger.log(clc.green(script), 'exited with code', clc.yellow(code));
		
		if (code == 0 && restartOnCleanExit) {
			restart();
			return;
		}
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
	.version('1.0.3')
	.usage('[options] <script> [script args ...]')
	.option('-e, --extensions <list>', 'a list of extensions to watch for changes', extensionsParser)
	.option('-w, --watch <list>', 'a list of folders to watch for changes', listParser)
	.option('-x, --exec <executable>', 'the executable that runs the script')
	.option('-r, --restart-on-exit', 'restart on clean exit')

program.on('--help', function() {
	console.log('  Required:');
	console.log('');
	console.log('    <script>  the script to run, eg. "server.js"');
	console.log('');
	console.log('  More Info:');
	console.log('');
	console.log('    <list>  a comma-delimited list, eg. "coffee,jade" or "./, bin/"');
	console.log('');
	console.log('    The default extensions are "js, json, coffee". Override using -e.');
	console.log('');
	console.log('    By default the same directory as the script is watched. Override using -w.');
	console.log('');
	console.log('    The executable that will run the script is automatically choosen based on');
	console.log('    file extension. Coffee is used for ".coffee"; otherwise Node is used.');
	console.log('    Override using -x.');
	console.log('');
	console.log('  Example:');
	console.log('');
	console.log('    $ conquer server.js');
	console.log('    $ conquer -w templates -e jade run.coffee');
	console.log('    $ conquer -x traceurc -e next IAmFuture.next');
	console.log('    $ conquer -e ".js, .jade" server.js --port 80');
	console.log('');
	console.log('    The last example will start server.js on port 80 using Node. It will');
	console.log('    monitor all .js and .jade files in the same directory (and subdirectories)');
	console.log('    as server.js for changes.');
	console.log('');
});

program.parse(process.argv);

// The input file should be the first argument.
script = program.args[0];
if (!script) {
	logger.warn('No input file!');
	process.exit(0);
	return;
}

if (!fs.existsSync(script)) {
	logger.warn('Input file not found!');
	process.exit(0);
	return;
}

if (program.watch) {
	// Watch the paths supplied by the user.
	watchPaths = program.watch;
	//logger.log('Watching paths: ' + clc.green(watchPaths.join(', ')));
} else {
	// Watch the path containing the script.
	watchPaths = [path.dirname(script)];
}

// All arguments after the input file (script) are script parameters that will
// be passed to the parser.
scriptParams = process.argv.slice(process.argv.indexOf(script) + 1);

if (program.exec) {
	// Use the user supplied parser.
	parser = program.exec;
} else {
	// Select parser based on file extension.
	if (path.extname(script) == '.coffee') {
		parser = 'coffee';
		if (process.platform.substr(0, 3) == 'win')
			parser = 'coffee.cmd';
	}
}

if (program.extensions) {
	// Watch the user supplied file extensions.
	extensions = program.extensions;
	//logger.log('Watching extensions: ' + clc.green(extensions.join(', ')));
}

restartOnCleanExit = program.restartOnExit || false;

// Watch the directory supplied by the user.
logger.log('Watching', clc.green(watchPaths.join(', ')), 'for changes to', clc.green(extensions.join(', ')));
watchr.watch({
	paths: watchPaths,
	listener: function(eventName, filePath, fileCurrentStat, filePreviousStat) {
		// We are only interesed in files with extensions that are part of the 
		// extensions array.
		var ext = path.extname(filePath).toLowerCase();
		if (extensions.indexOf(ext) != -1) {
			logger.log(clc.green(path.basename(filePath)), 'changed');
			restart();
		}
	},
	next: function(err, watcher) {
		if (err)
			throw err;
			
		//logger.log('Watcher setup successfully');
		start();
	}
});