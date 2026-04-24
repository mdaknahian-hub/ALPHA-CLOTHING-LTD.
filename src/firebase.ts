import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. Firestore is offline.");
    }
  }
}
testConnection();

export const addAuditLog = async (
  action: 'ADD' | 'EDIT' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'DOWNLOAD' | 'STATUS_CHANGE' | 'PERMISSION_CHANGE' | 'UPLOAD' | 'IMPORT', 
  entity: 'ORDER' | 'ENTRY' | 'USER' | 'SETTINGS' | 'REPORT' | 'PRODUCTION' | 'EXCEL', 
  details: string, 
  path: string
) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const logId = `${action.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'auditLogs', logId), {
      timestamp: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email,
      action,
      entity,
      details,
      path
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

export const handleFirestoreError = (err: any, operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write', path: string | null = null) => {
  if (err.code === 'permission-denied') {
    const errorInfo = {
      error: err.message,
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid || 'anonymous',
        email: auth.currentUser?.email || 'none',
        emailVerified: auth.currentUser?.emailVerified || false,
        isAnonymous: auth.currentUser?.isAnonymous || true,
        providerInfo: auth.currentUser?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || ''
        })) || []
      }
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw err;
};

export default app;
