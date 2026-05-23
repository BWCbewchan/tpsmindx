'use client';

import { PageContainer } from '@/components/PageContainer';
import { toast } from '@/lib/app-toast';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { AlertCircle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Columns, Copy, Database, Download, Eye, Hash, Key, Link2, Play, Plus, RefreshCw, Search, Terminal, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface TableInfo { name: string; size: string; column_count: number; row_count: number; }
interface ColumnInfo { column_name: string; data_type: string; is_nullable: string; column_default: string | null; character_maximum_length: number | null; }
interface IndexInfo { indexname: string; indexdef: string; }
interface MigrationInfo { id: number; name: string; version: number; applied_at: string; }
interface ForeignKeyInfo { column_name: string; foreign_table: string; foreign_column: string; }

type DatabaseCellValue = string | number | boolean | null;
type DatabaseRow = Record<string, DatabaseCellValue>;

interface DatabaseOverviewResponse { tables?: TableInfo[]; migrationHistory?: MigrationInfo[]; totalMigrations?: number; appliedMigrations?: number; dbSize?: string; error?: string; }
interface DatabaseColumnsResponse { columns?: ColumnInfo[]; indexes?: IndexInfo[]; primaryKeys?: string[]; foreignKeys?: ForeignKeyInfo[]; error?: string; }
interface DatabasePreviewResponse { rows?: DatabaseRow[]; total?: number; error?: string; }
interface DatabaseQueryResponse { error?: string; detail?: string; code?: string | number; command?: string; rowCount?: number; rows?: DatabaseRow[]; duration?: number; }
interface DatabaseMutationResponse { success?: boolean; error?: string; detail?: string; code?: string | number; applied?: unknown[]; errors?: string[]; }

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const parseJson = async <T,>(response: Response): Promise<T> => (await response.json()) as T;

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string') return message;
    }
    return 'Đã xảy ra lỗi';
};

