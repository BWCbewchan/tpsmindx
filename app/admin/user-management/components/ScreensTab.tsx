"use client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/app-toast";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import {
    BadgeInfo,
    EyeOff,
    LayoutGrid,
    Loader2,
    Pencil,
    Plus,
    RefreshCcw,
    Save,
    Search,
    Table2,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface ScreenRow {
    id: number;
    route_path: string;
    label: string;
    group_name: string;
    sort_order: number;
    is_active: boolean;
    description: string;
    created_at: string;
    updated_at: string;
}

interface ScreenFormState {
    id: number | null;
    routePath: string;
    label: string;
    groupName: string;
    sortOrder: string;
    description: string;
    isActive: boolean;
}

const emptyForm = (): ScreenFormState => ({
    id: null,
    routePath: '',
    label: '',
    groupName: '',
    sortOrder: '0',
    description: '',
    isActive: true,
});

const DISPLAY_MODE_STORAGE_KEY = 'user-management-screens-display-mode';

export default function ScreensTab() {
    const { token } = useAuth();
    const [screens, setScreens] = useState<ScreenRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [groupFilter, setGroupFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table');
    const [showForm, setShowForm] = useState(false);
    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [form, setForm] = useState<ScreenFormState>(emptyForm());
    const [confirmHide, setConfirmHide] = useState<{ open: boolean; screen: ScreenRow | null }>({
        open: false,
        screen: null,
    });

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (showForm) closeForm();
            if (confirmHide.open) setConfirmHide({ open: false, screen: null });
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [confirmHide.open, showForm]);

    useEffect(() => {
        loadScreens();
    }, []);

    useEffect(() => {
        const savedMode = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
        if (savedMode === 'cards' || savedMode === 'table') {
            setDisplayMode(savedMode);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode);
    }, [displayMode]);

    const loadScreens = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/app-auth/screens?includeInactive=true', { headers: authHeaders(token) });
            const data = await res.json();
            if (data.screens) {
                setScreens(data.screens);
            } else {
                throw new Error(data.error || 'Không tải được danh mục màn hình');
            }
        } catch (error) {
            console.error(error);
            toast.error('Lỗi tải danh mục màn hình');
        } finally {
            setLoading(false);
        }
    };

    const groups = useMemo(() => {
        const map = new Map<string, { order: number; total: number; active: number }>();
        for (const screen of screens) {
            const current = map.get(screen.group_name);
            if (!current) {
                map.set(screen.group_name, {
                    order: screen.sort_order,
                    total: 1,
                    active: screen.is_active ? 1 : 0,
                });
                continue;
            }
            current.total += 1;
            current.active += screen.is_active ? 1 : 0;
            current.order = Math.min(current.order, screen.sort_order);
        }

        return Array.from(map.entries())
            .map(([group_name, meta]) => ({ group_name, ...meta }))
            .sort((a, b) => a.order - b.order || a.group_name.localeCompare(b.group_name));
    }, [screens]);

    const filteredScreens = useMemo(() => {
        const q = search.trim().toLowerCase();
        return screens.filter((screen) => {
            const groupAllowed = groupFilter === 'all' || screen.group_name === groupFilter;
            const statusAllowed =
                statusFilter === 'all' ||
                (statusFilter === 'active' ? screen.is_active : !screen.is_active);
            const searchAllowed =
                !q ||
                screen.label.toLowerCase().includes(q) ||
                screen.route_path.toLowerCase().includes(q) ||
                screen.group_name.toLowerCase().includes(q) ||
                (screen.description || '').toLowerCase().includes(q);

            return groupAllowed && statusAllowed && searchAllowed;
        });
    }, [groupFilter, screens, search, statusFilter]);

    const groupedScreens = useMemo(() => {
        const map = new Map<string, ScreenRow[]>();
        for (const screen of filteredScreens) {
            const current = map.get(screen.group_name) || [];
            current.push(screen);
            map.set(screen.group_name, current);
        }

        return Array.from(map.entries())
            .map(([group_name, items]) => ({
                group_name,
                items: items.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
                order: Math.min(...items.map((item) => item.sort_order)),
            }))
            .sort((a, b) => a.order - b.order || a.group_name.localeCompare(b.group_name));
    }, [filteredScreens]);

    const totalCount = screens.length;
    const activeCount = screens.filter((screen) => screen.is_active).length;
    const hiddenCount = totalCount - activeCount;

    const closeForm = () => {
        setShowForm(false);
        setForm(emptyForm());
        setMode('create');
    };

    const openCreate = () => {
        setMode('create');
        setForm(emptyForm());
        setShowForm(true);
    };

    const openEdit = (screen: ScreenRow) => {
        setMode('edit');
        setForm({
            id: screen.id,
            routePath: screen.route_path,
            label: screen.label,
            groupName: screen.group_name,
            sortOrder: String(screen.sort_order),
            description: screen.description || '',
            isActive: screen.is_active,
        });
        setShowForm(true);
    };

    const saveScreen = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.routePath.trim() || !form.label.trim() || !form.groupName.trim()) {
            toast.error('Điền đầy đủ đường dẫn, tên và nhóm màn hình');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                routePath: form.routePath,
                label: form.label,
                groupName: form.groupName,
                sortOrder: Number(form.sortOrder || 0),
                description: form.description,
                isActive: form.isActive,
            };

            const res = await fetch('/api/app-auth/screens', {
                method: mode === 'create' ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify(mode === 'create' ? payload : { ...payload, id: form.id }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success(mode === 'create' ? 'Đã tạo màn hình mới' : 'Đã cập nhật màn hình');
                closeForm();
                loadScreens();
            } else {
                toast.error(data.error || 'Lỗi lưu màn hình');
            }
        } catch (error) {
            console.error(error);
            toast.error('Lỗi kết nối');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (screen: ScreenRow) => {
        setSaving(true);
        try {
            const res = await fetch('/api/app-auth/screens', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ id: screen.id, isActive: !screen.is_active }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(screen.is_active ? 'Đã ẩn màn hình' : 'Đã khôi phục màn hình');
                loadScreens();
            } else {
                toast.error(data.error || 'Không thể cập nhật trạng thái');
            }
        } catch (error) {
            console.error(error);
            toast.error('Lỗi kết nối');
        } finally {
            setSaving(false);
        }
    };

    const hideScreen = async () => {
        if (!confirmHide.screen) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/app-auth/screens?id=${confirmHide.screen.id}`, {
                method: 'DELETE',
                headers: authHeaders(token),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Đã ẩn màn hình');
                setConfirmHide({ open: false, screen: null });
                loadScreens();
            } else {
                toast.error(data.error || 'Không thể ẩn màn hình');
            }
        } catch (error) {
            console.error(error);
            toast.error('Lỗi kết nối');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gradient-to-r from-slate-50 via-white to-red-50 p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#a1001f]">
                        <LayoutGrid className="h-4 w-4" />
                        Cài đặt màn hình
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Quản lý danh mục màn hình được dùng trong quyền role</h3>
                    <p className="max-w-3xl text-sm text-gray-600">
                        Tạo, chỉnh sửa và ẩn màn hình. Khi đổi đường dẫn, hệ thống sẽ đồng bộ lại dữ liệu quyền màn hình của role và user.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#a1001f] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#c41230]"
                >
                    <Plus className="h-4 w-4" />
                    Thêm màn hình
                </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Tổng màn hình</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{totalCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">Đang hiển thị</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-800">{activeCount}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Đã ẩn</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{hiddenCount}</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50/70 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-red-700">Nhóm</p>
                    <p className="mt-2 text-2xl font-bold text-red-800">{groups.length}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full lg:max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm theo tên, đường dẫn, nhóm..."
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/15"
                        />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <select
                            value={groupFilter}
                            onChange={(e) => setGroupFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15 sm:w-auto"
                        >
                            <option value="all">Tất cả nhóm</option>
                            {groups.map((group) => (
                                <option key={group.group_name} value={group.group_name}>
                                    {group.group_name}
                                </option>
                            ))}
                        </select>

                        <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white lg:flex">
                            {[
                                { key: 'table', label: 'Bảng', icon: Table2 },
                                { key: 'cards', label: 'Thẻ', icon: LayoutGrid },
                            ].map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        aria-pressed={displayMode === option.key}
                                        onClick={() => setDisplayMode(option.key as 'table' | 'cards')}
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                                            displayMode === option.key
                                                ? 'bg-[#a1001f] text-white'
                                                : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
                            {[
                                { key: 'all', label: 'Tất cả' },
                                { key: 'active', label: 'Đang hiện' },
                                { key: 'inactive', label: 'Đã ẩn' },
                            ].map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setStatusFilter(option.key as 'all' | 'active' | 'inactive')}
                                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors sm:flex-none ${
                                        statusFilter === option.key
                                            ? 'bg-[#a1001f] text-white'
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    <span>{filteredScreens.length} màn hình khớp bộ lọc</span>
                    <button
                        type="button"
                        onClick={() => {
                            setSearch('');
                            setGroupFilter('all');
                            setStatusFilter('all');
                        }}
                        className="font-medium text-[#a1001f] hover:underline"
                    >
                        Xóa bộ lọc
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-[#a1001f]" />
                    </div>
                ) : groupedScreens.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center">
                        <BadgeInfo className="h-12 w-12 text-gray-300" />
                        <h4 className="mt-4 text-base font-semibold text-gray-900">Không tìm thấy màn hình</h4>
                        <p className="mt-1 text-sm text-gray-500">Thử xóa bộ lọc hoặc tạo thêm một màn hình mới.</p>
                    </div>
                ) : (
                    <div className="mt-5 space-y-5">
                        {groupedScreens.map((group) => (
                            <section key={group.group_name} className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-4 shadow-sm">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900">{group.group_name}</h4>
                                        <p className="text-xs text-gray-500">
                                            {group.items.length} màn hình trong nhóm này
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                        <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700 shadow-sm">{group.items.filter((item) => item.is_active).length} hiện</span>
                                        <span className="rounded-full bg-white px-2.5 py-1 font-medium text-gray-700 shadow-sm">{group.items.filter((item) => !item.is_active).length} ẩn</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:hidden xl:grid-cols-2">
                                    {group.items.map((screen) => (
                                        <article
                                            key={screen.id}
                                            className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${screen.is_active ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50'}`}
                                        >
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h5 className="truncate text-sm font-bold text-gray-900">{screen.label}</h5>
                                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${screen.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {screen.is_active ? 'Đang hiện' : 'Đã ẩn'}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 break-all text-xs text-gray-500">{screen.route_path}</p>
                                                </div>
                                                <div className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                                    #{screen.sort_order}
                                                </div>
                                            </div>

                                            {screen.description ? (
                                                <p className="mt-3 text-sm leading-6 text-gray-600">{screen.description}</p>
                                            ) : (
                                                <p className="mt-3 text-sm italic text-gray-400">Chưa có mô tả.</p>
                                            )}

                                            <div className="mt-4 flex flex-wrap items-stretch gap-2 sm:items-center">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(screen)}
                                                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 sm:flex-none"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Sửa
                                                </button>
                                                {screen.is_active ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmHide({ open: true, screen })}
                                                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 sm:flex-none"
                                                    >
                                                        <EyeOff className="h-4 w-4" />
                                                        Ẩn
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleActive(screen)}
                                                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 sm:flex-none"
                                                    >
                                                        <RefreshCcw className="h-4 w-4" />
                                                        Khôi phục
                                                    </button>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>

                                {displayMode === 'table' ? (
                                    <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white md:block">
                                        <Table className="min-w-[980px]">
                                            <TableHeader>
                                                <TableRow className="bg-gray-50 hover:bg-gray-50">
                                                    <TableHead className="whitespace-nowrap">Màn hình</TableHead>
                                                    <TableHead className="whitespace-nowrap">Đường dẫn</TableHead>
                                                    <TableHead className="whitespace-nowrap">Thứ tự</TableHead>
                                                    <TableHead className="whitespace-nowrap">Trạng thái</TableHead>
                                                    <TableHead className="whitespace-nowrap">Mô tả</TableHead>
                                                    <TableHead className="whitespace-nowrap text-right">Thao tác</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {group.items.map((screen) => (
                                                    <TableRow
                                                        key={screen.id}
                                                        className={!screen.is_active ? 'bg-gray-50/60' : undefined}
                                                    >
                                                        <TableCell className="align-top">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-semibold text-gray-900">
                                                                        {screen.label}
                                                                    </span>
                                                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${screen.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                        {screen.is_active ? 'Hiện' : 'Ẩn'}
                                                                    </span>
                                                                </div>
                                                                <p className="break-all text-xs text-gray-500">
                                                                    {screen.route_path}
                                                                </p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="align-top text-sm text-gray-600">
                                                            {screen.route_path}
                                                        </TableCell>
                                                        <TableCell className="align-top">
                                                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                                                #{screen.sort_order}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="align-top">
                                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${screen.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                {screen.is_active ? 'Đang hiện' : 'Đã ẩn'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="align-top text-sm text-gray-600">
                                                            {screen.description ? screen.description : <span className="italic text-gray-400">Chưa có mô tả.</span>}
                                                        </TableCell>
                                                        <TableCell className="align-top">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEdit(screen)}
                                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50"
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                    Sửa
                                                                </button>
                                                                {screen.is_active ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setConfirmHide({ open: true, screen })}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50"
                                                                    >
                                                                        <EyeOff className="h-4 w-4" />
                                                                        Ẩn
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleActive(screen)}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                                                                    >
                                                                        <RefreshCcw className="h-4 w-4" />
                                                                        Khôi phục
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="hidden md:block">
                                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                            {group.items.map((screen) => (
                                                <article
                                                    key={screen.id}
                                                    className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${screen.is_active ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50'}`}
                                                >
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h5 className="truncate text-sm font-bold text-gray-900">{screen.label}</h5>
                                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${screen.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {screen.is_active ? 'Đang hiện' : 'Đã ẩn'}
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 break-all text-xs text-gray-500">{screen.route_path}</p>
                                                        </div>
                                                        <div className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                                                            #{screen.sort_order}
                                                        </div>
                                                    </div>

                                                    {screen.description ? (
                                                        <p className="mt-3 text-sm leading-6 text-gray-600">{screen.description}</p>
                                                    ) : (
                                                        <p className="mt-3 text-sm italic text-gray-400">Chưa có mô tả.</p>
                                                    )}

                                                    <div className="mt-4 flex flex-wrap items-stretch gap-2 sm:items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(screen)}
                                                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 sm:flex-none"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Sửa
                                                        </button>
                                                        {screen.is_active ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmHide({ open: true, screen })}
                                                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 sm:flex-none"
                                                            >
                                                                <EyeOff className="h-4 w-4" />
                                                                Ẩn
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleActive(screen)}
                                                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 sm:flex-none"
                                                            >
                                                                <RefreshCcw className="h-4 w-4" />
                                                                Khôi phục
                                                            </button>
                                                        )}
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="screen-form-title"
                        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                            <div>
                                <h3 id="screen-form-title" className="text-lg font-bold text-gray-900">
                                    {mode === 'create' ? 'Thêm màn hình mới' : 'Sửa màn hình'}
                                </h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Đổi đường dẫn sẽ tự đồng bộ lại quyền role và user.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeForm}
                                className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                                aria-label="Đóng form màn hình"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={saveScreen} className="space-y-5 px-6 py-5">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-700">Đường dẫn màn hình</label>
                                    <input
                                        value={form.routePath}
                                        onChange={(e) => setForm((prev) => ({ ...prev, routePath: e.target.value }))}
                                        placeholder="/admin/example"
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Tên hiển thị</label>
                                    <input
                                        value={form.label}
                                        onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                                        placeholder="Ví dụ: Dashboard"
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Nhóm màn hình</label>
                                    <input
                                        value={form.groupName}
                                        onChange={(e) => setForm((prev) => ({ ...prev, groupName: e.target.value }))}
                                        placeholder="Ví dụ: Hệ thống"
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Thứ tự</label>
                                    <input
                                        type="number"
                                        value={form.sortOrder}
                                        onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
                                    />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-700">Mô tả</label>
                                    <textarea
                                        rows={3}
                                        value={form.description}
                                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                        placeholder="Mô tả ngắn về màn hình này"
                                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15"
                                    />
                                </div>
                                <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 md:col-span-2">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                                        className="h-4 w-4 rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]"
                                    />
                                    Màn hình đang hiển thị
                                </label>
                            </div>

                            <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#a1001f] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#c41230] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {mode === 'create' ? 'Thêm màn hình' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={confirmHide.open}
                title="Ẩn màn hình"
                message={`Bạn chắc chắn muốn ẩn màn hình "${confirmHide.screen?.label || ''}"? Màn hình vẫn được giữ trong danh mục để có thể khôi phục sau này.`}
                confirmText="Ẩn màn hình"
                onConfirm={hideScreen}
                onCancel={() => setConfirmHide({ open: false, screen: null })}
                variant="warning"
            />
        </div>
    );
}
