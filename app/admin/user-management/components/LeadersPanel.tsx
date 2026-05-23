"use client";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { getLeaderAreas } from "@/lib/teaching-leaders";
import { Edit2, Filter, Loader2, MapPin, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/app-toast";
import ConfirmDialog from "./ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/primitives/icon";

interface Leader {
    code: string;
    full_name: string;
    role_code: string;
    role_name: string;
    center: string;
    courses: string;
    area: string;
    areas?: string[];
    status: string;
    joined_date: string;
}
interface Filters { areas: string[]; roleCodes: { role_code: string; role_name: string }[]; statuses: string[]; }

export default function LeadersPanel() {
    const { token } = useAuth();
    const [data, setData] = useState<Leader[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<Filters>({ areas: [], roleCodes: [], statuses: [] });
    const [search, setSearch] = useState(""); const [fStatus, setFStatus] = useState(""); const [fArea, setFArea] = useState(""); const [fRole, setFRole] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [editLeader, setEditLeader] = useState<Leader | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; code: string; name: string }>({ open: false, code: "", name: "" });
    const [statusDlg, setStatusDlg] = useState<{ open: boolean; leader: Leader | null; newStatus: string }>({ open: false, leader: null, newStatus: '' });

    useEffect(() => { load(); }, [fStatus, fArea, fRole]);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ table: 'teaching_leaders' });
            if (fStatus) params.set('status', fStatus);
            if (fArea) params.set('area', fArea);
            if (fRole) params.set('roleCode', fRole);
            const r = await fetch(`/api/app-auth/data?${params}`, { headers: authHeaders(token) });
            const d = await r.json();
            if (d.rows) setData(d.rows);
            if (d.filters) setFilters(d.filters);
        } catch { toast.error("Lỗi") } finally { setLoading(false) }
    };

    const filtered = data.filter(l => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            l.full_name.toLowerCase().includes(q) ||
            l.code.toLowerCase().includes(q) ||
            l.center.toLowerCase().includes(q) ||
            getLeaderAreas(l).some((a) => a.toLowerCase().includes(q))
        );
    });

    const askToggleStatus = (l: Leader) => {
        const newStatus = l.status === 'Active' ? 'Deactive' : 'Active';
        setStatusDlg({ open: true, leader: l, newStatus });
    };
    const doToggleStatus = async () => {
        if (!statusDlg.leader) return;
        try {
            const r = await fetch('/api/app-auth/data', {
                method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ table: 'teaching_leaders_status', code: statusDlg.leader.code, status: statusDlg.newStatus })
            });
            const d = await r.json();
            if (d.success) { toast.success(`${statusDlg.leader.full_name}: ${statusDlg.newStatus}`); load(); }
        } catch { toast.error("Lỗi") }
        finally { setStatusDlg({ open: false, leader: null, newStatus: '' }); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editLeader) return;
        const areas = editLeader.areas?.length ? editLeader.areas : getLeaderAreas(editLeader);
        if (areas.length === 0) {
            toast.error('Chọn ít nhất một khu vực.');
            return;
        }
        setSaving(true);
        try {
            const method = isNew ? 'POST' : 'PUT';
            const r = await fetch('/api/app-auth/data', {
                method, headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({
                    table: 'teaching_leaders',
                    ...editLeader,
                    areas,
                    area: areas[0] || '',
                })
            });
            const d = await r.json();
            if (d.success) { toast.success(isNew ? "Đã thêm" : "Đã cập nhật"); setEditLeader(null); load(); }
            else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setSaving(false) }
    };

    const handleDelete = async () => {
        try {
            const r = await fetch(`/api/app-auth/data?table=teaching_leaders&code=${confirmDlg.code}`, { method: 'DELETE', headers: authHeaders(token) });
            const d = await r.json();
            if (d.success) { toast.success("Đã xóa"); load(); } else toast.error(d.error || "Lỗi");
        } catch { toast.error("Lỗi") } finally { setConfirmDlg({ open: false, code: "", name: "" }) }
    };

    const openNew = () => {
        setIsNew(true);
        setEditLeader({
            code: '',
            full_name: '',
            role_code: '',
            role_name: '',
            center: '',
            courses: '',
            area: '',
            areas: [],
            status: 'Active',
            joined_date: '',
        });
    };
    const openEdit = (l: Leader) => {
        setIsNew(false);
        const areas = getLeaderAreas(l);
        setEditLeader({ ...l, areas, area: areas[0] || l.area || '' });
    };

    const toggleLeaderArea = (a: string) => {
        if (!editLeader) return;
        const cur = editLeader.areas || getLeaderAreas(editLeader);
        const next = cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a];
        setEditLeader({ ...editLeader, areas: next, area: next[0] || '' });
    };

    // Group by area (leader có thể xuất hiện ở nhiều nhóm)
    const areas = [...new Set(filtered.flatMap((l) => getLeaderAreas(l)))].sort();
    const activeCount = data.filter(l => l.status === 'Active').length;
    const deactiveCount = data.filter(l => l.status !== 'Active').length;

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-green-500" /><span className="font-medium">{activeCount} Active</span></div>
                <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-red-400" /><span className="font-medium">{deactiveCount} Deactive</span></div>
                <span className="text-xs text-gray-400">Tổng: {data.length}</span>
            </div>

            {/* Search + Filter bar */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, code, center..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#a1001f]" />
                </div>
                <Button 
                    onClick={() => setShowFilters(!showFilters)}
                    variant={showFilters ? "default" : "outline"}
                    size="sm"
                >
                    <Icon icon={Filter} size="sm" />
                    {(fStatus || fArea || fRole) ? `Lọc (${[fStatus, fArea, fRole].filter(Boolean).length})` : 'Bộ lọc'}
                </Button>
                <Button onClick={openNew} variant="mindx" size="sm">
                    <Icon icon={Plus} size="sm" />
                    Thêm
                </Button>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border flex-wrap">
                    <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#a1001f]">
                        <option value="">Tất cả trạng thái</option>
                        {filters.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={fArea} onChange={e => setFArea(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#a1001f]">
                        <option value="">Tất cả khu vực</option>
                        {filters.areas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select value={fRole} onChange={e => setFRole(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#a1001f]">
                        <option value="">Tất cả role</option>
                        {filters.roleCodes.map(r => <option key={r.role_code} value={r.role_code}>{r.role_code} - {r.role_name}</option>)}
                    </select>
                    {(fStatus || fArea || fRole) && (
                        <Button 
                            onClick={() => { setFStatus(""); setFArea(""); setFRole(""); }} 
                            variant="ghost" 
                            size="xs"
                            className="text-[#a1001f] hover:text-[#a1001f]"
                        >
                            Xóa lọc
                        </Button>
                    )}
                </div>
            )}

            {/* Edit form */}
            {editLeader && (
                <div className="bg-white rounded-xl border-2 border-blue-200 shadow-lg p-5 animate-in slide-in-from-top-2">
                    <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                        {isNew ? <Plus className="h-5 w-5 text-blue-600" /> : <Edit2 className="h-5 w-5 text-blue-600" />}
                        {isNew ? "Thêm Teaching Leader" : "Chỉnh sửa: " + editLeader.full_name}
                    </h3>
                    <form onSubmit={handleSave} className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Code</label>
                                <input value={editLeader.code} onChange={e => setEditLeader({ ...editLeader, code: e.target.value })} required disabled={!isNew}
                                    className="w-full border rounded-lg px-3 py-1.5 text-sm disabled:bg-gray-100 focus:outline-none focus:border-blue-500" /></div>
                            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Họ tên</label>
                                <input value={editLeader.full_name} onChange={e => setEditLeader({ ...editLeader, full_name: e.target.value })} required
                                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" /></div>
                            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Role Code</label>
                                <select value={editLeader.role_code} onChange={e => { const rc = filters.roleCodes.find(r => r.role_code === e.target.value); setEditLeader({ ...editLeader, role_code: e.target.value, role_name: rc?.role_name || '' }); }}
                                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                                    <option value="">Chọn role</option>
                                    {filters.roleCodes.map(r => <option key={r.role_code} value={r.role_code}>{r.role_code} - {r.role_name}</option>)}
                                </select></div>
                            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Center</label>
                                <input value={editLeader.center} onChange={e => setEditLeader({ ...editLeader, center: e.target.value })} required
                                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" /></div>
                            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Courses</label>
                                <input value={editLeader.courses || ''} onChange={e => setEditLeader({ ...editLeader, courses: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500" /></div>
                            <div className="md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Khu vực * <span className="font-normal text-gray-500">(nhiều)</span></label>
                                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto rounded-lg border p-2 bg-gray-50">
                                    {filters.areas.length === 0 ? (
                                        <span className="text-xs text-gray-500">Chưa có khu vực.</span>
                                    ) : (
                                        filters.areas.map((a) => {
                                            const checked = (editLeader.areas || getLeaderAreas(editLeader)).includes(a);
                                            return (
                                                <label key={a} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer ${checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                                                    <input type="checkbox" checked={checked} onChange={() => toggleLeaderArea(a)} className="rounded" />
                                                    {a}
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                                <select value={editLeader.status} onChange={e => setEditLeader({ ...editLeader, status: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                                    <option value="Active">Active</option><option value="Deactive">Deactive</option></select></div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" onClick={() => setEditLeader(null)} variant="outline">
                                Hủy
                            </Button>
                            <Button type="submit" disabled={saving} loading={saving} variant="default">
                                <Icon icon={Save} size="sm" />
                                {isNew ? "Thêm" : "Lưu"}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* List grouped by area */}
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" /></div>
            ) : (
                <div className="space-y-4">
                    {areas.map(area => {
                        const areaLeaders = filtered.filter((l) => getLeaderAreas(l).includes(area));
                        return (
                            <div key={area} className="bg-white rounded-xl border shadow overflow-hidden">
                                <div className="px-4 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#a1001f]" />
                                        <span className="text-sm font-bold text-gray-900">{area}</span>
                                        <span className="text-xs text-gray-400">({areaLeaders.length})</span></div>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {areaLeaders.map(l => (
                                        <div key={l.code} className={`px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${l.status !== 'Active' ? 'opacity-60' : ''}`}>
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${l.status === 'Active' ? 'bg-gradient-to-br from-[#a1001f] to-[#c41230]' : 'bg-gray-400'}`}>
                                                {l.full_name.charAt(0)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-semibold text-gray-900">{l.full_name}</span>
                                                    <span className="text-xs text-gray-400">({l.code})</span>
                                                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">{l.role_code}</span>
                                                    {l.courses && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600">{l.courses}</span>}
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">{l.center}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <Button 
                                                    onClick={() => askToggleStatus(l)} 
                                                    title={l.status === 'Active' ? 'Tắt' : 'Bật'}
                                                    variant={l.status === 'Active' ? 'success' : 'destructive'}
                                                    size="xs"
                                                    className="rounded-full"
                                                >
                                                    {l.status}
                                                </Button>
                                                <Button 
                                                    onClick={() => openEdit(l)} 
                                                    variant="ghost" 
                                                    size="icon-sm"
                                                    title="Sửa"
                                                >
                                                    <Icon icon={Edit2} size="sm" className="text-gray-400 hover:text-blue-600" />
                                                </Button>
                                                <Button 
                                                    onClick={() => setConfirmDlg({ open: true, code: l.code, name: l.full_name })} 
                                                    variant="ghost" 
                                                    size="icon-sm"
                                                    title="Xóa"
                                                >
                                                    <Icon icon={Trash2} size="sm" className="text-gray-400 hover:text-red-600" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && <div className="text-center py-12 text-gray-500">Không có dữ liệu</div>}
                </div>
            )}

            <ConfirmDialog open={confirmDlg.open} title="Xóa Teaching Leader" variant="danger"
                message={`Xóa "${confirmDlg.name}" (${confirmDlg.code})? Hành động này không thể hoàn tác.`}
                confirmText="Xóa" onConfirm={handleDelete} onCancel={() => setConfirmDlg({ open: false, code: "", name: "" })} />

            <ConfirmDialog open={statusDlg.open} title="Đổi trạng thái" variant={statusDlg.newStatus === 'Deactive' ? 'danger' : 'warning'}
                message={`Chuyển "${statusDlg.leader?.full_name}" sang ${statusDlg.newStatus}?`}
                confirmText={statusDlg.newStatus === 'Deactive' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                onConfirm={doToggleStatus} onCancel={() => setStatusDlg({ open: false, leader: null, newStatus: '' })} />
        </div>
    );
}
