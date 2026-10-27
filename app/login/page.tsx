"use client";

import { toast } from '@/lib/app-toast';
import {
  appendSafeAuthRedirect,
  getSafeNextFromBrowser,
} from '@/lib/auth-redirect';
import { useAuth } from "@/lib/auth-context";
import { logger } from '@/lib/logger';
import {
  resolveAuthenticatedLanding,
  type TeacherSyncState,
} from '@/lib/teacher-session-routing';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/primitives/icon';
import { InstallTpsApp } from '@/components/notifications/InstallTpsApp';

const SAVED_LOGIN_KEY = 'tps_saved_login_account';
type LandingRole = 'teacher' | 'manager' | 'candidate';
type AppRole = 'teacher' | 'manager' | 'super_admin' | 'admin' | 'hr';

function isCandidateSessionEmail(email: string | undefined) {
  return /^candidate-\d+@candidate\.local$/i.test((email || '').trim());
}

function resolvePostLoginPath(options: {
  selectedRole: LandingRole;
  userRole: string;
  isAdmin: boolean;
  teacherSync?: TeacherSyncState;
  permissions?: string[];
}): { redirectPath: string; isAdminLanding: boolean } {
  if (options.selectedRole === 'candidate') {
    return {
      redirectPath: '/candidate-portal',
      isAdminLanding: false,
    };
  }

  const redirectPath = resolveAuthenticatedLanding({
    ...options,
    selectedRole: options.selectedRole,
  });

  return {
    redirectPath,
    isAdminLanding: redirectPath === '/admin/dashboard',
  };
}

