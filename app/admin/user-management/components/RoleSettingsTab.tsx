"use client";
import { toast } from "@/lib/app-toast";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { Loader2, Save, Settings, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import PermSelector from "./PermSelector";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/primitives/icon";

interface RoleData {
    role_code: string; role_name: string; description: string; department: string;
    permissions: string[]; permission_count: number;
}

export default function RoleSettingsTab() {
    const { token } = useAuth();
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
    const [perms, setPerms] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // New role modal state
    const [showNewRoleDialog, setShowNewRoleDialog] = useState(false);
    const [newRoleCode, setNewRoleCode] = useState("");
    const [newRoleName, setNewRoleName] = useState("");
    const [newRoleDept, setNewRoleDept] = useState("");
    const [newRoleDesc, setNewRoleDesc] = useState("");
    const [creatingRole, setCreatingRole] = useState(false);

    // Close modal on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (selectedRole) setSelectedRole(null);
                if (showNewRoleDialog) setShowNewRoleDialog(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRole, showNewRoleDialog]);

    useEffect(() => { loadRoles(); }, []);

    const loadRoles = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/app-auth/reference-data', { headers: authHeaders(token) });
            const data = await res.json();
            if (data.roles) setRoles(data.roles);
        } catch { toast.error("Lỗi tải roles"); }
        finally { setLoading(false); }
    };

    const openRole = (r: RoleData) => {
        setSelectedRole(r);
        setPerms(r.permissions.filter(p => p !== null));
    };

    const handleSave = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            const res = await fetch('/api/app-auth/role-permissions', {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ roleCode: selectedRole.role_code, permissions: perms }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Đã lưu ${data.count} quyền cho ${selectedRole.role_code}`);
                setSelectedRole(null);
                loadRoles();
            } else toast.error(data.error || "Lỗi");
        } catch { toast.error("Lỗi kết nối"); }
        finally { setSaving(false); }
    };

    const handleCreateRole = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingRole(true);
        try {
            const res = await fetch('/api/app-auth/role-permissions', {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({
                    roleCode: newRoleCode,
                    roleName: newRoleName,
                    department: newRoleDept,
                    description: newRoleDesc
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Đã tạo Role ${data.roleCode}`);
                setShowNewRoleDialog(false);
                setNewRoleCode(""); setNewRoleName(""); setNewRoleDept(""); setNewRoleDesc("");
                loadRoles();
            } else toast.error(data.error || "Lỗi");
        } catch { toast.error("Lỗi kết nối"); }
        finally { setCreatingRole(false); }
    };

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" /></div>;

    const depts = [...new Set(roles.map(r => r.department))];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-gray-500">Click vào role để set các màn hình mà role đó được xem. Sau đó gán role cho user ở tab "Quản lý tài khoản".</p>
                <Button onClick={() => setShowNewRoleDialog(true)} className="flex-shrink-0">
                    <Icon icon={Plus} size="sm" />
                    Thêm Role Mới
                </Button>
            </div>

            {/* Role list by department */}
            {depts.map(dept => (
                <div key={dept}>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">{dept}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {roles.filter(r => r.department === dept).map(r => {
                            const isSelected = selectedRole?.role_code === r.role_code;
                            return (
                                <Button 
                                    key={r.role_code} 
                                    onClick={() => openRole(r)}
                                    variant="outline"
                                    className={`text-left p-4 h-auto justify-start transition-all duration-200 hover:shadow-md ${
                                        isSelected ? 'border-[#a1001f] bg-red-50 shadow-md' : 'hover:border-gray-300'
                                    }`}
                                    asChild
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-bold text-gray-900">{r.role_code}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.permission_count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                }`}>{r.permission_count} màn hình</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-700">{r.role_name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{r.description}</p>
                                    </div>
                                </Button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Permission editor panel */}
            {selectedRole && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setSelectedRole(null)}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Settings className="h-5 w-5 text-[#a1001f]" />
                                Cài đặt màn hình: <span className="text-[#a1001f]">{selectedRole.role_code} — {selectedRole.role_name}</span>
                            </h3>
                            <Button variant="ghost" size="icon-sm" onClick={() => setSelectedRole(null)}>
                                <Icon icon={X} size="sm" />
                            </Button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto pr-2 border border-gray-200 rounded-xl p-3 bg-gray-50/50 mb-4">
                            <PermSelector perms={perms} setPerms={setPerms} />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-gray-200 font-medium">
                            <Button variant="outline" onClick={() => setSelectedRole(null)}>
                                Hủy
                            </Button>
                            <Button 
                                onClick={handleSave} 
                                disabled={saving}
                                loading={saving}
                            >
                                <Icon icon={Save} size="sm" />
                                Lưu cài đặt
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Role Modal */}
            {showNewRoleDialog && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setShowNewRoleDialog(false)}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                Thêm Role Mới
                            </h3>
                            <Button variant="ghost" size="icon-sm" onClick={() => setShowNewRoleDialog(false)}>
                                <Icon icon={X} size="sm" />
                            </Button>
                        </div>
                        <form onSubmit={handleCreateRole} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mã Role</label>
                                <input type="text" required value={newRoleCode} onChange={e => setNewRoleCode(e.target.value)} placeholder="VD: MKT, HR, AD..." className="w-full border border-gray-300 rounded-lg px-3 py-2 uppercase focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Role hiển thị</label>
                                <input type="text" required value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="VD: Marketing, Hành chính nhân sự..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban (nhóm)</label>
                                <input type="text" required value={newRoleDept} onChange={e => setNewRoleDept(e.target.value)} placeholder="VD: Back Office, Teaching..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                                <textarea rows={2} value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} placeholder="Phạm vi công việc của role này..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none resize-none"></textarea>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-2">
                                <Button type="button" variant="outline" onClick={() => setShowNewRoleDialog(false)}>
                                    Hủy
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={creatingRole}
                                    loading={creatingRole}
                                >
                                    <Icon icon={Plus} size="sm" />
                                    Khởi tạo Role
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
