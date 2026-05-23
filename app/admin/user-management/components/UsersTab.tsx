"use client";
import { toast } from "@/lib/app-toast";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { Building2, Check, Eye, EyeOff, Filter, Key, Loader2, Lock, Plus, Save, Search, Trash2, UserCheck, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface AppUser {
    id: number; email: string; display_name: string; role: string;
    is_active: boolean; created_by: string; created_at: string;
    auth_type: 'app' | 'firebase';
    permissions: { route_path: string; can_access: boolean }[];
    user_roles: string[];
}
interface RoleInfo { role_code: string; role_name: string; department: string; }
interface CenterInfo { id: number; full_name: string; short_code: string | null; region?: string | null; status?: string; }
interface AssignedCenterInfo extends CenterInfo { assignedAt?: string; source?: string; }

export default function UsersTab() {
    const { token } = useAuth();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [allRoles, setAllRoles] = useState<RoleInfo[]>([]);
    const [allCenters, setAllCenters] = useState<CenterInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [panel, setPanel] = useState<'none' | 'create' | 'addExisting' | 'roles' | 'password' | 'centers' | 'viewCenters'>('none');
    const [sel, setSel] = useState<AppUser | null>(null);

    // Create form
    const [newEmail, setNewEmail] = useState(""); const [newPw, setNewPw] = useState("");
    const [newName, setNewName] = useState(""); const [newUserRoles, setNewUserRoles] = useState<string[]>([]);
    const [showPw, setShowPw] = useState(false); const [creating, setCreating] = useState(false);
    // Add existing
    const [exEmail, setExEmail] = useState(""); const [exName, setExName] = useState("");
    const [exUserRoles, setExUserRoles] = useState<string[]>([]);
    const [adding, setAdding] = useState(false);
    // Roles assignment
    const [selRoles, setSelRoles] = useState<string[]>([]); const [savingRoles, setSavingRoles] = useState(false);
    // Center assignment
    const [selCenterIds, setSelCenterIds] = useState<Set<number>>(new Set());
    const [assignedCenters, setAssignedCenters] = useState<AssignedCenterInfo[]>([]);
    const [savingCenters, setSavingCenters] = useState(false);
    const [loadingCenters, setLoadingCenters] = useState(false);
    const [centerSearch, setCenterSearch] = useState("");
    // Change password
    const [chPw, setChPw] = useState(""); const [showChPw, setShowChPw] = useState(false);
    const [chPwing, setChPwing] = useState(false);
    // Confirm dialog
    const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; userId: number; name: string }>({ open: false, userId: 0, name: "" });
    const [userSearch, setUserSearch] = useState("");
    // Filters
    const [roleFilter, setRoleFilter] = useState<string[]>([]);
    const [areaFilter, setAreaFilter] = useState<string[]>([]);
    const [authTypeFilter, setAuthTypeFilter] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [createdByFilter, setCreatedByFilter] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    // Filter searches
    const [roleSearch, setRoleSearch] = useState("");
    const [areaSearch, setAreaSearch] = useState("");
    const [createdBySearch, setCreatedBySearch] = useState("");

    // Close modal on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && panel !== 'none') close();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [panel]);

    useEffect(() => { loadReferenceData(); }, []);

    const loadReferenceData = async () => {
        try {
            setLoading(true);
            const r = await fetch('/api/app-auth/reference-data', { headers: authHeaders(token) });
            const d = await r.json();
            if (d.users) setUsers(d.users);
            if (d.roles) setAllRoles(d.roles);
            if (d.centers) setAllCenters(d.centers);
        } catch { toast.error("Lỗi tải dữ liệu tham chiếu"); }
        finally { setLoading(false); }
    };

    const close = () => {
        setPanel('none');
        setSel(null);
        setSelCenterIds(new Set());
        setAssignedCenters([]);
        setCenterSearch("");
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !newPw || !newName) { toast.error("Điền đầy đủ"); return; }
        setCreating(true);
        try {
            const r = await fetch("/api/app-auth/users", {
                method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(token) },
                body: JSON.stringify({ email: newEmail, password: newPw, displayName: newName, role: 'manager', userRoles: newUserRoles, authType: 'app' })
            });
            const d = await r.json();
            if (d.success) {
                toast.success("Tạo thành công");
                setNewEmail(""); setNewPw(""); setNewName(""); setNewUserRoles([]); close(); loadReferenceData();
            } else { toast.error(d.error || "Lỗi tạo tài khoản"); }
        } catch { toast.error("Lỗi mạng"); } finally { setCreating(false); }
    };

    const handleAddExisting = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!exEmail || !exName) { toast.error("Điền email và tên"); return; }
        setAdding(true);
        try {
            const r = await fetch("/api/app-auth/users", {
                method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(token) },
                body: JSON.stringify({ email: exEmail, displayName: exName, role: 'manager', userRoles: exUserRoles, authType: 'firebase' })
            });
            const d = await r.json();
            if (d.success) {
                toast.success("Đã phân quyền cho tài khoản TMS");
                setExEmail(""); setExName(""); setExUserRoles([]); close(); loadReferenceData();
            } else { toast.error(d.error || "Lỗi"); }
        } catch { toast.error("Lỗi mạng"); } finally { setAdding(false); }
    };

    const openRoles = (u: AppUser) => { setSel(u); setSelRoles(u.user_roles || []); setPanel('roles'); };
    const handleSaveRoles = async () => {
        if (!sel) return; setSavingRoles(true);
        try {
            const r = await fetch("/api/app-auth/user-roles", {
                method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(token) },
                body: JSON.stringify({ userId: sel.id, roleCodes: selRoles })
            });
            const d = await r.json();
            if (d.success) { toast.success(`Đã gán ${d.count} role`); close(); loadReferenceData(); }
            else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setSavingRoles(false) }
    };

    const openViewCenters = async (u: AppUser) => {
        setSel(u);
        setPanel('viewCenters');
        setCenterSearch("");
        setLoadingCenters(true);
        try {
            const r = await fetch(`/api/app-auth/manager-centers?userId=${u.id}`, { headers: authHeaders(token) });
            const d = await r.json();
            const centers = (d.centers || []) as AssignedCenterInfo[];
            setAssignedCenters(centers);
        } catch {
            toast.error("Không tải được danh sách cơ sở");
            setAssignedCenters([]);
        } finally {
            setLoadingCenters(false);
        }
    };

    const openCenters = async (u: AppUser) => {
        setSel(u);
        setPanel('centers');
        setCenterSearch("");
        setLoadingCenters(true);
        try {
            const r = await fetch(`/api/app-auth/manager-centers?userId=${u.id}`, { headers: authHeaders(token) });
            const d = await r.json();
            const centers = (d.centers || []) as AssignedCenterInfo[];
            setAssignedCenters(centers);
            setSelCenterIds(new Set(centers.map((c) => c.id)));
        } catch {
            toast.error("Không tải được danh sách cơ sở");
            setAssignedCenters([]);
            setSelCenterIds(new Set());
        } finally {
            setLoadingCenters(false);
        }
    };

    const handleSaveCenters = async () => {
        if (!sel) return;
        setSavingCenters(true);
        try {
            const r = await fetch('/api/app-auth/manager-centers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ userId: sel.id, centerIds: Array.from(selCenterIds) }),
            });
            const d = await r.json();
            if (d.success) {
                toast.success('Đã cập nhật cơ sở quản lý');
                close();
                loadReferenceData();
            } else {
                toast.error(d.error || 'Không thể cập nhật cơ sở');
            }
        } catch {
            toast.error('Lỗi mạng');
        } finally {
            setSavingCenters(false);
        }
    };

    const openChPw = (u: AppUser) => { setSel(u); setChPw(""); setShowChPw(false); setPanel('password'); };
    const handleChPw = async (e: React.FormEvent) => {
        e.preventDefault(); if (!sel || !chPw) return; if (chPw.length < 6) { toast.error("Tối thiểu 6 ký tự"); return; }
        setChPwing(true);
        try {
            const r = await fetch("/api/app-auth/users", {
                method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders(token) },
                body: JSON.stringify({ id: sel.id, password: chPw })
            });
            const d = await r.json();
            if (d.success) { toast.success("Đã đổi MK"); close(); } else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setChPwing(false) }
    };

    const handleToggle = async (id: number, active: boolean) => {
        try {
            const r = await fetch("/api/app-auth/users", {
                method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders(token) },
                body: JSON.stringify({ id, isActive: !active })
            }); const d = await r.json();
            if (d.success) { toast.success(active ? "Vô hiệu" : "Kích hoạt"); loadReferenceData(); }
        } catch { toast.error("Lỗi") }
    };

    const confirmDelete = (u: AppUser) => setConfirmDlg({ open: true, userId: u.id, name: u.display_name });
    const handleDelete = async () => {
        try {
            const r = await fetch(`/api/app-auth/users?id=${confirmDlg.userId}`, { method: "DELETE", headers: authHeaders(token) });
            const d = await r.json(); if (d.success) { toast.success("Đã xóa"); loadReferenceData(); } else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setConfirmDlg({ open: false, userId: 0, name: "" }) }
    };

    const depts = useMemo(
        () => [...new Set(allRoles.map((r) => r.department))].sort(),
        [allRoles],
    );

    // Filter options
    const roleOptions = useMemo(() => {
        const uniqueRoles = new Set<string>();
        users.forEach(u => (u.user_roles || []).forEach(r => uniqueRoles.add(r)));
        return Array.from(uniqueRoles).sort();
    }, [users]);

    const areaOptions = useMemo(() => {
        const uniqueAreas = new Set<string>();
        allCenters.forEach(c => { if (c.region) uniqueAreas.add(c.region); });
        return Array.from(uniqueAreas).sort();
    }, [allCenters]);

    const authTypeOptions = ['app', 'firebase'];
    const statusOptions = ['active', 'inactive'];
    const createdByOptions = useMemo(() => {
        const uniqueCreatedBy = new Set<string>();
        users.forEach(u => { if (u.created_by) uniqueCreatedBy.add(u.created_by); });
        return Array.from(uniqueCreatedBy).sort();
    }, [users]);

    // Filtered options based on search
    const filteredRoleOptions = useMemo(() => {
        const q = roleSearch.trim().toLowerCase();
        if (!q) return roleOptions;
        return roleOptions.filter(r => r.toLowerCase().includes(q));
    }, [roleOptions, roleSearch]);

    const filteredAreaOptions = useMemo(() => {
        const q = areaSearch.trim().toLowerCase();
        if (!q) return areaOptions;
        return areaOptions.filter(a => a.toLowerCase().includes(q));
    }, [areaOptions, areaSearch]);

    const filteredCreatedByOptions = useMemo(() => {
        const q = createdBySearch.trim().toLowerCase();
        if (!q) return createdByOptions;
        return createdByOptions.filter(c => c.toLowerCase().includes(q));
    }, [createdByOptions, createdBySearch]);

    const filteredUsers = useMemo(() => {
        let filtered = users;

        // Text search
        const q = userSearch.trim().toLowerCase();
        if (q) {
            filtered = filtered.filter(
                (u) =>
                    u.display_name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    (u.user_roles || []).some((r) => r.toLowerCase().includes(q)),
            );
        }

        // Role filter
        if (roleFilter.length > 0) {
            filtered = filtered.filter(u =>
                (u.user_roles || []).some(r => roleFilter.includes(r))
            );
        }

        // Area filter (placeholder - would need additional API call to check user centers)
        if (areaFilter.length > 0) {
            // TODO: Implement area filtering based on user's assigned centers
            // For now, skip this filter
        }

        // Auth type filter
        if (authTypeFilter.length > 0) {
            filtered = filtered.filter(u => authTypeFilter.includes(u.auth_type));
        }

        // Status filter
        if (statusFilter.length > 0) {
            filtered = filtered.filter(u =>
                statusFilter.includes(u.is_active ? 'active' : 'inactive')
            );
        }

        // Created by filter
        if (createdByFilter.length > 0) {
            filtered = filtered.filter(u =>
                u.created_by && createdByFilter.includes(u.created_by)
            );
        }

        return filtered;
    }, [users, userSearch, roleFilter, areaFilter, authTypeFilter, statusFilter, createdByFilter]);

    const filteredCenters = useMemo(() => {
        const q = centerSearch.trim().toLowerCase();
        const activeCenters = allCenters.filter((c) => (c.status || 'Active') === 'Active');
        if (!q) return activeCenters;
        return activeCenters.filter((c) =>
            c.full_name.toLowerCase().includes(q) ||
            String(c.short_code || '').toLowerCase().includes(q)
        );
    }, [allCenters, centerSearch]);

    return (
        <div className="space-y-4">
            {/* Action buttons */}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Tìm theo tên, email, role..."
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/80 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/15"
                        aria-label="Tìm người dùng"
                    />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <button onClick={() => { setPanel(panel === 'addExisting' ? 'none' : 'addExisting'); setSel(null); }}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-md transition-all hover:scale-[1.01] sm:w-auto ${panel === 'addExisting' ? 'bg-gray-200 text-gray-700' : 'bg-gradient-to-r from-green-600 to-green-700 text-white'}`}>
                    {panel === 'addExisting' ? <X className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    {panel === 'addExisting' ? "Đóng" : "Thêm TK đã có"}
                </button>
                <button onClick={() => { setPanel(panel === 'create' ? 'none' : 'create'); setSel(null); }}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-md transition-all hover:scale-[1.01] sm:w-auto ${panel === 'create' ? 'bg-gray-200 text-gray-700' : 'bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white'}`}>
                    {panel === 'create' ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {panel === 'create' ? "Đóng" : "Tạo TK mới"}
                </button>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-start xl:justify-end">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all sm:w-auto ${
                            showFilters ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <Filter className="h-4 w-4" />
                        Bộ lọc
                        {(roleFilter.length + areaFilter.length + authTypeFilter.length + statusFilter.length + createdByFilter.length) > 0 && (
                            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                {roleFilter.length + areaFilter.length + authTypeFilter.length + statusFilter.length + createdByFilter.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="bg-gradient-to-b from-blue-50/50 to-white border-2 border-blue-100 rounded-xl p-4 shadow-sm sm:p-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {/* Role Filter */}
                        <div className="flex flex-col">
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>Role
                            </label>
                            <input
                                type="text"
                                placeholder="Tìm role..."
                                value={roleSearch}
                                onChange={(e) => setRoleSearch(e.target.value)}
                                className="mb-2 px-2.5 py-1.5 border border-blue-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400"
                            />
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {filteredRoleOptions.length === 0 ? (
                                    <p className="text-xs text-gray-400 py-2">Không tìm thấy</p>
                                ) : (
                                    filteredRoleOptions.map(role => (
                                        <label key={role} className="flex items-center gap-2 text-sm cursor-pointer group hover:bg-blue-50 px-1 py-1 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={roleFilter.includes(role)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setRoleFilter([...roleFilter, role]);
                                                    } else {
                                                        setRoleFilter(roleFilter.filter(r => r !== role));
                                                    }
                                                }}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded accent-blue-600"
                                            />
                                            <span className="text-gray-700 group-hover:text-gray-900">{role}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Area Filter */}
                        <div className="flex flex-col">
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-600"></span>Khu vực
                            </label>
                            <input
                                type="text"
                                placeholder="Tìm khu vực..."
                                value={areaSearch}
                                onChange={(e) => setAreaSearch(e.target.value)}
                                className="mb-2 px-2.5 py-1.5 border border-green-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400"
                            />
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {filteredAreaOptions.length === 0 ? (
                                    <p className="text-xs text-gray-400 py-2">Không tìm thấy</p>
                                ) : (
                                    filteredAreaOptions.map(area => (
                                        <label key={area} className="flex items-center gap-2 text-sm cursor-pointer group hover:bg-green-50 px-1 py-1 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={areaFilter.includes(area)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setAreaFilter([...areaFilter, area]);
                                                    } else {
                                                        setAreaFilter(areaFilter.filter(a => a !== area));
                                                    }
                                                }}
                                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded accent-green-600"
                                            />
                                            <span className="text-gray-700 group-hover:text-gray-900">{area}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Auth Type Filter */}
                        <div className="flex flex-col">
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-600"></span>Loại tài khoản
                            </label>
                            <div className="space-y-1.5">
                                {authTypeOptions.map(type => (
                                    <label key={type} className="flex items-center gap-2 text-sm cursor-pointer group hover:bg-purple-50 px-1 py-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={authTypeFilter.includes(type)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setAuthTypeFilter([...authTypeFilter, type]);
                                                } else {
                                                    setAuthTypeFilter(authTypeFilter.filter(t => t !== type));
                                                }
                                            }}
                                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded accent-purple-600"
                                        />
                                        <span className="text-gray-700 group-hover:text-gray-900">
                                            {type === 'firebase' ? '🔥 LMS (Firebase)' : '🔐 App (Nội bộ)'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div className="flex flex-col">
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-600"></span>Trạng thái
                            </label>
                            <div className="space-y-1.5">
                                {statusOptions.map(status => (
                                    <label key={status} className="flex items-center gap-2 text-sm cursor-pointer group hover:bg-amber-50 px-1 py-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={statusFilter.includes(status)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setStatusFilter([...statusFilter, status]);
                                                } else {
                                                    setStatusFilter(statusFilter.filter(s => s !== status));
                                                }
                                            }}
                                            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded accent-amber-600"
                                        />
                                        <span className="text-gray-700 group-hover:text-gray-900">
                                            {status === 'active' ? '✓ Đang hoạt động' : '✗ Vô hiệu'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Created By Filter */}
                        <div className="flex flex-col">
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-600"></span>Người tạo
                            </label>
                            <input
                                type="text"
                                placeholder="Tìm người tạo..."
                                value={createdBySearch}
                                onChange={(e) => setCreatedBySearch(e.target.value)}
                                className="mb-2 px-2.5 py-1.5 border border-red-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400"
                            />
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {filteredCreatedByOptions.length === 0 ? (
                                    <p className="text-xs text-gray-400 py-2">Không tìm thấy</p>
                                ) : (
                                    filteredCreatedByOptions.map(creator => (
                                        <label key={creator} className="flex items-center gap-2 text-sm cursor-pointer group hover:bg-red-50 px-1 py-1 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={createdByFilter.includes(creator)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setCreatedByFilter([...createdByFilter, creator]);
                                                    } else {
                                                        setCreatedByFilter(createdByFilter.filter(c => c !== creator));
                                                    }
                                                }}
                                                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded accent-red-600"
                                            />
                                            <span className="text-gray-700 group-hover:text-gray-900 text-xs truncate" title={creator}>{creator}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Clear filters */}
                    <div className="mt-5 flex flex-col gap-3 border-t border-blue-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-gray-500">
                            {(roleFilter.length + areaFilter.length + authTypeFilter.length + statusFilter.length + createdByFilter.length) > 0 && (
                                <span>Đã áp dụng <strong>{roleFilter.length + areaFilter.length + authTypeFilter.length + statusFilter.length + createdByFilter.length}</strong> bộ lọc</span>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setRoleFilter([]);
                                setAreaFilter([]);
                                setAuthTypeFilter([]);
                                setStatusFilter([]);
                                setCreatedByFilter([]);
                                setRoleSearch("");
                                setAreaSearch("");
                                setCreatedBySearch("");
                            }}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-red-600 hover:to-red-700 sm:w-auto"
                        >
                            Xóa tất cả
                        </button>
                    </div>
                </div>
            )}

            {/* Add existing panel */}
            {panel === 'addExisting' && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900"><UserCheck className="h-5 w-5 text-green-600" />Thêm tài khoản đã có & phân quyền</h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-5 border-b pb-3">Dành cho tài khoản TMS. Nhập email đã có, đặt tên, chọn quyền.</p>
                        <form onSubmit={handleAddExisting} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email / Mã đăng nhập</label>
                                    <input type="text" inputMode="email" autoComplete="email" value={exEmail} onChange={e => setExEmail(e.target.value)} placeholder="user@mindx.net.vn hoặc mã đăng nhập" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Tên</label>
                                    <input type="text" value={exName} onChange={e => setExName(e.target.value)} placeholder="Nguyễn Văn A" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" /></div>
                            </div>
                            <div className="mt-4"><label className="block text-sm font-semibold text-gray-800 mb-2">Vai trò (Role)</label>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto border rounded-xl p-3 bg-gray-50/50">
                                    {depts.map(dept => (
                                        <div key={dept}>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-l-2 border-green-500 pl-2">{dept}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {allRoles.filter(r => r.department === dept).map(r => (
                                                    <label key={r.role_code} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${exUserRoles.includes(r.role_code) ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                                        <input type="checkbox" checked={exUserRoles.includes(r.role_code)}
                                                            onChange={() => setExUserRoles(prev => prev.includes(r.role_code) ? prev.filter(x => x !== r.role_code) : [...prev, r.role_code])}
                                                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-gray-300" />
                                                        <span className="text-sm font-medium">{r.role_code}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t font-medium">
                                <button type="button" onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                <button type="submit" disabled={adding} className="px-5 py-2 text-sm text-white bg-[#15803d] hover:bg-[#166534] transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}Thêm & Phân quyền
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create panel */}
            {panel === 'create' && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5 border-b pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900"><Plus className="h-5 w-5 text-[#a1001f]" />Tạo tài khoản mới (nội bộ)</h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Email / Mã đăng nhập</label>
                                    <input type="text" inputMode="email" autoComplete="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@mindx.edu.vn hoặc mã đăng nhập" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" /></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Tên</label>
                                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nguyễn Văn A" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" /></div>
                                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
                                    <div className="relative"><input type={showPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Tối thiểu 6 ký tự" required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" />
                                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 hover:bg-gray-100 rounded-full transition-colors">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                                <div className="md:col-span-2 space-y-1"><label className="block text-sm font-medium text-gray-700">Vai trò (Role)</label>
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto border border-[#a1001f]/20 rounded-xl p-3 bg-gray-50/50">
                                        {depts.map(dept => (
                                            <div key={dept}>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-l-2 border-[#a1001f] pl-2">{dept}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {allRoles.filter(r => r.department === dept).map(r => (
                                                        <label key={r.role_code} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${newUserRoles.includes(r.role_code) ? 'border-[#a1001f] bg-red-50 text-[#a1001f]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                                            <input type="checkbox" checked={newUserRoles.includes(r.role_code)}
                                                                onChange={() => setNewUserRoles(prev => prev.includes(r.role_code) ? prev.filter(x => x !== r.role_code) : [...prev, r.role_code])}
                                                                className="w-4 h-4 rounded text-[#a1001f] focus:ring-[#a1001f] border-gray-300" />
                                                            <span className="text-sm font-medium">{r.role_code}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 mt-2 border-t font-medium">
                                <button type="button" onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                <button type="submit" disabled={creating} className="px-5 py-2 text-sm text-white bg-[#a1001f] hover:bg-[#c41230] transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Tạo tài khoản
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Roles assignment panel */}
            {panel === 'roles' && sel && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900"><Key className="h-5 w-5 text-indigo-600" />Gán role quản lý cho: <span className="text-indigo-600">{sel.display_name}</span></h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-5 border-b pb-3">Mỗi role chứa một tập hợp các quyền truy cập màn hình. User sẽ được cấp quyền tổng hợp từ những role được chỉ định.</p>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto p-1">
                            {depts.map(dept => (
                                <div key={dept}>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-l-2 border-indigo-500 pl-2">{dept}</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                        {allRoles.filter(r => r.department === dept).map(r => (
                                            <label key={r.role_code} className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${selRoles.includes(r.role_code) ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                                                <input type="checkbox" checked={selRoles.includes(r.role_code)}
                                                    onChange={() => setSelRoles(prev => prev.includes(r.role_code) ? prev.filter(x => x !== r.role_code) : [...prev, r.role_code])}
                                                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900">{r.role_code}</p>
                                                    <p className="text-[11px] text-gray-500 truncate mt-0.5" title={r.role_name}>{r.role_name}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 mt-6 border-t font-medium">
                            <button onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                            <button onClick={handleSaveRoles} disabled={savingRoles}
                                className="px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                {savingRoles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu thay đổi role
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Centers assignment panel */}
            {panel === 'centers' && sel && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3 border-b pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                                <Building2 className="h-5 w-5 text-blue-600" />
                                Gán cơ sở quản lý cho: <span className="text-blue-700">{sel.display_name}</span>
                            </h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">
                            Danh sách cơ sở được lấy từ Dữ liệu tham chiếu. Các dashboard/filter theo khu vực-cơ sở sẽ dựa trên cấu hình này.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border rounded-xl p-3">
                                <p className="text-sm font-semibold mb-2">Kho cơ sở tham chiếu (Active)</p>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={centerSearch}
                                        onChange={(e) => setCenterSearch(e.target.value)}
                                        placeholder="Tìm theo tên/mã cơ sở..."
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50/80 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/15"
                                    />
                                </div>
                                <div className="max-h-80 overflow-y-auto space-y-1">
                                    {filteredCenters.map((c) => (
                                        <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selCenterIds.has(c.id)}
                                                onChange={() => {
                                                    const next = new Set(selCenterIds);
                                                    if (next.has(c.id)) next.delete(c.id);
                                                    else next.add(c.id);
                                                    setSelCenterIds(next);
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{c.full_name}</p>
                                                <p className="text-xs text-gray-500">{c.short_code || 'N/A'}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="border rounded-xl p-3">
                                <p className="text-sm font-semibold mb-2">Cơ sở đang gán</p>
                                {loadingCenters ? (
                                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#a1001f]" /></div>
                                ) : assignedCenters.length === 0 ? (
                                    <p className="text-sm text-gray-500 py-6 text-center">Chưa gán cơ sở nào.</p>
                                ) : (
                                    <div className="max-h-80 overflow-y-auto space-y-1">
                                        {assignedCenters.map((c) => (
                                            <div key={c.id} className="px-2 py-1.5 rounded bg-gray-50">
                                                <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                                                <p className="text-xs text-gray-500">{c.short_code || 'N/A'}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 mt-6 border-t font-medium">
                            <button onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                            <button onClick={handleSaveCenters} disabled={savingCenters}
                                className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                {savingCenters ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu cơ sở phụ trách
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Centers panel */}
            {panel === 'viewCenters' && sel && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3 border-b pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                                <Eye className="h-5 w-5 text-green-600" />
                                Cơ sở được quyền xem: <span className="text-green-700">{sel.display_name}</span>
                            </h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">
                            Danh sách cơ sở mà user này có quyền truy cập và quản lý.
                        </p>

                        {loadingCenters ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-green-600" /></div>
                        ) : assignedCenters.length === 0 ? (
                            <div className="text-center py-10">
                                <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-sm text-gray-500">Chưa được gán cơ sở nào.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {assignedCenters.map((c) => (
                                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-100 transition-colors">
                                        <Building2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900">{c.full_name}</p>
                                            <p className="text-xs text-gray-500">{c.short_code || 'N/A'}</p>
                                        </div>
                                        {c.source && (
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                c.source === 'manager_centers' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {c.source === 'manager_centers' ? 'Gán trực tiếp' : 'Từ Leaders'}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end pt-4 mt-6 border-t font-medium">
                            <button onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change password panel */}
            {panel === 'password' && sel && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={close}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4 border-b pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900"><Lock className="h-5 w-5 text-amber-500" />Đổi mật khẩu</h3>
                            <button onClick={close} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm font-medium text-amber-600 mb-4 truncate" title={sel.display_name}>{sel.display_name}</p>

                        {sel.auth_type === 'firebase' ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                                <p className="text-sm text-amber-800">⚠️ Tài khoản TMS — Mật khẩu được quản lý và đặt lại qua hệ thống TMS Auth.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleChPw} className="space-y-4">
                                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                                    <div className="relative"><input type={showChPw ? "text" : "password"} value={chPw} onChange={e => setChPw(e.target.value)} placeholder="Tối thiểu 6 ký tự" required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" />
                                        <button type="button" onClick={() => setShowChPw(!showChPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1 hover:bg-gray-100 rounded-full transition-colors">{showChPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                                <div className="flex justify-end gap-3 pt-3 mt-4 border-t font-medium">
                                    <button type="button" onClick={close} className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">Hủy</button>
                                    <button type="submit" disabled={chPwing} className="px-5 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 transition-colors rounded-lg shadow disabled:opacity-50 flex items-center gap-2">
                                        {chPwing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}Cập nhật MK
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Users table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/90 to-white sm:px-6">
                    <h3 className="text-sm font-bold flex flex-wrap items-center gap-2">
                        <Users className="h-4 w-4 text-[#a1001f]" />
                        Danh sách
                        <span className="font-normal text-gray-500">
                            ({filteredUsers.length}
                            {userSearch.trim() ? ` / ${users.length}` : ''})
                        </span>
                    </h3>
                </div>
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" /></div>
                ) : users.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">Chưa có tài khoản nào</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm">Không khớp bộ lọc tìm kiếm.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredUsers.map(u => {
                            const isSel = sel?.id === u.id;
                            return (
                                <div key={u.id} className={`hover:bg-gray-50 transition-colors ${isSel ? 'bg-blue-50/50 ring-1 ring-blue-200' : ''}`}>
                                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-3">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow flex-shrink-0 ${u.role === 'super_admin' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : u.is_active ? 'bg-gradient-to-br from-[#a1001f] to-[#c41230]' : 'bg-gray-400'}`}>
                                            {u.display_name.charAt(0).toUpperCase()}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-gray-900 break-words">{u.display_name}</p>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'super_admin' ? 'bg-amber-100 text-amber-800' : u.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                                    {u.role === 'super_admin' ? '👑 Super Admin' : u.role === 'admin' ? 'Admin' : 'Manager'}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-xs ${u.auth_type === 'firebase' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'}`}>
                                                    {u.auth_type === 'firebase' ? '🔥 TMS' : '🔐 App'}</span>
                                                {!u.is_active && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Vô hiệu</span>}
                                            </div>
                                            <p className="text-xs text-gray-500 break-all">{u.email}</p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                                {(u.user_roles || []).map((rc: string) => (
                                                    <span key={rc} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">{rc}</span>
                                                ))}
                                                {(!u.user_roles || u.user_roles.length === 0) && <span className="text-xs text-gray-400">Chưa gán role</span>}
                                            </div>
                                        </div>
                                        {u.role !== 'super_admin' && (
                                            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                                                <button onClick={() => openViewCenters(u)} className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all sm:flex-none ${isSel && panel === 'viewCenters' ? 'bg-green-600 text-white border-green-600' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                                                    <Eye className="h-3.5 w-3.5" />Xem cơ sở</button>
                                                <button onClick={() => openRoles(u)} className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all sm:flex-none ${isSel && panel === 'roles' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}>
                                                    <Key className="h-3.5 w-3.5" />Gán Role</button>
                                                {(u.role === 'admin' || u.role === 'manager') && (
                                                    <button onClick={() => openCenters(u)} className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all sm:flex-none ${isSel && panel === 'centers' ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}>
                                                        <Building2 className="h-3.5 w-3.5" />Gán cơ sở
                                                    </button>
                                                )}
                                                {u.auth_type !== 'firebase' && (
                                                    <button onClick={() => openChPw(u)} className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all sm:flex-none ${isSel && panel === 'password' ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}>
                                                        <Lock className="h-3.5 w-3.5" />Đổi MK</button>
                                                )}
                                                <button onClick={() => handleToggle(u.id, u.is_active)} title={u.is_active ? "Vô hiệu" : "Kích hoạt"}
                                                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${u.is_active ? 'border-gray-200 hover:border-orange-400 hover:bg-orange-50' : 'border-gray-200 hover:border-green-400 hover:bg-green-50'}`}>
                                                    {u.is_active ? <X className="h-3.5 w-3.5 text-gray-400" /> : <Check className="h-3.5 w-3.5 text-gray-400" />}</button>
                                                <button onClick={() => confirmDelete(u)} title="Xóa" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 hover:border-red-400 hover:bg-red-50">
                                                    <Trash2 className="h-3.5 w-3.5 text-gray-400" /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <ConfirmDialog open={confirmDlg.open} title="Xóa tài khoản" variant="danger"
                message={`Bạn chắc chắn muốn xóa tài khoản "${confirmDlg.name}"? Hành động này không thể hoàn tác.`}
                confirmText="Xóa tài khoản" onConfirm={handleDelete}
                onCancel={() => setConfirmDlg({ open: false, userId: 0, name: "" })} />
        </div>
    );
}
