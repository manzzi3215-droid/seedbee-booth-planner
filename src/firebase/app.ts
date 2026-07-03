import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './config';

/**
 * Firebase 초기화 + 익명 로그인.
 *
 * - 설정(env)이 없으면 초기화하지 않습니다(LocalStorage 전용).
 * - 앱 실행 시 자동으로 Anonymous 로그인하고 owner uid 를 확보합니다.
 * - 한 번만 초기화되도록 Promise 를 캐시합니다.
 */

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  uid: string;
}

let handlesPromise: Promise<FirebaseHandles> | null = null;

/** 익명 로그인이 끝나 uid 가 확보된 Firebase 핸들을 반환 (설정 없으면 throw) */
export function getFirebase(): Promise<FirebaseHandles> {
  if (!isFirebaseConfigured) {
    return Promise.reject(new Error('Firebase 가 설정되지 않았습니다(VITE_FIREBASE_*).'));
  }
  if (!handlesPromise) {
    handlesPromise = (async () => {
      const app = initializeApp({
        apiKey: firebaseConfig.apiKey,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        messagingSenderId: firebaseConfig.messagingSenderId,
        appId: firebaseConfig.appId,
      });
      const auth = getAuth(app);
      // undefined 선택 필드(memo, customFloorName 등)를 그대로 저장하도록 무시 설정
      const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
      const uid = await ensureAnonymousUid(auth);
      return { app, auth, db, uid };
    })();
  }
  return handlesPromise;
}

/** 현재 로그인 사용자가 있으면 즉시, 없으면 익명 로그인 후 uid 반환 */
function ensureAnonymousUid(auth: Auth): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user.uid);
        } else {
          signInAnonymously(auth).catch((err) => {
            unsub();
            reject(err);
          });
        }
      },
      (err) => {
        unsub();
        reject(err);
      },
    );
  });
}
