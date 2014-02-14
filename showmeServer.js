#!/usr/bin/env node

/*********************************************************************************************

ShowMe Socket Server v. 0.6

The ShowMe Socket Server connects devices and relays touch events from device to device.  Are
there lots of other and potentially better ways to do this?  Probably.  But this one works
for now, is portable, and remains happy up to several hundres devices at least.

Note that this is a very simple, very procedural WebSocket server, based on the websocet-node 
package https://github.com/Worlize/WebSocket-Node

Some nuts and bolts for this server are based on Colin J. Ihrig's very sane 
WebSocket example code, to be found here:
http://cjihrig.com/blog/creating-your-own-node-js-websocket-echo-server/

Please contact aubrey@bunnyandboar.com with questions and bugs!

*********************************************************************************************/


var WebSocketServer = require('websocket').server;
var http = require('http');
var url = require('url');

var serverPort = 8888;

var interfaces = require('os').networkInterfaces();
var addresses = [];
for (k in interfaces) {
    for (k2 in interfaces[k]) {
        var address = interfaces[k][k2];
        if (address.family == 'IPv4' && !address.internal) {
            addresses.push(address.address)
        }
    }
}


var server = http.createServer(function(request, response) {
    
	console.log((new Date()) + ' Received request for ' + request.url);
    
	// fallback URL handlers
  var uri = url.parse(request.url).pathname;

	
	// basic http responses, send something useful if someone just hits / with a browser
  if (uri == '/') {
    
		response.writeHead(200, {'Content-Type': 'text/plain'});
		
		response.write('You\'re in luck!  The Show Me Server is alive and kicking!.\n\n');
		
		response.write('-----------------------');
		response.write('\nAvailable IP address(s) for this Show Me server are below\n\n');
		response.write('Enter one of the addresses below (with the port included!) in\n');
		response.write('the "Server Address" field in the ShowMe screen on your devices.\n\n');
		
		for (var a in addresses) {
			
			response.write(addresses[a] + ':' + serverPort + '\n');
			
		}
		
    response.end('\n-----------------------\n');
    
		return;
  
	}
    

  // and some default http behavior for other requests...  
  response.writeHead(404);
  response.end();


});


// bind to our port, note that you can front-end this with Nginx or Apache and 
// proxy-pass port 80 to this process's port.  Mobile networks in particular
// seem to not like socket connections on non-standard ports.  shouldn't matter
// for lan, though.

server.listen(serverPort, function() {
	console.log((new Date()) + ' Server is listening on port ' + serverPort);
});

// create the websocket listner.
wsServer = new WebSocketServer({
	
    httpServer: server,

    // down the path, we may want to verify the connection's origin and decide 
		// whether or not to accept it, so:
    autoAcceptConnections: false

});

// in-memory client counter
wsServer.clients = [];


// a quick check to see if this origin can connect
// for now, we're taking 'em all!
function originIsBanned(origin) {

  //! TBD  
  // we *may* want a black-list IP table for people who bomb us or otherwise mis-use...
  
  return false;
  
}


// placeholder for session cleanup
function endSession(inSessionID) {
  
  console.log("ending session");
  
}


// handle incoming requests on the socket
wsServer.on('request', function(request) {
    
	if (originIsBanned(request.origin)) {
		
  	// Make sure we only accept requests from an allowed origin
    request.reject();
    console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
  
	  return;
  
	}
   
  // creating "fxos-showme-protocol" for these kinds of clients
  var connection = request.accept('fxos-showme-protocol', request.origin);
    
  console.log((new Date()) + ' Connection accepted');
    
  
	// handle messages on the socket
	connection.on('message', function(message) {
        
  	if (message.type === 'utf8') {
    	console.log('Received Message: ');
			console.log(message.utf8Data);
            
      wsServer.processMessage(connection, message);
               
    }
    
    /*
    // can check for binary msg type, little beyond our scope here though
    else if (message.type === 'binary') {
        console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
        //connection.sendBytes(message.binaryData);
        wsServer.processBinary(connection, message);
    }
    */
        
	}); // end connection on "message""
    
    
		
	// handle the end of a WebSocket Session
	connection.on('close', function(reasonCode, description) {
    
      
		var newClientCount = wsServer.clients.length - 1;
	  var msg = '{ "type": "clientcount", "status": "ok", "clients": ' + newClientCount + ', "x": 0, "y": 0 }';
      
	  for (var i=0; i<wsServer.clients.length; i++) {
      
	    if (wsServer.clients[i].smClientID == connection.smClientID) {      
    
	      matchFound = true;
    
	      wsServer.clients.splice(i, 1);
    
	      console.log("removed client: " + connection.smClientID);
      
	      endSession(connection.smClientID);
   
	    }
	    else {
	      wsServer.clients[i].sendUTF(msg);
	    }
  
	  }
      
		console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
      
      
	}); // end connection on "close"


}); // end of the wsServer connection handlers



// local message processors
wsServer.processMessage = function(inConnection, inMessage) {
  
  var messageData = JSON.parse(inMessage.utf8Data);
  
  
  if (messageData.type == "hello") {
    
    console.log("NEW howzit from client: " + messageData.clientID + " @ " + inConnection.remoteAddress);
    
    inConnection.smClientID = messageData.clientID;
		inConnection.smGroupID = messageData.groupID;
    
    console.log("new connect from: " + messageData.clientType);

    wsServer.clients.push(inConnection);
    console.log("current clients array length: " + wsServer.clients.length);
    
    
    var msg = '{ "type": "clientcount", "status": "ok", "clients": ' + wsServer.clients.length + ', "x": 0, "y": 0 }';
    
    // update all clients with new client count
    for (var i=0; i<wsServer.clients.length; i++) {
			
      wsServer.clients[i].sendUTF(msg);
    
		}
        
    
  }
  
	// the uiEvent message type serves as a catchall opcode for a touch event 
	// on the controlling phone
  else if (messageData.type == "uiEvent") {
	
		// convey to ALL clients in that group	      
		for (var i=0; i<wsServer.clients.length; i++) {

			var client = wsServer.clients[i];

			console.log("\nmessage from client ID: " + messageData.clientID);
			console.log("this client id is: " + client.smClientID);

			console.log("message for group: " + messageData.groupID);
			console.log("found client in group: " + client.smGroupID);

			
			if (messageData.groupID == client.smGroupID && messageData.clientID != client.smClientID) {
			  console.log("relaying event!");
				client.sendUTF(inMessage.utf8Data);
			}
			else {
				console.log("group mismatch or client and server are the same, doing nothing, this is not an error");
			}

		}
		
	}
  
  
}; // end of wsServer.processMessage



wsServer.processBinary = function(inConnection, inMessage) {
  
  inConnection.sendUTF(inMessage.utf8Data);
  
  console.log("calling wsServer.processBinaryMessage, this shoudn't be happening....");
  
};


