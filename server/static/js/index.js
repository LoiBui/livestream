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
var Presenter;
var btnRegister, roomName, Log;

window.onload = function(){
	btnRegister = document.getElementById("btn-register");
	roomName = document.getElementById("roomName");
	Log = document.getElementById("log");
}

window.onbeforeunload = function() {
	socket.disconnect();
};
var peerId;

socket.on('connect', () => {
	// console.log('ws connect success');
	peerId = socket.id;
	console.log(peerId);
});

socket.on('message', parsedMessage => {
	// console.info('Received message: ' + parsedMessage.id);
	switch (parsedMessage.id) {
	case 'existingParticipants':
		onExistingParticipants(parsedMessage);
		break;
	case 'newParticipantArrived':
		// onNewParticipant(parsedMessage);
		console.log(parsedMessage);
		Log.insertAdjacentHTML('beforeend', `<li style="text-align: left;"><span style="font-weight: bold;">${parsedMessage.name}</span> join stream</li>`);
		break;
	case 'participantLeft':
		Log.insertAdjacentHTML('beforeend', `<li style="text-align: left;"><span style="font-weight: bold;">${parsedMessage.name}</span> left stream</li>`);
		// onParticipantLeft(parsedMessage);
		break;
	case 'receiveVideoAnswer':
		receiveVideoResponse(parsedMessage);
		break;
	case 'iceCandidate':
		Presenter.rtcPeer.addIceCandidate(parsedMessage.candidate, function(error) {
	        if (error) {
		      console.error("Error adding candidate: " + error);
		      return;
	        }
	    });
	    break;
	case 'new-chat':
		Log.insertAdjacentHTML('beforeend', `<li style="text-align: left;"><span style="font-weight: bold;">${parsedMessage.peerId == peerId ? 'My Self' : parsedMessage.peerId}</span>: ${parsedMessage.msg}</li>`);
		break;

	default:
		console.error('Unrecognized message', parsedMessage);
	}
});

var isRegister = true;
function register() {
	if(!isRegister){
		let select = document.getElementById("roomName");
		roomName.focus();
		roomName.select();
		document.execCommand("copy");

		btnRegister.innerHTML = 'Copied';
		setTimeout(function(){btnRegister.innerHTML = 'Copy Url'}, 1000);
		return;
	}
	isRegister = false;
	name = peerId;
	roomName.setAttribute("readonly", true);
	document.getElementById("message").removeAttribute("disabled");
	
	btnRegister.innerHTML = 'Copy Url';
	document.getElementById('room-header').innerText = 'ROOM ' + roomName.value;
	var message = {
		id : 'joinRoom',
		name : name,
		roomName : roomName.value,
	}
	sendMessage(message);
	roomName.value = `${window.location.href}livestream.html?roomid=${roomName.value}`;
}

function onNewParticipant(request) {
	receiveVideo(request.name);
}

function receiveVideoResponse(result) {
	Presenter.rtcPeer.processAnswer (result.sdpAnswer, function (error) {
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
	var constraints = {
		audio : true,
		video: true
		// video : {
		// 	mandatory : {
		// 		maxWidth : 320,
		// 		maxFrameRate : 15,
		// 		minFrameRate : 15
		// 	}
		// }
	};
	// console.log(name + " registered in room " + room);
	Presenter = new Participant(peerId);
	var options = {
	      localVideo: document.getElementById("my-video"),
	      mediaConstraints: constraints,
	      onicecandidate: Presenter.onIceCandidate.bind(Presenter)
	}
	Presenter.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options,
		function (error) {
		  if(error) {
			  return console.error(error);
		  }
		  this.generateOffer(Presenter.offerToReceiveVideo.bind(Presenter));
	});
	// msg.data.forEach(receiveVideo);
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
	var video = participant.getVideoElement();

	var options = {
      remoteVideo: video,
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
	// console.log('Participant ' + request.name + ' left');
	var participant = participants[request.name];
	participant.dispose();
	delete participants[request.name];
}

function sendMessage(message) {
	// console.log('Senging message: ' + message.id);
	socket.emit('message', message);
}

function sendChat(){
	var msg = document.getElementById("message");
	if(msg.value.trim() == '') return;
	sendMessage({
		id: "chat",
		msg: msg.value.trim(),
        peerId: socket.id,
		isPresenter: true
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
