/*
 * (C) Copyright 2014 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var socket = io('https://' + location.host);
var participants = {};
var name;
var Log;

window.onbeforeunload = function() {
	socket.disconnect();
};

socket.on('connect', () => {
	//console.log('ws connect success');
    viewer();
});

window.onload = function(){
    Log = document.getElementById("log");
}
socket.on('message', parsedMessage => {
	// console.info('Received message: ' + parsedMessage.id);
	switch (parsedMessage.id) {
	case 'existingParticipants':
		onExistingParticipants(parsedMessage);
		break;
	case 'receiveVideoAnswer':
		receiveVideoResponse(parsedMessage);
		break;
	case 'iceCandidate':
		participants[parsedMessage.name].rtcPeer.addIceCandidate(parsedMessage.candidate, function(error) {
	        if (error) {
		      console.error("Error adding candidate: " + error);
		      return;
	        }
	    });
	    break;
    case 'new-chat':
        Log.insertAdjacentHTML('beforeend', `<li style="text-align: left;"><span style="font-weight: bold;">${parsedMessage.peerId == socket.id ? 'My Self' : (parsedMessage.isPresenter === true ? 'Presenter' : parsedMessage.peerId)}</span>: ${parsedMessage.msg}</li>`);
        break;
	default:
		console.log('Unrecognized message', parsedMessage);
	}
});

function viewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomName = urlParams.get('roomid');
    if(roomName){
        name = socket.id;
        document.getElementById("message").innerHTML = "Room: " + roomName;

        var message = {
            id : 'joinRoom',
            name : name,
            roomName : roomName,
        }
        sendMessage(message);
        document.getElementById("message").removeAttribute("disabled");
    }
	
}

function onNewParticipant(request) {
	receiveVideo(request.name);
}

function receiveVideoResponse(result) {
	participants[result.name].rtcPeer.processAnswer (result.sdpAnswer, function (error) {
		if (error) return console.error (error);
	});
}

function callResponse(message) {
	if (message.response != 'accepted') {
		console.info('Call not accepted by peer. Closing call');
		stop();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer, function (error) {
			if (error) return console.error (error);
		});
	}
}

function onExistingParticipants(msg) {
	//console.log(name + " registered in room " + room);
	var participant = new Participant(name);
	participants[name] = participant;

	var options = {
	      onicecandidate: participant.onIceCandidate.bind(participant)
	}
	participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options,
		function (error) {
		  if(error) {
			  return console.error(error);
		  }
		  this.generateOffer(participant.offerToReceiveVideo.bind(participant));
	});

	msg.data.forEach(receiveVideo);
}

function leaveRoom() {
	sendMessage({
		'id': 'leaveRoom'
	});

	for (var key in participants) {
		participants[key].dispose();
	}

	document.getElementById('join').style.display = 'block';
	document.getElementById('room').style.display = 'none';

	socket.close();
}

function receiveVideo(sender) {
	var participant = new Participant(sender);
	participants[sender] = participant;

	var options = {
      remoteVideo: document.getElementById("stream"),
      onicecandidate: participant.onIceCandidate.bind(participant)
    }

	participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
		function (error) {
			if(error) {
				return console.error(error);
			}
			this.generateOffer(participant.offerToReceiveVideo.bind(participant));
		}
	);
}

function onParticipantLeft(request) {
	//console.log('Participant ' + request.name + ' left');
	var participant = participants[request.name];
	participant.dispose();
	delete participants[request.name];
}

function sendMessage(message) {
	//console.log('Senging message: ' + message.id);
	socket.emit('message', message);
}

function sendChat(){
	var msg = document.getElementById("message");
	if(msg.value.trim() == '') return;

	sendMessage({
		id: "chat",
		msg: msg.value.trim(),
        peerId: socket.id
	});
	msg.value = '';
}

function runScript(e) {
    //See notes about 'which' and 'key'
    if (e.keyCode == 13) {
        sendChat();
        return false;
    }
}