export default function DatabasePage() {
    const { token } = useAuth();
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [dbSize, setDbSize] = useState('');
    const [migrationHistory, setMigrationHistory] = useState<MigrationInfo[]>([]);
    const [totalMigrations, setTotalMigrations] = useState(0);
    const [appliedMigrations, setAppliedMigrations] = useState(0);

    // Table detail
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [columns, setColumns] = useState<ColumnInfo[]>([]);
    const [indexes, setIndexes] = useState<IndexInfo[]>([]);
    const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
    const [foreignKeys, setForeignKeys] = useState<ForeignKeyInfo[]>([]);

    // Data view
    const [previewData, setPreviewData] = useState<DatabaseRow[]>([]);
    const [previewTotal, setPreviewTotal] = useState(0);
    const [dataPage, setDataPage] = useState(0);
    const [dataSearch, setDataSearch] = useState('');
    const [sortCol, setSortCol] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const PAGE_SIZE = 50;

    // SQL Editor
    const [sqlQuery, setSqlQuery] = useState('');
    const [sqlResult, setSqlResult] = useState<DatabaseQueryResponse | null>(null);
    const [sqlRunning, setSqlRunning] = useState(false);
    const [sqlHistory, setSqlHistory] = useState<string[]>([]);

    // UI state
    const [loading, setLoading] = useState(true);
    const [migrating, setMigrating] = useState(false);
    const [activeTab, setActiveTab] = useState<'tables' | 'sql' | 'migrations'>('tables');
    const [detailTab, setDetailTab] = useState<'data' | 'structure'>('data');
    const [searchTerm, setSearchTerm] = useState('');
    const [showInsertModal, setShowInsertModal] = useState(false);
    const [insertData, setInsertData] = useState<Record<string, string>>({});
    const sqlInputRef = useRef<HTMLTextAreaElement>(null);

    const dbAuthHeaders = useCallback((): HeadersInit => ({
        ...authHeaders(token),
    }), [token]);

    // ─── Fetch overview ───────────────────────────────────
    const fetchOverview = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/database?action=overview', {
                headers: dbAuthHeaders(),
            });
            const data = await parseJson<DatabaseOverviewResponse>(res);
            if (data.error) throw new Error(data.error);
            setTables(data.tables || []);
            setMigrationHistory(data.migrationHistory || []);
            setTotalMigrations(data.totalMigrations || 0);
            setAppliedMigrations(data.appliedMigrations || 0);
            setDbSize(data.dbSize || '');
        } catch (err) {
            toast.error('Lỗi tải dữ liệu: ' + getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [dbAuthHeaders]);

    useEffect(() => { fetchOverview(); }, [fetchOverview]);

    // ─── Select table ─────────────────────────────────────
    const selectTable = async (tableName: string) => {
        setSelectedTable(tableName);
        setDataPage(0);
        setDataSearch('');
        setSortCol('');
        setDetailTab('data');
        try {
            const colRes = await fetch(`/api/database?action=columns&table=${tableName}`, {
                headers: dbAuthHeaders(),
            });
            const colData = await parseJson<DatabaseColumnsResponse>(colRes);
            setColumns(colData.columns || []);
            setIndexes(colData.indexes || []);
            setPrimaryKeys(colData.primaryKeys || []);
            setForeignKeys(colData.foreignKeys || []);
            await fetchTableData(tableName, 0, '', '', 'desc');
        } catch (err) { toast.error(getErrorMessage(err)); }
    };

    // ─── Fetch table data with pagination ─────────────────
    const fetchTableData = async (table: string, page: number, search: string, sort: string, order: 'asc' | 'desc') => {
        try {
            const params = new URLSearchParams({
                action: 'preview', table,
                limit: String(PAGE_SIZE),
                offset: String(page * PAGE_SIZE),
                ...(search ? { search } : {}),
                ...(sort ? { sort, order } : {}),
            });
            const res = await fetch(`/api/database?${params}`, {
                headers: dbAuthHeaders(),
            });
            const data = await parseJson<DatabasePreviewResponse>(res);
            setPreviewData(data.rows || []);
            setPreviewTotal(data.total || 0);
        } catch (err) { toast.error(getErrorMessage(err)); }
    };

    // Refetch current table data
    const refetchData = () => {
        if (selectedTable) fetchTableData(selectedTable, dataPage, dataSearch, sortCol, sortOrder);
    };

    // ─── Sort column ──────────────────────────────────────
    const handleSort = (col: string) => {
        const newOrder = sortCol === col && sortOrder === 'desc' ? 'asc' : 'desc';
        setSortCol(col);
        setSortOrder(newOrder);
        if (selectedTable) fetchTableData(selectedTable, 0, dataSearch, col, newOrder);
        setDataPage(0);
    };

    // ─── Search data ──────────────────────────────────────
    const handleDataSearch = (val: string) => {
        setDataSearch(val);
        setDataPage(0);
        if (selectedTable) fetchTableData(selectedTable, 0, val, sortCol, sortOrder);
    };

    // ─── Pagination ───────────────────────────────────────
    const goPage = (page: number) => {
        setDataPage(page);
        if (selectedTable) fetchTableData(selectedTable, page, dataSearch, sortCol, sortOrder);
    };

    // ─── Run SQL ──────────────────────────────────────────
    const runSQL = useCallback(async () => {
        if (!sqlQuery.trim()) return;
        setSqlRunning(true);
        try {
            const res = await fetch('/api/database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ action: 'query', sql: sqlQuery }),
            });
            const data = await parseJson<DatabaseQueryResponse>(res);
            if (data.error) {
                setSqlResult({ error: data.error, detail: data.detail, code: data.code });
                toast.error(data.error);
            } else {
                setSqlResult(data);
                toast.success(`✅ ${data.command || 'Query'} — ${data.rowCount ?? data.rows?.length ?? 0} rows (${data.duration}ms)`);
                setSqlHistory(prev => [sqlQuery, ...prev.filter(q => q !== sqlQuery)].slice(0, 20));
                fetchOverview(); // Refresh stats
            }
        } catch (err) {
            const message = getErrorMessage(err);
            setSqlResult({ error: message });
            toast.error(message);
        } finally {
            setSqlRunning(false);
        }
    }, [fetchOverview, sqlQuery, token]);

    // ─── Delete row ───────────────────────────────────────
    const deleteRow = async (row: DatabaseRow) => {
        if (!selectedTable || primaryKeys.length === 0) {
            toast.error('Không thể xoá: table không có primary key');
            return;
        }
        if (!confirm('Bạn chắc chắn muốn xoá row này?')) return;

        const where: Record<string, DatabaseCellValue> = {};
        primaryKeys.forEach(pk => { where[pk] = row[pk]; });

        try {
            const res = await fetch('/api/database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ action: 'deleteRow', table: selectedTable, where }),
            });
            const data = await parseJson<DatabaseMutationResponse>(res);
            if (data.success) {
                toast.success('Đã xoá!');
                refetchData();
                fetchOverview();
            } else {
                toast.error(data.error || 'Lỗi xoá');
            }
        } catch (err) { toast.error(getErrorMessage(err)); }
    };

    // ─── Insert row ───────────────────────────────────────
    const handleInsert = async () => {
        if (!selectedTable) return;
        const cleanData: Record<string, string> = {};
        Object.entries(insertData).forEach(([k, v]) => {
            if (v !== '') cleanData[k] = v;
        });
        if (Object.keys(cleanData).length === 0) {
            toast.error('Nhập ít nhất 1 field');
            return;
        }
        try {
            const res = await fetch('/api/database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ action: 'insertRow', table: selectedTable, data: cleanData }),
            });
            const data = await parseJson<DatabaseMutationResponse>(res);
            if (data.success) {
                toast.success('Đã thêm row!');
                setShowInsertModal(false);
                setInsertData({});
                refetchData();
                fetchOverview();
            } else {
                toast.error(data.error || 'Lỗi thêm');
            }
        } catch (err) { toast.error(getErrorMessage(err)); }
    };

    // ─── Export ────────────────────────────────────────────
    const exportTable = async (format: 'csv' | 'json') => {
        if (!selectedTable) return;
        try {
            const res = await fetch(`/api/database?action=export&table=${selectedTable}&format=${format}`, {
                headers: dbAuthHeaders(),
            });
            if (format === 'csv') {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${selectedTable}.csv`; a.click();
                URL.revokeObjectURL(url);
            } else {
                const data = await parseJson<{ rows?: DatabaseRow[] }>(res);
                const blob = new Blob([JSON.stringify(data.rows, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${selectedTable}.json`; a.click();
                URL.revokeObjectURL(url);
            }
            toast.success(`Exported ${selectedTable}.${format}`);
        } catch (err) { toast.error(getErrorMessage(err)); }
    };

    // ─── Copy cell ────────────────────────────────────────
    const copyCell = (val: DatabaseCellValue) => {
        navigator.clipboard.writeText(String(val ?? ''));
        toast.success('Copied!', { duration: 1000 });
    };

    // ─── Run migrations ───────────────────────────────────
    const runMigrations = async () => {
        setMigrating(true);
        try {
            const res = await fetch('/api/database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                body: JSON.stringify({ action: 'migrate' }),
            });
            const data = await parseJson<DatabaseMutationResponse>(res);
            if (data.success) {
                const appliedCount = data.applied?.length ?? 0;
                toast.success(appliedCount > 0 ? `✅ Applied ${appliedCount} migration(s)` : 'Database đã cập nhật!');
                fetchOverview();
            } else { toast.error(data.errors?.[0] || 'Error'); }
        } catch (err) { toast.error(getErrorMessage(err)); }
        finally { setMigrating(false); }
    };

    // ─── Keyboard shortcut ────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeTab === 'sql') {
                e.preventDefault();
                runSQL();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [activeTab, runSQL]);

    const filteredTables = tables.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const totalPages = Math.ceil(previewTotal / PAGE_SIZE);
    const firstPreviewRow = previewData[0];
    const sqlRows = sqlResult?.rows ?? [];
    const firstSqlRow = sqlRows[0];

    if (loading) {
        return (
            <PageContainer title="Database Manager" description="Quản lý cơ sở dữ liệu">
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer title="Database Manager" description="SQL Editor · Table Explorer · Data Export">
            {/* ─── Stats Bar ──────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                {[
                    { label: 'Tables', value: tables.length, icon: Database, color: 'text-blue-600' },
                    { label: 'Total Rows', value: tables.reduce((s, t) => s + (t.row_count || 0), 0).toLocaleString('vi-VN'), icon: Hash, color: 'text-purple-600' },
                    { label: 'DB Size', value: dbSize, icon: Database, color: 'text-emerald-600' },
                    { label: 'Migrations', value: `${appliedMigrations}/${totalMigrations}`, icon: CheckCircle, color: 'text-green-600' },
                    { label: 'Pending', value: totalMigrations - appliedMigrations, icon: AlertCircle, color: totalMigrations - appliedMigrations > 0 ? 'text-amber-600' : 'text-gray-400' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 shadow-sm">
                        <div className="flex items-center gap-1.5 text-gray-500 text-[10px] mb-0.5">
                            <s.icon className={`w-3 h-3 ${s.color}`} />
                            {s.label}
                        </div>
                        <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* ─── Action Bar ─────────────────────────────────── */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                    {(['tables', 'sql', 'migrations'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {tab === 'tables' && <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5" /> Tables</span>}
                            {tab === 'sql' && <span className="flex items-center gap-1"><Terminal className="w-3.5 h-3.5" /> SQL Editor</span>}
                            {tab === 'migrations' && <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Migrations</span>}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    {selectedTable && activeTab === 'tables' && (
                        <>
                            <button onClick={() => exportTable('csv')} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 font-medium">
                                <Download className="w-3.5 h-3.5" /> CSV
                            </button>
                            <button onClick={() => exportTable('json')} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-medium">
                                <Download className="w-3.5 h-3.5" /> JSON
                            </button>
                            <button onClick={() => { setInsertData({}); setShowInsertModal(true); }}
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-[#a1001f]/10 text-[#a1001f] hover:bg-[#a1001f]/20 border border-[#a1001f]/20 font-medium">
                                <Plus className="w-3.5 h-3.5" /> Insert
                            </button>
                        </>
                    )}
                    <button onClick={runMigrations} disabled={migrating}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-gradient-to-r from-[#a1001f] to-[#c41230] text-white font-medium shadow-sm disabled:opacity-50">
                        {migrating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Migrate
                    </button>
                    <button onClick={fetchOverview} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* ─── SQL Editor Tab ─────────────────────────────── */}
            {activeTab === 'sql' && (
                <div className="space-y-3 mb-4">
                    <div className="bg-[#1e1e2e] rounded-xl overflow-hidden shadow-lg border border-gray-700">
                        <div className="flex items-center justify-between px-3 py-2 bg-[#181825] border-b border-gray-700">
                            <span className="text-xs text-gray-400 font-mono">SQL Query</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">Ctrl+Enter to run</span>
                                {sqlHistory.length > 0 && (
                                    <select onChange={(e) => setSqlQuery(e.target.value)} value=""
                                        className="text-[10px] bg-gray-700 text-gray-300 rounded px-1.5 py-0.5 border-none outline-none">
                                        <option value="">History ({sqlHistory.length})</option>
                                        {sqlHistory.map((q, i) => (
                                            <option key={i} value={q}>{q.length > 60 ? q.slice(0, 60) + '...' : q}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                        <textarea ref={sqlInputRef} value={sqlQuery} onChange={(e) => setSqlQuery(e.target.value)}
                            placeholder="SELECT * FROM communications LIMIT 10;"
                            className="w-full bg-transparent text-green-400 font-mono text-sm p-3 outline-none resize-none placeholder:text-gray-600"
                            rows={5} spellCheck={false} />
                        <div className="flex items-center justify-between px-3 py-2 bg-[#181825] border-t border-gray-700">
                            <div className="flex gap-1.5">
                                {['SELECT * FROM ', 'INSERT INTO ', 'UPDATE ', 'DELETE FROM ', 'CREATE TABLE IF NOT EXISTS '].map(s => (
                                    <button key={s} onClick={() => setSqlQuery(prev => prev + s)}
                                        className="text-[10px] px-2 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 font-mono">
                                        {s.trim()}
                                    </button>
                                ))}
                            </div>
                            <button onClick={runSQL} disabled={sqlRunning || !sqlQuery.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-semibold disabled:opacity-40 transition-all">
                                {sqlRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                Run
                            </button>
                        </div>
                    </div>

                    {/* SQL Result */}
                    {sqlResult && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {sqlResult.error ? (
                                <div className="p-4 bg-red-50 text-red-700 text-sm font-mono">
                                    <p className="font-bold">❌ Error {sqlResult.code && `[${sqlResult.code}]`}</p>
                                    <p>{sqlResult.error}</p>
                                    {sqlResult.detail && <p className="text-xs mt-1 text-red-500">{sqlResult.detail}</p>}
                                </div>
                            ) : (
                                <>
                                    <div className="px-3 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
                                        <span className="text-xs text-green-700 font-semibold">
                                            ✅ {sqlResult.command} — {sqlResult.rows?.length ?? sqlResult.rowCount ?? 0} rows · {sqlResult.duration}ms
                                        </span>
                                        {firstSqlRow && (
                                            <button onClick={() => {
                                                navigator.clipboard.writeText(JSON.stringify(sqlRows, null, 2));
                                                toast.success('Copied results!');
                                            }} className="text-[10px] text-green-600 hover:underline flex items-center gap-1">
                                                <Copy className="w-3 h-3" /> Copy JSON
                                            </button>
                                        )}
                                    </div>
                                    {firstSqlRow && (
                                        <div className="overflow-x-auto max-h-[400px]">
                                            <Table className="text-xs">
                                                <TableHeader className="bg-gray-50 sticky top-0">
                                                    <TableRow>{Object.keys(firstSqlRow).map(k => (
                                                        <TableHead key={k} className="text-left py-1.5 px-2 text-gray-700 whitespace-nowrap">{k}</TableHead>
                                                    ))}</TableRow>
                                                </TableHeader>
                                                <TableBody>{sqlRows.map((row, i) => (
                                                    <TableRow key={i} className="hover:bg-blue-50/30">
                                                        {Object.values(row).map((val, j) => (
                                                            <TableCell key={j} onClick={() => copyCell(val)} className="py-1.5 px-2 text-gray-700 whitespace-nowrap max-w-[250px] truncate cursor-pointer hover:bg-yellow-50" title="Click to copy">
                                                                {val === null ? <span className="text-gray-400 italic">null</span> : String(val)}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}</TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ─── Migrations Tab ──────────────────────────────── */}
            {activeTab === 'migrations' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                    <div className="p-3 border-b border-gray-100">
                        <h3 className="font-semibold text-sm text-gray-900">Migration History ({migrationHistory.length}/{totalMigrations})</h3>
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
                        {migrationHistory.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">Chưa apply migration nào. Click &quot;Migrate&quot; để bắt đầu.</div>
                        ) : migrationHistory.map((m) => (
                            <div key={m.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 font-mono">{m.name}</p>
                                    <p className="text-xs text-gray-500">v{m.version} · {new Date(m.applied_at).toLocaleString('vi-VN')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Tables Tab ──────────────────────────────────── */}
            {activeTab === 'tables' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                    {/* Left: Table list */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="p-2 border-b border-gray-100">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <input type="text" placeholder="Search tables..." value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#a1001f]/30 focus:border-[#a1001f]" />
                                </div>
                            </div>
                            <div className="max-h-[65vh] overflow-y-auto">
                                {filteredTables.map((table) => (
                                    <button key={table.name} onClick={() => selectTable(table.name)}
                                        className={`w-full flex items-center justify-between px-2.5 py-2 text-left text-xs border-b border-gray-50 transition-all hover:bg-gray-50 ${selectedTable === table.name ? 'bg-red-50/80 border-l-[3px] border-l-[#a1001f]' : ''}`}>
                                        <div className="min-w-0">
                                            <p className={`font-medium truncate ${selectedTable === table.name ? 'text-[#a1001f]' : 'text-gray-900'}`}>{table.name}</p>
                                            <p className="text-[10px] text-gray-400">{table.row_count} rows · {table.column_count} cols · {table.size}</p>
                                        </div>
                                        <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${selectedTable === table.name ? 'text-[#a1001f]' : 'text-gray-300'}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Table detail */}
                    <div className="lg:col-span-3">
                        {selectedTable ? (
                            <div className="space-y-3">
                                {/* Sub tabs */}
                                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg w-fit">
                                    <button onClick={() => setDetailTab('data')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${detailTab === 'data' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                                        <Eye className="w-3.5 h-3.5" /> Data ({previewTotal})
                                    </button>
                                    <button onClick={() => setDetailTab('structure')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${detailTab === 'structure' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                                        <Columns className="w-3.5 h-3.5" /> Structure ({columns.length})
                                    </button>
                                </div>

                                {/* ── Data view ─────────────────────── */}
                                {detailTab === 'data' && (
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                                        {/* Search + pagination bar */}
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                                            <div className="relative flex-1 max-w-xs">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                <input type="text" placeholder="Search data..." value={dataSearch}
                                                    onChange={(e) => handleDataSearch(e.target.value)}
                                                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#a1001f]/30" />
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>{dataPage * PAGE_SIZE + 1}–{Math.min((dataPage + 1) * PAGE_SIZE, previewTotal)} of {previewTotal}</span>
                                                <button onClick={() => goPage(dataPage - 1)} disabled={dataPage === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="font-medium">{dataPage + 1}/{totalPages || 1}</span>
                                                <button onClick={() => goPage(dataPage + 1)} disabled={dataPage >= totalPages - 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Data table */}
                                        <div className="overflow-x-auto max-h-[55vh]">
                                            {firstPreviewRow ? (
                                                <Table className="text-xs">
                                                    <TableHeader className="bg-gray-50 sticky top-0 z-10">
                                                        <TableRow>
                                                            <TableHead className="px-2 py-1.5 text-[10px] w-8">#</TableHead>
                                                            {Object.keys(firstPreviewRow).map((key) => (
                                                                <TableHead key={key} onClick={() => handleSort(key)}
                                                                    className="text-left px-2 py-1.5 text-gray-700 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none">
                                                                    <span className="flex items-center gap-1">
                                                                        {primaryKeys.includes(key) && <Key className="w-3 h-3 text-amber-500" />}
                                                                        {foreignKeys.some(fk => fk.column_name === key) && <Link2 className="w-3 h-3 text-blue-400" />}
                                                                        {key}
                                                                        {sortCol === key && <ChevronDown className={`w-3 h-3 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />}
                                                                    </span>
                                                                </TableHead>
                                                            ))}
                                                            {primaryKeys.length > 0 && <TableHead className="px-2 py-1.5 w-8"></TableHead>}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {previewData.map((row, i) => (
                                                            <TableRow key={i} className="hover:bg-blue-50/20 group">
                                                                <TableCell className="px-2 py-1.5 text-gray-400 text-[10px]">{dataPage * PAGE_SIZE + i + 1}</TableCell>
                                                                {Object.entries(row).map(([, val], j) => (
                                                                    <TableCell key={j} onClick={() => copyCell(val)}
                                                                        className="px-2 py-1.5 whitespace-nowrap max-w-[200px] truncate cursor-pointer hover:bg-yellow-50/50"
                                                                        title={val === null ? 'null' : String(val)}>
                                                                        {val === null
                                                                            ? <span className="text-gray-300 italic text-[10px]">NULL</span>
                                                                            : typeof val === 'boolean'
                                                                                ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{String(val)}</span>
                                                                                : <span className="text-gray-700">{String(val)}</span>
                                                                        }
                                                                    </TableCell>
                                                                ))}
                                                                {primaryKeys.length > 0 && (
                                                                    <TableCell className="px-1 py-1">
                                                                        <button onClick={() => deleteRow(row)}
                                                                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-400 hover:text-red-600 transition-all">
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    </TableCell>
                                                                )}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            ) : (
                                                <div className="p-8 text-center text-gray-400 text-sm">No data</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── Structure view ────────────────── */}
                                {detailTab === 'structure' && (
                                    <div className="space-y-3">
                                        {/* Columns */}
                                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                                <h3 className="text-xs font-bold text-gray-700">Columns ({columns.length})</h3>
                                            </div>
                                            <Table className="text-xs">
                                                <TableHeader className="bg-gray-50/50">
                                                    <TableRow>
                                                        <TableHead className="px-3 py-1.5 text-gray-600">Column</TableHead>
                                                        <TableHead className="px-3 py-1.5 text-gray-600">Type</TableHead>
                                                        <TableHead className="px-3 py-1.5 text-gray-600">Nullable</TableHead>
                                                        <TableHead className="px-3 py-1.5 text-gray-600">Default</TableHead>
                                                        <TableHead className="px-3 py-1.5 text-gray-600">Key</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>{columns.map((col) => {
                                                    const isPK = primaryKeys.includes(col.column_name);
                                                    const fk = foreignKeys.find(f => f.column_name === col.column_name);
                                                    return (
                                                        <TableRow key={col.column_name} className="hover:bg-gray-50">
                                                            <TableCell className="px-3 py-2 font-mono text-xs font-medium text-gray-900">{col.column_name}</TableCell>
                                                            <TableCell className="px-3 py-2 text-blue-600 font-mono text-[11px]">
                                                                {col.data_type}{col.character_maximum_length ? `(${col.character_maximum_length})` : ''}
                                                            </TableCell>
                                                            <TableCell className="px-3 py-2">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${col.is_nullable === 'YES' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                                                    {col.is_nullable === 'YES' ? 'NULLABLE' : 'REQUIRED'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="px-3 py-2 text-gray-500 font-mono text-[10px] max-w-[150px] truncate">{col.column_default || '—'}</TableCell>
                                                            <TableCell className="px-3 py-2">
                                                                {isPK && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold"><Key className="w-2.5 h-2.5" /> PK</span>}
                                                                {fk && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold ml-1"><Link2 className="w-2.5 h-2.5" /> → {fk.foreign_table}</span>}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}</TableBody>
                                            </Table>
                                        </div>

                                        {/* Indexes */}
                                        {indexes.length > 0 && (
                                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                                    <h3 className="text-xs font-bold text-gray-700">Indexes ({indexes.length})</h3>
                                                </div>
                                                <div className="divide-y divide-gray-100">
                                                    {indexes.map((idx) => (
                                                        <div key={idx.indexname} className="px-3 py-2">
                                                            <p className="text-xs font-medium text-gray-900">{idx.indexname}</p>
                                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">{idx.indexdef}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Foreign Keys */}
                                        {foreignKeys.length > 0 && (
                                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                                    <h3 className="text-xs font-bold text-gray-700">Foreign Keys ({foreignKeys.length})</h3>
                                                </div>
                                                <div className="divide-y divide-gray-100">
                                                    {foreignKeys.map((fk, i) => (
                                                        <div key={i} className="px-3 py-2 flex items-center gap-2 text-xs">
                                                            <span className="font-mono font-medium text-gray-900">{fk.column_name}</span>
                                                            <span className="text-gray-400">→</span>
                                                            <button onClick={() => selectTable(fk.foreign_table)}
                                                                className="font-mono text-blue-600 hover:underline">{fk.foreign_table}.{fk.foreign_column}</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                                <Database className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <h3 className="font-semibold text-gray-900 mb-1">Chọn một table</h3>
                                <p className="text-sm text-gray-400">Click vào table bên trái để xem data và structure</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Insert Modal ─────────────────────────────── */}
            {showInsertModal && selectedTable && (
                <div className="cursor-pointer fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowInsertModal(false)}>
                    <div className="cursor-pointer bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <h3 className="font-bold text-sm text-gray-900">Insert into {selectedTable}</h3>
                            <button onClick={() => setShowInsertModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                        </div>
                        <div className=" space-y-2.5">
                            {columns.filter(c => !c.column_default?.includes('nextval') && c.column_name !== 'created_at' && c.column_name !== 'updated_at').map(col => (
                                <div key={col.column_name}>
                                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                                        {col.column_name}
                                        <span className="text-[10px] text-gray-400 ml-1">({col.data_type})</span>
                                        {col.is_nullable === 'NO' && !col.column_default && <span className="text-red-500 ml-0.5">*</span>}
                                    </label>
                                    <input type="text" value={insertData[col.column_name] || ''}
                                        onChange={e => setInsertData(prev => ({ ...prev, [col.column_name]: e.target.value }))}
                                        placeholder={col.column_default || ''}
                                        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#a1001f]/30 focus:border-[#a1001f]" />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
                            <button onClick={() => setShowInsertModal(false)} className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                            <button onClick={handleInsert} className="px-3 py-1.5 text-xs rounded-md bg-[#a1001f] text-white hover:bg-[#8a001a] font-semibold">Insert Row</button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
