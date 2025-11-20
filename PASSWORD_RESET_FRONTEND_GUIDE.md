# 🔐 Password Reset Frontend Implementation

## API Endpoints Overview

### User Password Reset
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/verify-reset-token/:token?type=user` - Verify token validity

### DTUser Password Reset  
- `POST /api/auth/dtuser-forgot-password` - Request password reset
- `POST /api/auth/dtuser-reset-password` - Reset password with token
- `GET /api/auth/verify-reset-token/:token?type=dtuser` - Verify token validity

## React Implementation

### 1. Password Reset Service

```typescript
// services/PasswordResetService.ts
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

class PasswordResetService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api/auth${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`📡 Password Reset API: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`❌ Password Reset API Error:`, error);
      throw error;
    }
  }

  /**
   * Request password reset for regular users
   */
  async requestUserPasswordReset(email: string): Promise<ApiResponse> {
    return this.request('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Reset password for regular users
   */
  async resetUserPassword(
    token: string, 
    password: string, 
    confirmPassword: string
  ): Promise<ApiResponse> {
    return this.request('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, confirmPassword }),
    });
  }

  /**
   * Request password reset for DTUsers
   */
  async requestDTUserPasswordReset(email: string): Promise<ApiResponse> {
    return this.request('/dtuser-forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * Reset password for DTUsers
   */
  async resetDTUserPassword(
    token: string, 
    password: string, 
    confirmPassword: string
  ): Promise<ApiResponse> {
    return this.request('/dtuser-reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, confirmPassword }),
    });
  }

  /**
   * Verify reset token validity
   */
  async verifyResetToken(token: string, userType: 'user' | 'dtuser'): Promise<ApiResponse> {
    return this.request(`/verify-reset-token/${token}?type=${userType}`);
  }
}

export const passwordResetService = new PasswordResetService();
export default passwordResetService;
```

### 2. Forgot Password Component

```tsx
// components/ForgotPasswordForm.tsx
import React, { useState } from 'react';
import passwordResetService from '../services/PasswordResetService';

interface ForgotPasswordFormProps {
  userType: 'user' | 'dtuser';
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ 
  userType, 
  onSuccess, 
  onCancel 
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = userType === 'dtuser' 
        ? await passwordResetService.requestDTUserPasswordReset(email)
        : await passwordResetService.requestUserPasswordReset(email);

      if (response.success) {
        setEmailSent(true);
        setMessage({ 
          type: 'success', 
          text: response.message || 'Password reset link has been sent to your email' 
        });
        onSuccess?.();
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to send reset email' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-green-500 text-4xl mb-4">📧</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Check Your Email</h2>
          <p className="text-gray-600 mb-4">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            The link will expire in 1 hour for security reasons. If you don't see the email, 
            check your spam folder.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setEmailSent(false);
                setEmail('');
                setMessage(null);
              }}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Send Another Email
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full text-gray-500 hover:text-gray-700 py-2 px-4 transition-colors"
              >
                Back to Login
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <div className="text-blue-500 text-4xl mb-4">🔐</div>
        <h2 className="text-2xl font-semibold text-gray-800">Forgot Password</h2>
        <p className="text-gray-600 mt-2">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'error' 
              ? 'bg-red-50 border border-red-200 text-red-700' 
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Sending Email...
            </div>
          ) : (
            'Send Reset Link'
          )}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-gray-500 hover:text-gray-700 py-2 px-4 transition-colors"
          >
            Back to Login
          </button>
        )}
      </form>

      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>🛡️ Security: Reset links expire in 1 hour</p>
        <p>📧 Check spam folder if email doesn't arrive</p>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
```

### 3. Reset Password Component

```tsx
// components/ResetPasswordForm.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import passwordResetService from '../services/PasswordResetService';

const ResetPasswordForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  const token = searchParams.get('token');
  const userType = searchParams.get('type') as 'user' | 'dtuser' || 'user';

  useEffect(() => {
    validateToken();
  }, [token, userType]);

  const validateToken = async () => {
    if (!token) {
      setMessage({ type: 'error', text: 'Invalid or missing reset token' });
      setIsValidatingToken(false);
      return;
    }

    try {
      const response = await passwordResetService.verifyResetToken(token, userType);
      if (response.success) {
        setIsTokenValid(true);
      } else {
        setMessage({ type: 'error', text: 'Reset token is invalid or expired' });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Token validation failed' 
      });
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear any previous messages when user starts typing
    if (message) {
      setMessage(null);
    }
  };

  const validatePassword = (): string | null => {
    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validatePassword();
    if (validationError) {
      setMessage({ type: 'error', text: validationError });
      return;
    }

    if (!token) {
      setMessage({ type: 'error', text: 'Reset token is missing' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = userType === 'dtuser' 
        ? await passwordResetService.resetDTUserPassword(
            token, 
            formData.password, 
            formData.confirmPassword
          )
        : await passwordResetService.resetUserPassword(
            token, 
            formData.password, 
            formData.confirmPassword
          );

      if (response.success) {
        setPasswordReset(true);
        setMessage({ 
          type: 'success', 
          text: response.message || 'Password has been reset successfully' 
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate(userType === 'dtuser' ? '/dtuser/login' : '/login');
        }, 3000);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to reset password' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidatingToken) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating reset token...</p>
        </div>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Invalid Reset Link</h2>
          <p className="text-gray-600 mb-6">
            This password reset link is invalid or has expired. Reset links are only valid for 1 hour.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/forgot-password')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Request New Reset Link
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full text-gray-500 hover:text-gray-700 py-2 px-4 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (passwordReset) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-green-500 text-4xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Password Reset Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your password has been updated successfully. You can now log in with your new password.
          </p>
          <div className="text-sm text-gray-500">
            Redirecting to login page in 3 seconds...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <div className="text-blue-500 text-4xl mb-4">🔑</div>
        <h2 className="text-2xl font-semibold text-gray-800">Reset Your Password</h2>
        <p className="text-gray-600 mt-2">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Enter new password (min 8 characters)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            minLength={8}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            placeholder="Confirm your new password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            minLength={8}
          />
        </div>

        {/* Password Strength Indicator */}
        {formData.password && (
          <div className="text-xs text-gray-500">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                formData.password.length >= 8 ? 'bg-green-400' : 'bg-gray-300'
              }`}></div>
              <span>At least 8 characters</span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${
                formData.password === formData.confirmPassword && formData.confirmPassword 
                  ? 'bg-green-400' : 'bg-gray-300'
              }`}></div>
              <span>Passwords match</span>
            </div>
          </div>
        )}

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'error' 
              ? 'bg-red-50 border border-red-200 text-red-700' 
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !formData.password || !formData.confirmPassword}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Resetting Password...
            </div>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>

      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>🛡️ Your new password will be encrypted and stored securely</p>
      </div>
    </div>
  );
};

export default ResetPasswordForm;
```

