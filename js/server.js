//"use strict"

// References
//
// Original code as provided by Antony Meyn (Nov 03, 2012)
//
// https://groups.google.com/forum/?fromgroups=#!topic/discuss-webrtc/emzrT-WDhoE
// Getting a Simple Example of webkitRTCPeerConnection to work
//
// Updated to a combined version of client and server by Dick Gooris (Dec 27, 2012)
//
// Then got overthrown by Sean Lin 
// Please note things are totally different from the original version(Apr 17 2013)
//a=candidate:1136157128 1 udp 2113937151 10.175.13.1 60969 typ host generation 0

// This is where the node.js is running
var nodeHostAddress  = "127.0.0.1";
var nodeHostPort     = "8080";
var serverHostAddress;

var stunServer       = "stun:stun.l.google.com:19302";//"stun:10.175.13.1:8081";
var channelReady     = false;

var peerCons = {};
var socket;
var localStream;
var remoteStream;

// Obtain the script parameter (CLIENT or SERVER)
var params = document.body.getElementsByTagName('script');
var query = params[0].classList;
var weAreActingAs = query[0];

var clientEntry = '<button onclick="connect(\'%IP%\')">Connect to %IP%</button>';

function extractIPFromCandidate(candidateString) {
  var segs = candidateString.split(" ");
  console.log(segs);
  return segs[4];
}

function getCorrespondingClient(con) {
  for(var key in peerCons) {
    if(peerCons[key] === con)
      return key;
  }
}

// This function sends candidates to the remote peer, via the node server
var onIceCandidate = function(event) {
    if (event.candidate) {

       trace("openChannel","Sending ICE candidate to remote peer : " + event.candidate.candidate);
       var msgCANDIDATE = {};
       msgCANDIDATE.msg_type  = 'CANDIDATE';
       msgCANDIDATE.candidate = event.candidate.candidate;
       msgCANDIDATE.peer = getCorrespondingClient(this);//event.candidate.candidate.peer;
       msgCANDIDATE.me = weAreActingAs;
       //trace("openChannel","candidate peer : " + JSON.stringify(event));
       socket.send(JSON.stringify(msgCANDIDATE));

    } else {
       trace("onIceCandidate","End of candidates");
    }
}

var onSessionConnecting = function(message) {
    trace("onSessionConnecting","Session connecting");
}

var onSessionOpened = function(message) {
    trace("onSessionOpened","Session opened");
}

var onRemoteStreamRemoved = function(event) {
    trace("onRemoteStreamRemoved","Remote stream removed");
}

// Create the peer connection (via the node server)
var createPeerConnection = function(remoteAddr) {

    //var pc_config = {"iceServers": [{"url": stunServer}]};
    var pc_config = null;

    var pc = new webkitRTCPeerConnection(pc_config);

    pc.onicecandidate = onIceCandidate;
    pc.onconnecting   = onSessionConnecting;
    pc.onopen         = onSessionOpened;
    pc.addStream(localStream);

    pc.onaddstream = function(event) {
       trace("createPeerConnection","Remote stream added.");
       var url = webkitURL.createObjectURL(event.stream);
       trace("createPeerConnection","url = " + url);
       remoteStream = event.stream;
       $("#remote-video").attr("src",url);
    };

    pc.onremovestream = onRemoteStreamRemoved;

    peerCons[remoteAddr] = pc;

    trace("createPeerConnection", "Created webkitRTCPeerConnnection " + remoteAddr);
    trace("createPeerConnection", "peerCons:  " + JSON.stringify(peerCons));
    // trace("createPeerConnection", "pc-config : " + JSON.stringify(pc_config));
}

// In case we received an OFFER as SERVER, we send an ANSWER backwards
function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    trace("setLocalAndSendMessage","SessionDescription = " + sessionDescription.sdp);
    var msgANSWER = {};
    msgANSWER.msg_type = 'ANSWER';
    msgANSWER.data = sessionDescription;
    msgANSWER.me = weAreActingAs;
    socket.send(JSON.stringify(msgANSWER));
}

