import firebase from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "----------------",
  authDomain : " -------------",
  projectId : " -------------",
  storageBucket : " -------------",
  messagingSenderId : " -------------",
  appId : " -------------",
  measurementId : " -------------",
};


if(!firebase.getApps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

const server ={
  iceServers : [
    {
      urls : ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    }
  ],
  iceCandidatePoolSize: 10,
}


// golbal config
const pc = new RTCPeerConnection(server);
let localStream = null;
let remoteStream = null;

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video : true , audio : true });

  // mengirim track dari locaal ke peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track,localStream);
  
  });
  webcamVideo.srcObject = localStream;
}


remoteStream = new MediaStream();

pc.ontrack = event => {
  event.streams[0].getTracks().forEach((track) => {
    remoteStream.addTrack(track);
  })
}

remoteVideo.srcObject = localStream;


callButton.onclick = async () => {
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answesrCandidates = callDoc.collection('answesrCandidates');

  callInput.value = callDoc.id;

  pc.onicecandidate = event => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp, 
    type: offerDescription.type, 

  };

  await callDoc.set({offer});
  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

}


answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  pc.onicecandidate = event => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  // Fetch data, then set the offer & answer

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await callDoc.update({ answer });

  // Listen to offer candidates

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change)
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};