function resolveFinalPostLoginPath(defaultPath: string): string {
  if (typeof window === 'undefined') return defaultPath;

  const requestedPath = getSafeNextFromBrowser(window.location);
  if (!requestedPath) return defaultPath;

  if (defaultPath === '/checkdatasource') {
    return appendSafeAuthRedirect(
      defaultPath,
      requestedPath,
      window.location.origin,
    );
  }

  return requestedPath;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, updateUser } = useAuth();
  const [role, setRole] = useState<LandingRole>('teacher');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loginPreferenceReady, setLoginPreferenceReady] = useState(false);
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_LOGIN_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as { email?: string; role?: LandingRole };
      if (parsed.email) {
        setEmail(parsed.email);
        setRememberAccount(true);
      }
      if (parsed.role === 'teacher' || parsed.role === 'manager' || parsed.role === 'candidate') {
        setRole(parsed.role);
      }
    } catch (e) {
      logger.warn('Unable to load saved login account', { error: (e as Error).message });
    } finally {
      setLoginPreferenceReady(true);
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('role') === 'candidate') {
      setRole('candidate');
    }
  }, []);

  const persistRememberedAccount = useCallback((accountEmail: string, accountRole: LandingRole) => {
    try {
      if (!rememberAccount) {
        localStorage.removeItem(SAVED_LOGIN_KEY);
        return;
      }
      localStorage.setItem(
        SAVED_LOGIN_KEY,
        JSON.stringify({ email: accountEmail.trim(), role: accountRole })
      );
    } catch (e) {
      logger.warn('Unable to persist saved login account', { error: (e as Error).message });
    }
  }, [rememberAccount]);

  useEffect(() => {
    if (!isLoading && loginPreferenceReady && !hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      if (user) {
        if (role === 'candidate' && !isCandidateSessionEmail(user.email)) {
          return;
        }

        const { redirectPath } = resolvePostLoginPath({
          selectedRole: role,
          userRole: user.role,
          isAdmin: Boolean(user.isAdmin),
          teacherSync: user.teacherSync,
          permissions: user.permissions,
        });
        const finalRedirectPath = resolveFinalPostLoginPath(redirectPath);
        logger.info('User already logged in, redirecting', { email: user.email, role: user.role, path: finalRedirectPath });
        router.replace(finalRedirectPath);
      }
    }
  }, [user, isLoading, loginPreferenceReady, role, router]);

  const handleRoleChange = useCallback((newRole: LandingRole) => {
    setRole(newRole);
  }, []);

  const handleTogglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  function persistTeacherSync(teacherSync?: TeacherSyncState, teacherEmail?: string) {
    if (!teacherSync || !teacherEmail) return;
    try {
      if (teacherSync.foundInDatabase) {
        localStorage.setItem('tps_profile_check_done_email', teacherEmail.toLowerCase());
      } else if (!teacherSync.dbUnavailable) {
        localStorage.removeItem('tps_profile_check_done_email');
      }
    } catch {
      /* localStorage is only a compatibility cache, never an auth source */
    }
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập Email hoặc Mã đăng nhập.');
      setIsSubmitting(false);
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      setIsSubmitting(false);
      return;
    }

    logger.info('Đang thực hiện login', { email: trimmedEmail, role });

    try {
      if (role === 'candidate') {
        const candidateAuthResponse = await fetch('/api/hr/onboarding/candidate-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: trimmedEmail, password }),
        });

        const candidateAuthData = await candidateAuthResponse.json().catch(() => ({}));
        if (!candidateAuthResponse.ok || !candidateAuthData.success) {
          throw new Error(candidateAuthData.error || 'Đăng nhập ứng viên thất bại');
        }

        window.localStorage.setItem(
          'candidatePortalProfile',
          JSON.stringify(candidateAuthData.data),
        );
        window.localStorage.removeItem('user');
        persistRememberedAccount(trimmedEmail, role);
        toast.success(`Chào mừng ${candidateAuthData.data?.full_name || 'ứng viên'}!`);
        router.replace('/candidate-portal');
        return;
      }

      // ─── Step 1: Try app-internal login ───
      const appAuthResponse = await fetch('/api/app-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      let appAuthData: {
        appUser?: boolean;
        error?: string;
        dbUnavailable?: boolean;
        email?: string;
        displayName?: string;
        role?: string;
        localId?: string;
        isAdmin?: boolean;
        permissions?: string[];
        teacherSync?: TeacherSyncState;
      } = {};
      try {
        appAuthData = await appAuthResponse.json();
      } catch {
        logger.warn('App auth response was not valid JSON');
      }

      if (appAuthData.appUser === true) {
        if (!appAuthData.localId) {
          throw new Error('Phản hồi đăng nhập app không đầy đủ. Vui lòng thử lại.');
        }

        const emailResolved = appAuthData.email ?? trimmedEmail;
        const userData = {
          email: emailResolved,
          displayName: appAuthData.displayName ?? emailResolved.split('@')[0] ?? emailResolved,
          role: (appAuthData.role ?? 'teacher') as 'teacher' | 'manager' | 'super_admin' | 'admin' | 'hr',
          localId: appAuthData.localId,
          isAdmin: Boolean(appAuthData.isAdmin),
          isAppUser: true as const,
          permissions: appAuthData.permissions ?? [],
          teacherSync: appAuthData.teacherSync,
        };

        updateUser(userData, '');
        persistTeacherSync(appAuthData.teacherSync, emailResolved);

        const landing = resolvePostLoginPath({
          selectedRole: role,
          userRole: userData.role,
          isAdmin: Boolean(appAuthData.isAdmin),
          teacherSync: appAuthData.teacherSync,
          permissions: userData.permissions,
        });

        if (appAuthData.role === 'super_admin') {
          toast.success(`Chào mừng Super Admin ${appAuthData.displayName}!`);
        } else if (landing.isAdminLanding) {
          toast.success(`Chào mừng Admin ${appAuthData.displayName}!`);
        } else {
          toast.success(`Chào mừng ${appAuthData.displayName}!`);
        }

        persistRememberedAccount(appAuthData.email || trimmedEmail, role);
        const finalRedirectPath = resolveFinalPostLoginPath(landing.redirectPath);
        logger.info('Redirecting app user', { path: finalRedirectPath, role: userData.role });
        setTimeout(() => { router.replace(finalRedirectPath); }, 500);
        return;
      }

      // ─── Fallback to Firebase ───
      const allowFirebaseFallback =
        (appAuthResponse.ok && appAuthData.appUser === false) ||
        appAuthResponse.status >= 500 ||
        appAuthData.dbUnavailable === true;

      if (!allowFirebaseFallback) {
        throw new Error(appAuthData.error || 'Đăng nhập thất bại');
      }

      // ─── Step 2: Firebase login (role / isAdmin do server tính từ DB, không tin body) ───
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đăng nhập thất bại');
      }

      const serverRole = String(data.role ?? 'teacher') as
        AppRole;

      const userData: {
        email: string;
        displayName: string;
        role: AppRole;
        localId: string;
        isAdmin?: boolean;
        isAppUser?: boolean;
        permissions?: string[];
        userRoles?: string[];
        teacherSync?: TeacherSyncState;
      } = {
        email: data.email,
        displayName: data.displayName,
        role: serverRole,
        localId: data.localId,
        isAppUser: Boolean(data.isAppUser),
        isAdmin: Boolean(data.isAdmin),
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        userRoles: Array.isArray(data.userRoles) ? data.userRoles : [],
        teacherSync: data?.teacherSync,
      };

      logger.success('Firebase login successful', { email: userData.email, role: userData.role });

      const landing = resolvePostLoginPath({
        selectedRole: role,
        userRole: userData.role,
        isAdmin: Boolean(userData.isAdmin),
        teacherSync: data?.teacherSync,
        permissions: userData.permissions,
      });

      const finalRedirectPath = resolveFinalPostLoginPath(landing.redirectPath);
      persistTeacherSync(data?.teacherSync, userData.email);

      if (landing.isAdminLanding) {
        toast.success(`Chào mừng Admin ${userData.displayName}!`);
      } else if (serverRole === 'teacher') {
        if (
          data?.teacherSync &&
          !data.teacherSync.foundInDatabase &&
          !data.teacherSync.dbUnavailable
        ) {
          toast.info('Chưa tìm thấy thông tin giáo viên trong database.', {
            message: 'Vui lòng kiểm tra ở bước tiếp theo.',
            duration: 4500,
          });
        }
        toast.success(`Chào mừng ${userData.displayName}!`);
      } else {
        toast.success(`Chào mừng ${userData.displayName}!`, { duration: 4000 });
      }

      persistRememberedAccount(trimmedEmail, role);
      updateUser(userData, '');

      logger.info('Redirecting to', { path: finalRedirectPath });
      setTimeout(() => { router.replace(finalRedirectPath); }, 500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(errorMessage);
      logger.error('Login error', { error: errorMessage });

      if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('mật khẩu')) {
        toast.error('Mật khẩu không chính xác!');
      } else if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('tài khoản')) {
        toast.error('Tài khoản không tồn tại!');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, role, updateUser, router, persistRememberedAccount]);

  return (
    <div className="box-border h-dvh w-full overflow-x-hidden overflow-y-auto bg-white p-0 sm:min-h-screen sm:p-4 flex items-stretch sm:items-center sm:justify-center animate-fade-in">
      <div className="bg-white flex min-h-full w-full overflow-visible sm:max-w-4xl sm:overflow-hidden sm:rounded-xl sm:shadow-2xl md:h-135 md:min-h-0 transform transition-all duration-500 sm:hover:shadow-3xl animate-fade-in-up">
        {/* Left side: Banner */}
        <div className="hidden md:flex flex-col justify-between items-start bg-linear-to-br from-[#800000] to-[#E31F26] w-1/3 h-full p-8 text-white">
          <div>
            { }
            <img src="/logo_white.svg" alt="logo" className="h-20 mb-8 animate-fade-in" />
            <h2 className="text-2xl font-bold mb-4 leading-tight animate-slide-up"> Teaching<br />Portal System (TPS)</h2>
            <p className="text-sm opacity-90 mb-8 animate-slide-up animation-delay-200">Hệ thống quản lý thông tin giáo viên, theo dõi tiến độ đào tạo, xử lý yêu cầu tra cứu thông tin nội bộ.</p>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-80">
            <span>Teaching Team</span>
          </div>
        </div>

        {/* Right side: Login form */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 md:px-12 py-4 sm:py-6 animate-fade-in animation-delay-200">
          <div className="flex flex-col gap-4 mb-2">
            <div className="flex justify-center md:hidden">
              { }
              <img src="/logo.svg" alt="MindX logo" className="h-14 w-auto" />
            </div>
            <h2 className="hidden md:block text-xl font-bold text-center text-[#800000] animate-slide-up">MindX Technology School</h2>
            <div className="text-lg font-semibold text-gray-900 text-center mt-2 mb-1 animate-slide-up animation-delay-200">Chào mừng bạn đến với TPS</div>
            <div className="text-sm text-gray-500 text-center mb-2 animate-fade-in animation-delay-300">Lựa chọn vai trò của bạn để tiếp tục</div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3 animate-shake">
              {error}
            </div>
          )}
  <div>
          <div className="flex justify-center gap-3 mb-4 flex-wrap">
            <Button
              variant={role === 'teacher' ? 'default' : 'outline'}
              onClick={() => handleRoleChange('teacher')}
              type="button"
              disabled={isSubmitting}
              className={role === 'teacher' ? 'bg-[#800000] hover:bg-[#a1001f] border-[#a1001f]' : 'text-[#800000] border-[#a1001f] hover:border-[#c1122f]'}
            >
              Giáo viên
            </Button>
            <Button
              variant={role === 'manager' ? 'default' : 'outline'}
              onClick={() => handleRoleChange('manager')}
              type="button"
              disabled={isSubmitting}
              className={role === 'manager' ? 'bg-[#800000] hover:bg-[#a1001f] border-[#a1001f]' : 'text-[#800000] border-[#a1001f] hover:border-[#c1122f]'}
            >
              Quản lý
            </Button>
            <Button
              variant={role === 'candidate' ? 'default' : 'outline'}
              onClick={() => handleRoleChange('candidate')}
              type="button"
              disabled={isSubmitting}
              className={role === 'candidate' ? 'bg-[#800000] hover:bg-[#a1001f] border-[#a1001f]' : 'text-[#800000] border-[#a1001f] hover:border-[#c1122f]'}
            >
              Ứng viên
            </Button>
             
          </div>
            <div className="text-sm text-gray-500 text-center mb-3 animate-fade-in animation-delay-400">
              {role === 'candidate' ? 'Đăng nhập bằng mã ứng viên được cấp.' : (
                <>Đăng nhập bằng tài khoản <a href="https://lms.mindx.edu.vn/" target="_blank" rel="noreferrer" className="text-[#a1001f] font-medium hover:underline transition-colors">https://lms.mindx.edu.vn/</a></>
              )}
            </div>
