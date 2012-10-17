# conquer
Runs NodeJS or Coffee while monitoring their code and config files for changes; 
the application is automatically restarted on crashes or changes. This allowes 
for realtime development and rapid prototyping.

## Installation
```bash
$ [sudo] npm install -g conquer
```

## Usage
```text
Usage: conquer.js [options] <app.js> [app options]

Options:

  -h, --help                     output usage information
  -V, --version                  output the version number
  -e, --extensions [".js,.txt"]  watch for changes to these file extensions

Example:

  $ conquer -e ".js, .json" server.js --port 80

  Will start server.js on port 80 using Node. It will monitor all .js and
  .json files in the same directory (and subdirectories) as server.js for
  changes.
```

## License (MIT)
Copyright (c) 2012, wronex.

## Author
[wronex][0]
[0]: http://www.wronex.com/
