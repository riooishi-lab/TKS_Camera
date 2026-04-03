import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";

const firebaseConfig = {
	apiKey: "AIzaSyB-GpVS9-DSvvnb-2ibi0jLm4QUqMpktcA",
	authDomain: "creative-team-lab.firebaseapp.com",
	projectId: "creative-team-lab",
	storageBucket: "creative-team-lab.firebasestorage.app",
	messagingSenderId: "630104439320",
	appId: "1:630104439320:web:58b4702b7dfe1035bea16d",
	measurementId: "G-7GR9XXNM7Y",
};

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;

function getApp(): FirebaseApp {
	if (!_app) {
		_app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
	}
	return _app;
}

export function getFirebaseAuth(): Auth {
	if (!_auth) {
		_auth = getAuth(getApp());
	}
	return _auth;
}
