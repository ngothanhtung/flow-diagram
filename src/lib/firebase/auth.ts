'use client';

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
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

// Firebase's default reset email and hosted reset page — no actionCodeSettings.
// Callers must not surface the rejection reason to the user (it can reveal
// whether the address has an account); see `lib/password-reset.ts`.
export function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(firebaseAuth, email);
}

// Firebase's default verification email and hosted action page — no
// actionCodeSettings, matching the password reset above. The rules only see
// the result once the ID token is refreshed (see `checkUserAccess`).
export function sendVerificationEmail(user: User) {
  return sendEmailVerification(user);
}

export function signOutUser() {
  return signOut(firebaseAuth);
}

export function observeAuthState(observer: NextOrObserver<User>) {
  return onAuthStateChanged(firebaseAuth, observer);
}
