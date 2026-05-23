"use client";
import { useAuth } from "@/lib/auth-context";
import { Database, LayoutGrid, Settings, Shield, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import DataTab from "./components/DataTab";
import RoleSettingsTab from "./components/RoleSettingsTab";
import ScreensTab from "./components/ScreensTab";
import UsersTab from "./components/UsersTab";

type Tab = 'users' | 'roles' | 'screens' | 'data';

export default function UserManagementPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('users');

    if (user?.role !== 'super_admin') {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-700 mb-2">Không có quyền truy cập</h2>
                    <p className="text-gray-500">Chỉ Super Admin mới có thể quản lý tài khoản.</p>
                </div>
            </div>
        );
    }

    const tabs: {
        key: Tab;
        label: string;
        description: string;
        icon: React.ReactNode;
    }[] = [
        {
            key: 'users',
            label: 'Quản lý tài khoản',
            description: 'Tạo, tìm, gán role và cơ sở cho tài khoản.',
            icon: <Users className="h-4 w-4" />,
        },
        {
            key: 'roles',
            label: 'Cài đặt Role',
            description: 'Phân quyền màn hình theo từng role.',
            icon: <Settings className="h-4 w-4" />,
        },
        {
            key: 'screens',
            label: 'Cài đặt màn hình',
            description: 'CRUD danh mục màn hình và trạng thái hiển thị.',
            icon: <LayoutGrid className="h-4 w-4" />,
        },
        {
            key: 'data',
            label: 'Dữ liệu tham chiếu',
            description: 'Centers, leaders và dữ liệu nền cho hệ thống.',
            icon: <Database className="h-4 w-4" />,
        },
    ];

    const activeTab = tabs.find((item) => item.key === tab) ?? tabs[0];

    return (
        <div className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-white pb-10">
            <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8">
                <header className="mb-5 sm:mb-6">
                    <h1 className="flex items-start gap-2 text-xl font-bold tracking-tight text-gray-900 sm:items-center sm:text-3xl">
                        <ShieldCheck className="h-8 w-8 shrink-0 text-[#a1001f]" />
                        Quản lý tài khoản & phân quyền
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 sm:text-[15px]">
                        Tạo và gán tài khoản, cấu hình role/màn hình, quản lý dữ liệu centers & teaching leaders (một leader có thể phụ trách nhiều khu vực).
                    </p>
                </header>

                <div className="mb-5 space-y-3 sm:hidden">
                    <div className="rounded-2xl bg-gradient-to-br from-[#7f0019] via-[#a1001f] to-[#c41230] p-4 text-white shadow-lg">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                            {activeTab.icon}
                            Khu vực đang mở
                        </div>
                        <h2 className="mt-2 text-lg font-semibold leading-tight">
                            {activeTab.label}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-white/85">
                            {activeTab.description}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {tabs.map((item) => {
                            const isActive = tab === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setTab(item.key)}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`rounded-2xl border p-3 text-left shadow-sm transition-all ${
                                        isActive
                                            ? 'border-[#a1001f] bg-[#a1001f]/5 ring-1 ring-[#a1001f]/15'
                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                                isActive
                                                    ? 'bg-[#a1001f] text-white'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}
                                        >
                                            {item.icon}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold leading-5 text-gray-900">
                                                {item.label}
                                            </span>
                                            <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                                                {item.description}
                                            </span>
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <nav className="mb-5 hidden overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:mb-6 sm:flex sm:flex-wrap sm:overflow-visible" aria-label="Phân khu tab">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`flex min-w-max flex-none items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:flex-1 sm:min-w-[140px] sm:justify-start ${
                                tab === t.key
                                    ? 'bg-[#a1001f] text-white shadow'
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    ))}
                </nav>

                <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-6">
                    {tab === 'users' && <UsersTab />}
                    {tab === 'roles' && <RoleSettingsTab />}
                    {tab === 'screens' && <ScreensTab />}
                    {tab === 'data' && <DataTab />}
                </section>
            </div>
        </div>
    );
}
