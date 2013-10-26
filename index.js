var http = require('http'),
    fs = require('fs'),
    url = require('url');

var ALBUMS_DIR = './gallery/';

var ERR_NO_SUCH_ALBUM = 'no_such_album';
var ERR_UNKNOWN_ERROR = 'unknown_error';
var ERR_FS_ERROR = 'filesystem_error';
var ERR_NO_HANDLER = 'no_url_handler';
var ERR_INVALID_ARGUMENT = 'invalid_argument';

// Web server request handler function
function handleRequest(req, res) {
  console.log("Incoming request: " + req.method + " " + req.url);
  req.parsedUrl = url.parse(req.url, true);
  var baseUrl = req.parsedUrl.pathname;
  var query = req.parsedUrl.query || {};

  var matches = null;

  // GET/POST /album/$albumName
  if (matches = baseUrl.match(/^\/albums\/([a-zA-Z0-9_-]+)/)) {
    var albumName = matches[1];
    if (req.method == 'GET') {
      return handleGetAlbumContents(albumName, req, res, query);
    } else if (req.method == 'POST') {
      return handleRenameAlbum(albumName, req, res);
    }
  // GET /albums
  } else if (matches = baseUrl.match(/^\/albums\/?/)) {
    return handleListAlbums(req, res, query);
  }
    
  respondNotFound(res, noHandler(req));
};

// Send a response containing the list of albums
function handleListAlbums(req, res, options) {
  console.log('List albums');
  loadAlbumList(options, function(err, albums){
    if (err) {
      if (err.code == ERR_INVALID_ARGUMENT) {
        respondError(res, 400, err);
      } else {
        respondError(res, 503, err);
      }
    } else {
      respondSuccess(res, 200, {collection: albums});
    }
  });
}

// Send a response containing the contents of a single album
function handleGetAlbumContents(albumName, req, res, options) {
  console.log('List contents of album: ' + albumName);
  loadAlbum(albumName, options, function(err, pictures) {
    if (err) {
      console.log(err);
      if (err.code == ERR_NO_SUCH_ALBUM) {
        respondNotFound(res, err);
      } else if (err.code == ERR_INVALID_ARGUMENT) {
        respondError(res, 400, err);
      } else {
        respondError(res, 503, err);
      }
    } else {
      respondSuccess(res, 200, {collection: pictures});
    }
  });
}

// Rename an existing album
function handleRenameAlbum(albumName, req, res) {
  var reqBody = '';
  req.on('readable', function() {
    var part = req.read();
    if (part) {
      if (typeof part == 'string') {
        reqBody += part;
      } else if (typeof part == 'object' && part instanceof Buffer) {
        reqBody += part.toString('utf8');
      }
    }
  });

  req.on('end', function() {
    if (reqBody) {
      try {
        var albumData = JSON.parse(reqBody);
        if (!albumData.albumName) {
          respondError(res, 400, invalidArgument('Album name is missing'));
          return;
        }
        renameAlbum(albumName, albumData, function(err, result) {
          if (err) {
            respondError(res, 500, err);
          } else {
            var location = mkUrl(req, '/albums/' + albumData.albumName);
            var headers = {'Location': location};
            var data = {'url': location};
            respondSuccess(res, 200, data, headers);
          }
        });
      } catch (err) {
        return respondError(res, 400, err);
      }
    }
  });
}

// Send a 404 response to the client
function respondNotFound(res, error) {
  respondError(res, 404, error);
}

// Send an error response with the error object wrapped properly
function respondError(res, status, error) {
  respond(res, status, {error: {
    message: error.toString(),
    code: error.code
  }});
}

// Just an alias for 'respond', for symmetry
function respondSuccess(res, status, data, additionalHeaders) {
  respond(res, status, data, additionalHeaders);
}

// Generic response handler, send response type optional error and data objects
// Content type will be set to 'application/json'
function respond(res, status, data, additionalHeaders) {
  var headers = additionalHeaders || {};
  data = data || {};

  // For now, we force content type
  headers['Content-Type'] = 'application/json';

  res.writeHead(status, headers);
  res.end(JSON.stringify(data) + "\n");
}

// Function to load album list from disk
function loadAlbumList(options, callback) {

  try {
    options = validatePager(options);
  } catch (err) {
    return callback(err);
  }

  fs.readdir(ALBUMS_DIR, function(err, files) {
    if (err) {
      callback(err);
    } else {
      albums = [];
      (function iterator(idx) {
        if (idx >= files.length || albums.length >= options.pageSize) {
          // termination condition, only on last iteration callback is invoked\
          // terminate if no more files are available or if we found enough 
          // files to return the current page, whatever happens first.
          return callback(null, albums);
        } else {
          fs.stat(ALBUMS_DIR + files[idx],
          function (err, stats) {
            if (err) {
              callback(err);
            } else {
              if (stats.isDirectory()) {
                albums.push(files[idx]);
              }
              // iterator function is called recursively inside fs.stat-callback
              iterator(idx + 1);
            }
          });
        }
      })(options.page * options.pageSize);
    }
  });
}

function loadAlbum(albumName, options, callback) {
  var path = ALBUMS_DIR + '/' + albumName + '/';

  try {
    validatePager(options);
  } catch (err) {
    return callback(err);
  }

  fs.readdir(path, function(err, files) {
    if (err) {
      // Error handling
      if (err.code == 'ENOENT') {
        callback(noSuchAlbum());
      } else {
        callback(err);
      }
    } else {
      // Find all pictures (files) in the folder
      var pictures = [];

      (function iterator(idx){
        if (idx >= files.length || pictures.length >= options.pageSize) {
          callback(null, pictures);
        } else {
          fs.stat(path + files[idx], function(err, stats) {
            if (err) {
              callback(err);
            } else if (stats.isFile()) {
              pictures.push({
                filename: files[idx],
                description: files[idx]
              });
            }
            iterator(idx + 1); // recursion to iterator
          });
        }
      })(options.page * options.pageSize);      
    }
  });
}

// Rename an album. Simply renames the folder
function renameAlbum(albumName, albumData, callback) {
  var oldPath = ALBUMS_DIR + albumName;
  var newPath = ALBUMS_DIR + albumData.albumName;

  fs.rename(oldPath, newPath, callback);
}

function mkError(errCode, msg) {
  var e = new Error(msg);
  e.code = errCode;
  return e;
}

function noSuchAlbum() {
  return mkError(ERR_NO_SUCH_ALBUM, 'The specified album does not exist');
}

function noHandler(req) {
  var msg = 'No handler for ' + req.method + ' ' + req.url;
  return mkError(ERR_NO_HANDLER, msg);
} 

function invalidArgument(msg) {
  return mkError(ERR_INVALID_ARGUMENT, msg);
}

function mkUrl(req, path) {
  return 'http://' + req.headers.host + path; 
}

function validatePager(options) {

  var page = isFinite(options.page) ? parseInt(options.page) : 0;
  var pageSize = isFinite(options.pageSize) ? parseInt(options.pageSize) : 10;

  if (page < 0) {
    throw mkError(ERR_INVALID_ARGUMENT, 'Page must be greater or equals zero');
  }

  if (pageSize <= 0) {
    throw mkError(ERR_INVALID_ARGUMENT, 'Page size must be greater than zero');
  }

  options.page = page;
  options.pageSize = pageSize;

  return options;
}

// Fire up the server on port 8080
var server = http.createServer(handleRequest);
server.listen(8080);
console.log('Server listening on localhost:8080...')
