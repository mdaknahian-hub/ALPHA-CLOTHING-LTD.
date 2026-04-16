import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const addAuditLog = async (
  action: 'ADD' | 'EDIT' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'DOWNLOAD' | 'STATUS_CHANGE' | 'PERMISSION_CHANGE', 
  entity: 'ORDER' | 'ENTRY' | 'USER' | 'SETTINGS' | 'REPORT' | 'PRODUCTION', 
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

export default app;
