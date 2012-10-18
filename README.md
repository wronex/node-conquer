# conquer
conquer will run Node or Coffee while monitoring the code and/or configuraiton
file for changes. When a change occures or when the program crashes it is 
automatically restarted. This allowes for realtime development and rapid 
prototyping.

## Installation
```bash
$ [sudo] npm install -g conquer
```

## Usage
```bash
Usage: conquer [options] <script> [script args ...]

Options:

  -h, --help               output usage information
  -V, --version            output the version number
  -e, --extensions <list>  a list of extensions to watch for changes
  -w, --watch <list>       a list of folders to watch for changes
  -x, --exec <executable>  the executable that runs the script
  -r, --restart-on-exit    restart on clean exit

Required:

  <script>  the script to run, eg. "server.js"

More Info:

  <list>  a comma-delimited list, eg. "coffee,jade" or "./, bin/"

  The default extensions are "js, json, coffee". Override using -e.

  By default the same directory as the script is watched. Override using -w.

  The executable that will run the script is automatically choosen based on
  file extension. Coffee is used for ".coffee"; otherwise Node is used.
  Override using -x.

Example:

  $ conquer server.js
  $ conquer -w templates -e jade run.coffee
  $ conquer -x traceurc IAmFuture.next
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
