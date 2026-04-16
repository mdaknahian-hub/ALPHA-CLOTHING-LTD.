import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { LogIn, Shield, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Log login time and update profile
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        lastLogin: new Date().toISOString(),
        role: user.email === 'aknahian@gmail.com' ? 'admin' : 'user'
      }, { merge: true });

      // Create audit log for login
      const logId = `login_${Date.now()}`;
      const { setDoc: fsSetDoc, doc: fsDoc } = await import('firebase/firestore');
      await fsSetDoc(fsDoc(db, 'auditLogs', logId), {
        timestamp: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email,
        action: 'LOGIN',
        entity: 'USER',
        details: 'User logged in via Google',
        path: `/users/${user.uid}`
      });

      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelled. Please try again.');
      } else {
        setError('Login failed. Please ensure Google login is enabled in Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border rounded-2xl shadow-2xl p-8"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
            <Shield className="text-accent" size={32} />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2">
          Alpha Clothing System
        </h2>
        <p className="text-muted text-center mb-8 text-sm">
          Please sign in with your Google account to access the production system.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="btn btn-a w-full py-4 flex items-center justify-center gap-3 text-base font-bold shadow-lg shadow-accent/20"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[10px] text-muted uppercase tracking-widest font-bold">
            Secure Access Control System
          </p>
        </div>
      </motion.div>
    </div>
  );
}
