var http = require('http'),
    fs = require('fs');

var ALBUMS_DIR = './gallery/';

var ERR_NO_SUCH_ALBUM = 'no_such_album';
var ERR_UNKNOWN_ERROR = 'unknown_error';
var ERR_FS_ERROR = 'filesystem_error';
var ERR_NO_URL_HANDLER = 'no_url_handler';

// Web server request handler function
function handleRequest(req, res) {
  console.log("Incoming request: " + req.method + " " + req.url);
  var matches = null;
  if (matches = req.url.match(/^\/albums\/([a-zA-Z0-9_-]+)/)) {
    // var albumName = req.url.substr(8, req.url.length);
    var albumName = matches[1];
    handleGetAlbumContents(albumName, req, res);
  } else if (matches = req.url.match(/^\/albums\/?/)) {
    handleListAlbums(req, res);
  } else {
    respondNotFound(res, mkError(ERR_NO_HANDLER, 'No handler for URL ' + req.url));
  }
};

// Send a response containing the list of albums
function handleListAlbums(req, res) {
  console.log('List albums');
  loadAlbumList(function(err, albums){
    if (err) {
      respondError(res, 503, err);
    } else {
      respondSuccess(res, 200, {collection: albums});
    }
  });
}

// Send a response containing the contents of a single album
function handleGetAlbumContents(albumName, req, res) {
  console.log('List contents of album: ' + albumName);
  loadAlbum(albumName, function(err, pictures) {
    if (err) {
      console.log(err);
      if (err.code == ERR_NO_SUCH_ALBUM) {
        respondNotFound(res, err);
      } else {
        respondError(res, 503, err);
      }
    } else {
      respondSuccess(res, 200, {collection: pictures});
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
function respondSuccess(res, status, data) {
  respond(res, status, data);
}

// Generic response handler, send response type optional error and data objects
// Content type will be set to 'application/json'
function respond(res, status, data) {
  res.writeHead(status, {"Content-Type": "application/json"});
  res.end(JSON.stringify(data) + "\n");
}

// Function to load album list from disk
function loadAlbumList(callback) {
  fs.readdir(ALBUMS_DIR, function(err, files) {
    if (err) {
      callback(err);
    } else {
      albums = [];
      (function iterator(idx) {
        if (idx == files.length) {
          // termination condition, only on last iteration callback is invoked
          callback(null, albums);
          return;
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
      })(0);
    }
  });
}

function loadAlbum(albumName, callback) {
  var path = ALBUMS_DIR + '/' + albumName + '/';

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
        if (idx == files.length) {
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
      })(0);      
    }
  });
}

function mkError(errCode, msg) {
  var e = new Error(msg);
  e.code = errCode;
  return e;
}

function noSuchAlbum() {
  return mkError(ERR_NO_SUCH_ALBUM, 'The specified album does not exist');
} 

// Fire up the server on port 8080
var server = http.createServer(handleRequest);
server.listen(8080);
console.log('Server listening on localhost:8080...')
