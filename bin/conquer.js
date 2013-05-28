#!/usr/bin/env node

var watchr	= require('watchr'),
	program = require('commander'),
	clc		= require('cli-color'),
	wsock	= require('wsock'),
	spawn	= require('child_process').spawn,
	path	= require('path'),
	fs		= require('fs'),
	logger	= require('./logger');

var extensions	= ['.js', '.json', '.coffee'], // All file extensions to watch.
	watchPaths 	= ['./'], 		// Paths to watch for changes.
	script 		= 'script.js', 	// The script to run.
	scriptName  = 'script',		// Name of the script it run, without extension.
	scriptParams= [], 			// Parameters that will be sent to the parser.
	parser 		= 'node',		// The parser that should run the script.
	parserParams= [],			// Parameters sent to the parser.
	instance	= null, 		// Instance of the parser process.
	restartOnCleanExit = false,	// Indicates if the parser should be restarted 
								// on clean exits (error code 0).
	keepAlive = false,			// Restart on exit, error and change.
	webSocketServer = null		// A WebSocket server that will notify any 
								// connected client of changes made to files. 
								// This will allow browsers to refresh their 
								// page. The WebSocket client will be sent
								// 'restart' when the script is restarted and
								// 'exit' when the script exists.

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
 * @param {String} [signal] - indicates which kill signal that sould be sent 
 *   toLowerCase the child process (only applicable on Linux). Defaults to null.
 */
function kill(noMsg, signal) {
	if (!instance)
		return;

	try {
		if (signal)
			instance.kill(signal);
		else
			process.kill(instance.pid);
		
		if ((noMsg || false) !== true)
			logger.log('Killed', clc.green(script));
	} catch (ex) {
		// Process was already dead.
	} 
	
	instance = null;
}

/** Restarts the parser. */
function restart() {
	logger.log('Restarting', clc.green(script));
	notifyWebSocket('restart');
	kill(true);
	start(true);
}

/**
 * Notifies all connection WebSocket clients by sending them the supplied 
 *   message.
 * @param message {String} - a message that will be sent to all WebSocket 
 *   clients currently connected.
 */
function notifyWebSocket(message) {
	if (!webSocketServer || !message)
		return;
	
	// Send the message to all connection in the WebSocket server.
	for (var value in webSocketServer.conn) {
		var connection = webSocketServer.conn[value];
		if (connection)
			connection.send(message)
	}
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
	instance = spawn(parser, parserParams);
	
	// Redirect the parser/script's output to the console.
	instance.stdout.on('data', function (data) { 
		logger.scriptLog(scriptName, data.toString()); 
	});
	instance.stderr.on('data', function (data) { 
		logger.scriptLog(scriptName, data.toString(), true); 
	});
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
		notifyWebSocket('exit');
		
		if (keepAlive || (restartOnCleanExit && code == 0)) {
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

// Propage signals to child process.
['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS', 
 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGTERM'
].forEach(function(signal) {
	try {
		process.on(signal, (function(signal) {
			logger.log('Sending signal', clc.yellow(signal), 'to', 
				clc.green(script));
			
			kill(true, signal);
			process.exit(0);
		}).bind(this, signal));
	} catch (ex) {
		// Ignore those that does not exist on Windows.
	}
});


// Configure commander for the commands it should accept from the user.
program
	.version('1.1.2')
	.usage('[-ewras] [-x|-c] <script> [script args ...]')
	.option('-e, --extensions <list>', 'a list of extensions to watch for changes', extensionsParser)
	.option('-w, --watch <list>', 'a list of folders to watch for changes', listParser)
	.option('-r, --restart-on-exit', 'restart on clean exit (exit status 0)')
	.option('-a, --keep-alive', 'restart on exit, error or chanage')
	.option('-x, --exec <executable>', 'the executable that runs the script')
	.option('-c, --sys-command', 'executes the script as a system command')
	.option('-s, --websocket <port>', 'start a WebSocket server to notify browsers', parseInt)

program.on('--help', function() {
	console.log('  Required:');
	console.log('');
	console.log('    <script>  the script to run, eg. "server.js"');
	console.log('');
	console.log('  More Info:');
	console.log('');
	console.log('    <list>  a comma-delimited list, eg. "coffee,jade" or "./, bin/"');
	console.log('');
	console.log('');
	console.log('    The default extensions are "js, json, coffee". Override using -e.');
	console.log('');
	console.log('    By default the directory containing the script is watched. Override');
	console.log('    using -w.');
	console.log('');
	console.log('    The executable that will run the script is automatically choosen based on');
	console.log('    file extension. Coffee is used for ".coffee"; otherwise Node is used.');
	console.log('    Override using -x.');
	console.log('');
	console.log('    Any program can be executed when a file changes by using the -c option.');
	console.log('    It can for example be used to watch and compile Stylus files.');
	console.log('');
	console.log('    A WebSocket server can be started using the -s options. The WebSocket');
	console.log('    server can be used to automatically reload browsers when a file changes.');
	console.log('    See ./test/websocket/ for an example.');
	console.log('');
	console.log('  Example:');
	console.log('');
	console.log('    $ conquer server.js');
	console.log('    $ conquer -w templates -e .jade server.coffee');
	console.log('    $ conquer -w styles -e .styl -c stylus.cmd styles -o css');
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
scriptName = path.basename(script, path.extname(script));
if (!script) {
	logger.warn('No input file!');
	process.exit(0);
	return;
}

if (!program.sysCommand && !fs.existsSync(script)) {
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

if (program.sysCommand) {
	// No parser will be used, since no script will be ran. Instead, the script
	// variable holds the name of the executable to run.
	parser = script;
	parserParams = scriptParams;
} else {
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
	
	// The first parameters give to Node should be the name of the script to run
	// followed by the parameters to that script.
	parserParams = [script].concat(scriptParams);
}

if (program.extensions) {
	// Watch the user supplied file extensions.
	extensions = program.extensions;
	//logger.log('Watching extensions: ' + clc.green(extensions.join(', ')));
}

restartOnCleanExit = program.restartOnExit || false;
keepAlive = program.keepAlive || false;

if (program.websocket) {
	webSocketServer = wsock.createServer();
	
	// Store all new connections in a list of the server.
	webSocketServer.conn = {};
	webSocketServer.on('connect', function(connection) {
		webSocketServer.conn[connection] = connection;
		connection.on('close', function() {
			delete webSocketServer.conn[connection];
		})
	});
	
	webSocketServer.listen(program.websocket || 8083, function() {
		logger.log('WebSocket server running at', 
			clc.green('ws://localhost:' + program.websocket));
	});
}

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