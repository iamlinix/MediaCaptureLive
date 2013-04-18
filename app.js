var express = require('express');
var WebSocketServer =  require('websocket').server;
var app = express();
var http = require('http');
var fs = require('fs');
var inspect = require('util').inspect;

//global variables
var serverCons = [];
var clientCons = [];

/* Message Type Definitions
 * SERVER  - whenever a valid server is online, send this to the host, server message
 * CLIENT  - whenever a client is online, send this to the host, client message
 * SERVERS - sent from the host to clients, the list of available servers, host message
 * APPLY   - a client applies to join a server, client message
 * OFFER   - a server offers a client its stream, server message
 * ANSWER  - a client answers a OFFER, client message
 * BYE     - see you later, server/client message
*/


app.set('view engine', 'html');
app.set('views', __dirname + '/views');
console.log("dir root: " + __dirname);

app.use(express.static(__dirname + '/js'));
app.use(express.static(__dirname + '/css'));

app.engine("html", require('ejs').renderFile);

app.get('/', function (req, res) {
	// body...
	res.render('index');
});

app.get('/server', function (req, res) {
	// body...
	res.render('server');
});

app.get(/^\/js\//, function(req, res) {
  fs.readFile('.' + req.url, function (err, data) {
    if(err)
      res.end("fail to load: " + req.url);
    else
      res.send(data);
  });
});

app.get(/^\/css\//, function(req, res) {
  fs.readFile('.' + req.url, function (err, data) {
    if(err)
      res.end("fail to load: " + req.url);
    else
      res.send(data);
  });
});

/*
app.get('/js/jquery-1.8.3.min.js', function(req, res) {
	fs.readFile('./js/jquery-1.8.3.min.js', function (err, data) {
		res.send(data);
	});
	
});

app.get('/js/server.js', function(req, res) {
	fs.readFile('./js/server.js', function (err, data) {
		res.send(data);
	});
	
});

app.get('/js/client.js', function(req, res) {
	fs.readFile('./js/client.js', function (err, data) {
		res.send(data);
	});
	
});

app.get('/js/tracer.js', function(req, res) {
	fs.readFile('./js/tracer.js', function (err, data) {
		res.send(data);
	});
	
});*/

app.get('/client', function (req, res) {
	// body...
	res.render('client');
});

var httpServer = http.createServer(app).listen(8080);
console.log("server running at port: 8080");

var wsServer = new WebSocketServer({
    httpServer: httpServer,
    autoAcceptConnections: false
});

// put logic here to detect whether the specified origin is allowed.
function originIsAllowed(origin) {
    console.log('The origin is',origin);
    return true;
}

function findConnection(conAddr, type) {
	var conList;
	var ret = null;
	if(type === "SERVER") {
		conList = serverCons;
	} else {
		conList = clientCons;
	}
	for(var i = 0; i < conList.length; i ++) {
		if(conList[i].remoteAddress == conAddr) {
			ret = conList[i];
			break;
		} 
	}
	return ret;
}

function shiftCons(startIndex, cons) {
  for(var i = startIndex; i < cons.length; i ++) {
    cons[i - 1] = cons[i];
  }
  cons.pop();
}

function removeConnection(con) {
  /* let's just assume that servers never go offline
  for(var i = 0; i < serverCons.length; i ++) {
    if(serverCons[i].remoteAddress == con.remoteAddress) {
      shiftCons(i + 1, serverCons);
      break;
    }
  }
  */

  for(var i = 0; i < clientCons.length; i ++) {
    if(clientCons[i].remoteAddress == con.remoteAddress) {
      shiftCons(i + 1, clientCons);
      break;
    }
  }
}

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    var con = request.accept('app', request.origin);

    console.log((new Date()) + ' Connection accepted.');

    con.on('message', function(message) {
        if (message.type === 'utf8') {
           processMessageFromClient(con,message.utf8Data);
        }
        else if (message.type === 'binary') {
           console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
        }
    });
    
    Array.prototype.contains = function(obj) {
       var i = this.length;
       while (i--) {
          if (this[i] === obj) {
              return true;
          }
      }
      return false;
    }

    function processMessageFromClient(con,message) {

       var msg = JSON.parse(message);
       msg.source = con.remoteAddress;
       console.log("on message: " + msg.msg_type);
       switch(msg.msg_type) {
       
          case "SERVER":
          		//a server is online, add it's connection to the pool
                if(findConnection(con.remoteAddress, "SERVER") == null) {
               	 serverCons[serverCons.length] = con;
                }
                //console.log("current servers: " + inspect(serverCons));
                break;
   	    
          case "CLIENT":
          		//a client is online
                if(findConnection(con.remoteAddress, "CLIENT") == null) {
                	clientCons[clientCons.length] = con;
                }
                //console.log("current clients: " + inspect(clientCons));
                var msgServers = {};
                msgServers.msg_type = "SERVERS";
                msgServers.servers = [];
                for(var i = 0; i < serverCons.length; i ++) {
                	msgServers.servers[i] = serverCons[i].remoteAddress;
                }
                con.send(JSON.stringify(msgServers));
                break;
   	    
          case "OFFER":
          		var toCLient = findConnection(msg.peer, "CLIENT");
          		//console.log("offer peer: " + inspect(clientCons));
          		console.log("in offer: " + msg.peer);
          		if(toCLient != null) {
          			toCLient.send(JSON.stringify(msg));
          			console.log("S -> C  OFFER  sdp section :");
                    console.log(msg.data.sdp);
          		} else {
          			console.log("***ERROR*** No peer client " + msg.peer + " can be found for OFFER message");
          		}
                break;
   	    
          case "ANSWER":
          		var toServer = findConnection(msg.peer, "SERVER");
          		if(toServer != null) {
          			toServer.send(JSON.stringify(msg));
          			console.log("C -> S  ANSWER  sdp section :");		       
          		} else {
          			console.log("***ERROR*** No peer server " + msg.peer + " can be found for ANSWER message");
          		}
               break;
   	    
          case "BYE":
          		findConnection(con.remoteAddress, msg.me).send(JSON.stringify(msg));
          		if(msg.me === "SERVER") {
          			console.log("S -> C  BYE");
          		}  else {
          			console.log("C -> S  BYE");
          		}
               break;
   	    
          case "CANDIDATE": 
              console.log(msg.peer);
          		if(msg.me === "SERVER") {
          			var toSend = findConnection(msg.peer, "CLIENT");
          			//console.log(inspect(clientCons));
          			if(toSend != null) {
          				toSend.send(JSON.stringify(msg));
          				console.log("S -> C  CANDIDATE");
                  //console.log(msg.candidate);
          			}
          		} else {
          			var toSend = findConnection(msg.peer, "SERVER");
          			if(toSend != null) {
          				toSend.send(JSON.stringify(msg));
          				console.log("C -> S  CANDIDATE");
                  //console.log(msg.candidate);
          			}
          		}
                break;

          case "APPLY":
          		var toServer = findConnection(msg.peer, "SERVER");
          		if(toServer != null) {
          			msg.peer = con.remoteAddress;
          			toServer.send(JSON.stringify(msg));
          			console.log("C -> S  APPLY");		       
          		} else {
          			console.log("***ERROR*** No peer server " + msg.peer + " can be found for APPLY message");
          		}
              	break;
   	    
           default:
               console.log('Not switched on ' + msg.msg_type);
         }	    
    }
   
    con.on('close', function(reasonCode, description) {
        removeConnection(con);
        console.log((new Date()) + ' Peer ' + con.remoteAddress + ' disconnected.');
    });
    
});
