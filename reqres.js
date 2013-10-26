var http = require('http');

function handleRequest(req, res) {
  console.log('---------------------------------');
  console.log(req);
  console.log('---------------------------------');
  console.log(res);
  console.log('---------------------------------');
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end("OK\n");
}

var s = http.createServer(handleRequest);
s.listen(9000);