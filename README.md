# conquer
conquer will run Node or Coffee while monitoring the code and/or configuration
file(s) for changes. When a change occures or when the program crashes it is 
automatically restarted. This allowes for realtime development and rapid 
prototyping.

As of version 1.0.4 conquer can run any program when a file changes, allowing it
to be used in more scenarios. For instance to run Stylus when a .styl file 
changes.

## Installation
```bash
$ [sudo] npm install -g conquer
```

## Usage
```bash
Usage: conquer.js [-ewr] [-x|-c] <script> [script args ...]

Options:

  -h, --help               output usage information
  -V, --version            output the version number
  -e, --extensions <list>  a list of extensions to watch for changes
  -w, --watch <list>       a list of folders to watch for changes
  -r, --restart-on-exit    restart on clean exit
  -x, --exec <executable>  the executable that runs the script
  -c, --sys-command        executes the script as a system command

Required:

  <script>  the script to run, eg. "server.js"

More Info:

  <list>  a comma-delimited list, eg. "coffee,jade" or "./, bin/"

  The default extensions are "js, json, coffee". Override using -e.

  By default the same directory as the script is watched. Override using -w.

  The executable that will run the script is automatically choosen based on
  file extension. Coffee is used for ".coffee"; otherwise Node is used.
  Override using -x.

  Using the -c option any program can be executed when a file changes. Which
  can be used to watch and compile Stylus files for example.

Example:

  $ conquer server.js
  $ conquer -w templates -e .jade server.coffee
  $ conquer -w styles -e .styl -c stylus.cmd styles -o css
  $ conquer -e ".js, .jade" server.js --port 80

  The last example will start server.js on port 80 using Node. It will
  monitor all .js and .jade files in the same directory (and subdirectories)
  as server.js for changes.
```

## License (MIT)
Copyright (c) 2012, wronex.

## Author
[wronex][0]
[0]: http://www.wronex.com/
