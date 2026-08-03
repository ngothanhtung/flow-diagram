'use client';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type NextOrObserver,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from './client';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function signInWithGoogle() {
  return signInWithPopup(firebaseAuth, googleProvider);
}

export function createAccountWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(firebaseAuth, email, password);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export function signOutUser() {
  return signOut(firebaseAuth);
}

export function observeAuthState(observer: NextOrObserver<User>) {
  return onAuthStateChanged(firebaseAuth, observer);
}