// Open a channel towards the Node server
var openChannel = function () {

    trace("openChannel","Opening channel");
    socket = new WebSocket('ws://' + nodeHostAddress + ':' + nodeHostPort, 'app');

    socket.onopen = function () {

       trace("openChannel",'Channel opened.');

       // send as CLIENT or SERVER
       var msgINFO = {};
       msgINFO.msg_type = weAreActingAs;
       msgINFO.me = weAreActingAs;
       socket.send(JSON.stringify(msgINFO));



        //trace("openChannel","Creating PeerConnection");
        //createPeerConnection(remoteAddr);

        //trace("openChannel","Adding local stream");
        //pc.addStream(localStream);

        /*
        trace("openChannel","Sending offer to peer");

        pc.createOffer(function (sessionDescription) {
        	pc.setLocalDescription(sessionDescription);
            var msgOFFER = {};
            msgOFFER.msg_type = 'OFFER';
            msgOFFER.data = sessionDescription;
            trace("openChannel","Sending sdp : " + sessionDescription.sdp);
            socket.send(JSON.stringify(msgOFFER));
        }, null, {audio:true, video:true});
		*/

    };

    socket.onerror = function (error) {
       trace("openChannel",'Channel error.'+ error);
    };

    socket.onclose = function () {
       trace("openChannel",'Channel close.');
       channelReady = false;
    };

    // Log messages from the server
    socket.onmessage = function (e) {
      var msg = JSON.parse(e.data);
      trace("openChannel"," Received message type : " + msg.msg_type);
      switch (msg.msg_type) {

         case "APPLY":
         	  trace("onmessage", "APPLY");
         	  createPeerConnection(msg.source);
            console.log(peerCons[msg.source]);
            peerCons[msg.source].createOffer(function (sessionDescription) {
        		  peerCons[msg.source].setLocalDescription(sessionDescription);
            	 var msgOFFER = {};
            	 msgOFFER.msg_type = 'OFFER';
            	 msgOFFER.data = sessionDescription;
               msgOFFER.peer = msg.source;
               msgOFFER.me = weAreActingAs;
            	 trace("onmessage","Sending sdp : " + sessionDescription.sdp);
            	 socket.send(JSON.stringify(msgOFFER));
        		  }, null, {audio:true, video:true});
            break;

         case "ANSWER":
            peerCons[msg.source].setRemoteDescription(new RTCSessionDescription(msg.data));
            trace("openChannel","answer");	    
            //trace("openChannel","Got Answer : " + msg.data.sdp);
            break;

         // To be processed as either Client or Server
         case "BYE":
            peerCons[msg.peer].close();
            break;

         // To be processed as either Client or Server
         case "CANDIDATE":
            var candidate = new RTCIceCandidate({candidate: msg.candidate});
            //trace("************important*********", JSON.stringify(candidate));
            peerCons[msg.source].addIceCandidate(candidate);
            break;

         // Unexpected, but reserved for other message types
         default:
            trace("openChannel",'default');
      }

    };
}

// This function in invoked in case access to the camera devide is rejected
var accessRejected = function() {
    trace("accessRejected","accessRejected");
};

// This function is used to check if the browser has the required API implementation to access the device camera
// Note: Opera is unprefixed. Returns a boolean
var hasGetUserMedia = function() {
    return !!(navigator.getUserMedia ||
              navigator.webkitGetUserMedia ||
              navigator.mozGetUserMedia ||
              navigator.msGetUserMedia);
};

// Main entry point...
function start() {
    // Clear the trace section
    tracer.clear();
	  console.log('running as ' + weAreActingAs);
    trace("start","Starting as Client");
    navigator.getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia ||
                             navigator.msGetUserMedia;
    window.URL = window.URL || window.webkitURL;
    if ( hasGetUserMedia() ){
    	trace("start","Starting as Client");
    } else{
        trace("Main","GetUserMedia not supported, try a more state of the art browser");
    }

    var video = $("#local-video");
    trace("start","Starting media");
    navigator.getUserMedia({audio:true, video:true}, function(stream) {
       localStream = stream;
       video.attr('src', window.URL.createObjectURL(localStream));
       openChannel();
   	}, accessRejected);
}


function hangup() {

  // Send bye to the peer
  trace("hangup","Sending BYE");
  
  try {  
     var msgBYE = {};
     msgBYE.msg_type = 'BYE';
     msgBYE.me = weAreActingAs;
     socket.send(JSON.stringify(msgBYE));
    } catch(e) {
     trace("hangup","Peer connection was not established yet");
	 console.log(e);
  }

  stop();
}

function stop() {

    trace("stop","Stopping");
  
    
    try {
     pc.close();
     pc = null;
    } catch(e) {
      trace("stop","Peer connection was not established yet");
	  console.log(e);
    }
}

