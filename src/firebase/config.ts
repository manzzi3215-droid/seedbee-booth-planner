/**
 * Firebase 웹 설정 (환경 변수 기반).
 *
 * ⚠️ 자격 증명은 절대 소스에 하드코딩하지 않습니다.
 * Vite 환경 변수(VITE_FIREBASE_*)에서 읽으며, 값이 없으면 Firebase 를 사용하지 않고
 * LocalStorage 로만 동작합니다(하위 호환/오프라인).
 *
 * .env / .env.local 예시는 저장소의 .env.example 참고.
 */

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

/**
 * 필수 값(apiKey/authDomain/projectId/appId)이 모두 있으면 Firebase 사용 가능.
 * 하나라도 없으면 LocalStorage 전용으로 동작합니다.
 */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);
