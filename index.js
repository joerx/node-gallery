var http = require('http'),
    fs = require('fs');

var ALBUMS_DIR = '/home/jhenning/Pictures/';

// Web server request handler function
function handleRequest(req, res) {
  console.log("Incoming request: " + req.method + " " + req.url);
  if (req.url == '/albums') {
    handleListAlbums(req, res);
  } else if (req.url.substr(0, 8) == '/albums/') {
    handleGetAlbumContents(req, res);
  } else {
    handleNotFound(req, res);
  }
};

// Send a response containing the list of albums
function handleListAlbums(req, res) {
  console.log('List albums');
  loadAlbumList(function(err, albums){
    if (err) {
      respond(res, 503, err);
    } else {
      respond(res, 200, null, {albums: albums});
    }
  });
}

function respond(res, status, err, data) {
  res.writeHead(status, {"Content-Type": "application/json"});
  res.end(JSON.stringify({err: err, data: data}) + "\n");
}

function handleNotFound(req, res) {
  respond(res, 404, {message: 'No valid handler for url "' + req.url + '"'});
}

// Send a response containing the contents of a single album
function handleGetAlbumContents(req, res) {
  console.log('List contents of album: ');
  respond(res, 200, null, 'OK');
}

// Function to load album list from disk
function loadAlbumList(callback) {
  fs.readdir(ALBUMS_DIR, function(err, files) {
    albums = [];
    (function iterator(idx) {
      if (idx == files.length) {
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
            iterator(idx + 1);
          }
        });
      }
    })(0);
  });
}

var server = http.createServer(handleRequest);
server.listen(8080);
console.log('Server listening on localhost:8080...')
