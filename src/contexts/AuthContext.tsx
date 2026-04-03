"use client";

import type { User as FirebaseUser } from "firebase/auth";
import {
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signOut,
} from "firebase/auth";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { getFirebaseAuth } from "@/libs/firebase";
import { getUserByFirebaseUid, type TksUser } from "@/libs/storage";

type AuthContextValue = {
	firebaseUser: FirebaseUser | null;
	tksUser: TksUser | null;
	loading: boolean;
	needsSetup: boolean;
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
	const [tksUser, setTksUser] = useState<TksUser | null>(null);
	const [loading, setLoading] = useState(true);
	const [needsSetup, setNeedsSetup] = useState(false);

	const resolveTksUser = useCallback(async (fbUser: FirebaseUser) => {
		const user = await getUserByFirebaseUid(fbUser.uid);

		if (user) {
			setTksUser(user);
			setNeedsSetup(!user.name);
		} else {
			setTksUser(null);
			setNeedsSetup(false);
		}
	}, []);

	useEffect(() => {
		const auth = getFirebaseAuth();
		const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
			setFirebaseUser(fbUser);
			if (fbUser) {
				await resolveTksUser(fbUser);
			} else {
				setTksUser(null);
				setNeedsSetup(false);
			}
			setLoading(false);
		});
		return unsubscribe;
	}, [resolveTksUser]);

	const login = async (email: string, password: string) => {
		const auth = getFirebaseAuth();
		await signInWithEmailAndPassword(auth, email, password);
	};

	const logout = async () => {
		const auth = getFirebaseAuth();
		await signOut(auth);
		setTksUser(null);
		setNeedsSetup(false);
	};

	const refreshUser = useCallback(async () => {
		if (firebaseUser) {
			await resolveTksUser(firebaseUser);
		}
	}, [firebaseUser, resolveTksUser]);

	return (
		<AuthContext.Provider
			value={{
				firebaseUser,
				tksUser,
				loading,
				needsSetup,
				login,
				logout,
				refreshUser,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
