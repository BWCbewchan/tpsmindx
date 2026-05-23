"use client";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { DEFAULT_SCREEN_CATALOG, type ScreenCatalogItem } from "@/lib/default-screen-catalog";
import { ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function PermSelector({ perms, setPerms }: { perms: string[]; setPerms: (v: string[]) => void }) {
    const { token } = useAuth();
    const [screens, setScreens] = useState<ScreenCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        let cancelled = false;

        const loadScreens = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/app-auth/screens?includeInactive=true', {
                    headers: authHeaders(token),
                });
                const data = await res.json();
                const nextScreens = Array.isArray(data.screens) && data.screens.length > 0 ? data.screens : DEFAULT_SCREEN_CATALOG;
                if (!cancelled) {
                    setScreens(nextScreens);
                }
            } catch {
                if (!cancelled) {
                    setScreens(DEFAULT_SCREEN_CATALOG);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadScreens();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const groups = useMemo(() => {
        const byGroup = new Map<string, ScreenCatalogItem[]>();
        for (const screen of screens) {
            const next = byGroup.get(screen.group_name) || [];
            next.push(screen);
            byGroup.set(screen.group_name, next);
        }

        return Array.from(byGroup.entries())
            .map(([groupName, items]) => ({
                groupName,
                items: items.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
                order: Math.min(...items.map((item) => item.sort_order)),
            }))
            .sort((a, b) => a.order - b.order || a.groupName.localeCompare(b.groupName));
    }, [screens]);

    useEffect(() => {
        if (expanded.length === 0 && groups.length > 0) {
            setExpanded(groups.map((group) => group.groupName));
        }
    }, [expanded.length, groups]);

    const visibleGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return groups;

        return groups
            .map((group) => ({
                ...group,
                items: group.items.filter((item) =>
                    item.label.toLowerCase().includes(q) ||
                    item.route_path.toLowerCase().includes(q) ||
                    item.group_name.toLowerCase().includes(q) ||
                    (item.description || '').toLowerCase().includes(q),
                ),
            }))
            .filter((group) => group.items.length > 0);
    }, [groups, search]);

    const toggleGroup = (groupName: string) => {
        setExpanded((current) => (current.includes(groupName) ? current.filter((item) => item !== groupName) : [...current, groupName]));
    };

    const togglePerm = (path: string) => setPerms(perms.includes(path) ? perms.filter((item) => item !== path) : [...perms, path]);

    const toggleAllGroup = (groupName: string) => {
        const groupPaths = screens.filter((screen) => screen.group_name === groupName).map((screen) => screen.route_path);
        const allSelected = groupPaths.every((path) => perms.includes(path));
        setPerms(allSelected ? perms.filter((path) => !groupPaths.includes(path)) : [...new Set([...perms, ...groupPaths])]);
    };

    const selectAll = () => setPerms(perms.length === screens.length ? [] : screens.map((screen) => screen.route_path));

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm màn hình, đường dẫn, nhóm..."
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/80 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/15"
                    />
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <button type="button" onClick={selectAll} className="text-xs font-medium text-[#a1001f] hover:underline">
                        {perms.length === screens.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                    <span className="text-xs text-gray-500">{perms.length}/{screens.length}</span>
                </div>
            </div>

            {loading && screens.length === 0 ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#a1001f]" />
                </div>
            ) : null}

            <div className="space-y-2">
                {visibleGroups.map(({ groupName, items }) => {
                    const groupPaths = items.map((item) => item.route_path);
                    const selectedCount = items.filter((item) => perms.includes(item.route_path)).length;
                    const expandedGroup = expanded.includes(groupName);

                    return (
                        <div key={groupName} className="overflow-hidden rounded-lg border border-gray-200">
                            <button
                                type="button"
                                onClick={() => toggleGroup(groupName)}
                                className="flex w-full items-center justify-between bg-gray-50 px-3 py-2 transition-colors hover:bg-gray-100"
                            >
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={groupPaths.length > 0 && groupPaths.every((path) => perms.includes(path))}
                                        onChange={() => toggleAllGroup(groupName)}
                                        onClick={(event) => event.stopPropagation()}
                                        className="rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]"
                                    />
                                    <span className="text-xs font-bold text-gray-700">{groupName}</span>
                                    <span className="text-xs text-gray-400">({selectedCount}/{items.length})</span>
                                </div>
                                {expandedGroup ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                            </button>

                            {expandedGroup && (
                                <div className="space-y-1 px-3 py-2">
                                    {items.map((item) => (
                                        <label
                                            key={`${item.route_path}-${item.label}`}
                                            className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-gray-50 ${item.is_active ? '' : 'opacity-70'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={perms.includes(item.route_path)}
                                                onChange={() => togglePerm(item.route_path)}
                                                className="rounded border-gray-300 text-[#a1001f] focus:ring-[#a1001f]"
                                            />
                                            <span className="text-xs text-gray-700">{item.label}</span>
                                            <span className="text-xs text-gray-400 ml-auto">{item.route_path}</span>
                                            {!item.is_active && (
                                                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                                                    Ẩn
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {!loading && visibleGroups.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        Không tìm thấy màn hình phù hợp.
                    </div>
                )}
            </div>
        </div>
    );
}
