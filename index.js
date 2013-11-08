var albumServer = require('album-server')
    albumMgr = require('album-manager');

var ALBUMS_DIR = './gallery';

// DI-style initialization

// Create album manager (service object)
var albums = albumMgr.create(ALBUMS_DIR);

// Fire up the server on port 8080
var server = albumServer.create(albums);
server.listen(8080);

console.log('Server listening on localhost:8080...')