</div>
          <form className="flex flex-col gap-3 animate-fade-in animation-delay-300" onSubmit={handleSubmit} noValidate>
            <div className="relative group">
              <label className="block text-xs font-semibold mb-1 text-gray-700 transition-colors group-focus-within:text-[#800000]">Email / Mã đăng nhập</label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                placeholder="Email hoặc Mã đăng nhập..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 transition-all duration-300 hover:border-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="relative group">
              <label className="block text-xs font-semibold mb-1 text-gray-700 transition-colors group-focus-within:text-[#800000]">Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="**********"
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/20 transition-all duration-300 hover:border-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleTogglePassword}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={isSubmitting}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  <Icon icon={showPassword ? EyeOff : Eye} size="sm" />
                </Button>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 select-none">
              <input
                type="checkbox"
                checked={rememberAccount}
                onChange={(e) => setRememberAccount(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#800000] focus:ring-[#800000]/30"
                disabled={isSubmitting}
              />
              Lưu tài khoản
            </label>
            <Button
              type="submit"
              variant="default"
              className="w-full bg-[#800000] hover:bg-[#c1122f] mt-2 shadow-md hover:shadow-lg"
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>
          <div className="mt-2 border-t border-gray-100 pt-1">
            <InstallTpsApp compact hideWhenInstalled />
          </div>
        </div>
      </div>
    </div>
  );
}