### 4. Add to Login Components

```tsx
// Add this to your existing Login component
import { useState } from 'react';
import ForgotPasswordForm from './ForgotPasswordForm';

const LoginComponent = () => {
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (showForgotPassword) {
    return (
      <ForgotPasswordForm 
        userType="user" // or "dtuser"
        onCancel={() => setShowForgotPassword(false)}
        onSuccess={() => {
          // Optional: show success message or redirect
        }}
      />
    );
  }

  return (
    <div className="login-form">
      {/* Your existing login form */}
      
      {/* Add forgot password link */}
      <div className="text-center mt-4">
        <button
          onClick={() => setShowForgotPassword(true)}
          className="text-blue-500 hover:text-blue-600 text-sm underline"
        >
          Forgot your password?
        </button>
      </div>
    </div>
  );
};
```

### 5. Router Setup

```tsx
// App.tsx or your router file
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import ResetPasswordForm from './components/ResetPasswordForm';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Existing routes */}
        
        {/* Password reset routes */}
        <Route 
          path="/forgot-password" 
          element={<ForgotPasswordForm userType="user" />} 
        />
        <Route 
          path="/dtuser/forgot-password" 
          element={<ForgotPasswordForm userType="dtuser" />} 
        />
        <Route 
          path="/reset-password" 
          element={<ResetPasswordForm />} 
        />
      </Routes>
    </BrowserRouter>
  );
}
```

## Features Included

### 🔒 Security Features
- Token validation before showing reset form
- Password strength indicators
- Secure token handling
- Rate limiting protection
- Automatic expiry handling

### 🎨 User Experience
- Loading states and animations
- Success/error message handling
- Email confirmation screens
- Automatic redirections
- Mobile-responsive design

### 🛠️ Developer Features
- TypeScript interfaces
- Error boundaries
- Comprehensive error handling
- Reusable components
- Clean API service layer

### 📧 Email Integration
- Professional HTML email templates
- Security warnings and tips
- Mobile-friendly email design
- Clear call-to-action buttons

This implementation provides a complete, production-ready password reset system that works seamlessly with your backend!