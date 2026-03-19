'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'sonner';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: { fontSize: '14px' },
        }}
      />
    </GoogleOAuthProvider>
  );
}
