'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import api, { TOKEN_KEY } from '@/lib/axios';
import { Ticket } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    setError(null);
    setLoading(true);

    try {
      const idToken = credentialResponse.credential;
      if (!idToken) {
        setError('Không nhận được token từ Google. Vui lòng thử lại.');
        return;
      }

      const response = await api.post('/auth/google', { idToken });
      const { token } = response.data.data;

      localStorage.setItem(TOKEN_KEY, token);

      // Store admin info for sidebar display
      if (response.data.data.admin) {
        localStorage.setItem('admin_info', JSON.stringify(response.data.data.admin));
      }

      router.push('/admin/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const message =
        axiosErr.response?.data?.error?.message ||
        'Đăng nhập thất bại. Vui lòng thử lại.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-[#1a1a2e] rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Ticket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Indi-Indi</h1>
          <p className="text-sm text-gray-500 mt-1">Enterprise Admin Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-2">
            Đăng nhập Admin
          </h2>
          <p className="text-sm text-gray-500 text-center mb-8">
            Sử dụng tài khoản Google được cấp quyền
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {/* Google Login Button */}
          <div className="flex justify-center">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-[#1a1a2e] rounded-full animate-spin" />
                Đang xử lý...
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Đăng nhập Google thất bại. Vui lòng thử lại.')}
                theme="outline"
                size="large"
                width={320}
                text="signin_with"
                shape="rectangular"
                logo_alignment="left"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 Indi-Indi Enterprise. All rights reserved.
        </p>
      </div>
    </div>
  );
}
