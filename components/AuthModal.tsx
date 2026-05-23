import { useEffect, useState } from "react";

export default function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [role, setRole] = useState<'teacher' | 'manager'>('teacher');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Handle ESC key to close modal
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl flex w-full max-w-4xl md:h-135 max-h-[92vh] relative overflow-hidden">
        {/* Left side: Banner */}
        <div className="hidden md:flex flex-col justify-between items-start bg-[#a1001f] w-1/2 h-full p-8 text-white relative">
          <div>
            <img src="../logo_white.svg" alt="logo" className="h-20 mb-8" />
            <h2 className="text-2xl font-bold mb-4 leading-tight">Nuturing Global<br />Pioneer in tech</h2>
            <p className="text-sm opacity-90 mb-8">Access your dashboard to manage classes, track student performance, and coordinate with the Teaching Portal System (TPS).</p>
          </div>
          <div className="flex items-center gap-2 text-xs opacity-80">
            <span>MindX Teaching Team</span>
          </div>
          <button
            className="absolute top-3 right-3 text-white text-2xl font-bold hover:text-gray-200"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        {/* Right side: Login form */}
        <div className="flex-1 flex flex-col justify-center px-5 sm:px-8 py-6 relative overflow-y-auto">
          <button
            className="absolute top-3 right-3 text-gray-400 text-2xl font-bold hover:text-gray-700 md:hidden"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
          <div className="flex flex-col gap-2 mb-2">
            <h2 className="text-xl font-bold text-center text-[#a1001f]">MindX Technology School</h2>
            <div className="text-lg font-semibold text-gray-900 text-center mt-2 mb-1">Welcome to Portal</div>
            <div className="text-sm text-gray-500 text-center mb-2">Lựa chọn vai trò của bạn để tiếp tục</div>
          </div>
          <div className="flex justify-center gap-3 mb-4 flex-wrap">
            <button
              className={`px-4 py-1 rounded-full border text-sm font-medium transition-all ${role === 'teacher' ? 'bg-[#a1001f] text-white border-[#a1001f]' : 'bg-white text-[#a1001f] border-[#a1001f]'}`}
              onClick={() => setRole('teacher')}
              type="button"
            >
              Teacher
            </button>
            <button
              className={`px-4 py-1 rounded-full border text-sm font-medium transition-all ${role === 'manager' ? 'bg-[#a1001f] text-white border-[#a1001f]' : 'bg-white text-[#a1001f] border-[#a1001f]'}`}
              onClick={() => setRole('manager')}
              type="button"
            >
              Manager
            </button>
          </div>
          <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); /* handle login */ }}>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">Username or Email / Mã đăng nhập</label>
              <input
                type="text"
                placeholder="Email, Username or Code..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#a1001f]"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-700">Password</label>
              <input
                type="password"
                placeholder="Password"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#a1001f]"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <div className="text-right mt-1">
                <a href="#" className="text-xs text-[#a1001f] hover:underline">Quên mật khẩu?</a>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-[#a1001f] text-white rounded py-2 font-semibold text-base mt-2 hover:bg-[#c1122f] transition-all"
            >
              Sign In
            </button>
          </form>
          <div className="text-xs text-center text-gray-500 mt-4">
            Bạn gặp khó khăn khi đăng nhập? <a href="#" className="text-[#a1001f] hover:underline font-medium">Nhận trợ giúp</a>
          </div>
        </div>
      </div>
    </div>
  );
}
