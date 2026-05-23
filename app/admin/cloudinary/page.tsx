'use client';

import { PageContainer } from '@/components/PageContainer';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { Copy, Image as ImageIcon, Loader2, RefreshCw, Search, Trash2, Video } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '@/lib/app-toast';

type ResourceTypeFilter = 'all' | 'image' | 'video' | 'raw';

interface CloudinaryResource {
  asset_id: string;
  public_id: string;
  resource_type: 'image' | 'video' | 'raw';
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  secure_url: string;
  created_at: string;
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function AdminCloudinaryPage() {
  const { token } = useAuth();
  const [resources, setResources] = useState<CloudinaryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceTypeFilter>('all');
  const [prefix, setPrefix] = useState('');
  const [appliedPrefix, setAppliedPrefix] = useState('');
  const [limit, setLimit] = useState(30);
  const [bucket, setBucket] = useState('mindx-videos');
  const [buckets, setBuckets] = useState<string[]>([]);

  const fetchResources = useCallback(
    async (cursor?: string, append = false) => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          bucket,
          max_results: String(limit),
        });

        if (appliedPrefix.trim()) {
          params.set('prefix', appliedPrefix.trim());
        }

        if (cursor) {
          params.set('next_cursor', cursor);
        }

        const response = await fetch(`/api/admin/cloudinary?${params.toString()}`, {
          cache: 'no-store',
          headers: authHeaders(token),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Khong the tai du lieu Storage');
        }

        setResources((prev) => (append ? [...prev, ...(data.data || [])] : data.data || []));
        setNextCursor(data.next_cursor || null);
      } catch (error: any) {
        toast.error(error.message || 'Loi tai du lieu Storage');
      } finally {
        setLoading(false);
      }
    },
    [bucket, limit, appliedPrefix, token]
  );

  // Fetch danh sách buckets khi mount
  useEffect(() => {
    fetch('/api/admin/cloudinary', { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.buckets) {
          setBuckets(data.buckets);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    fetchResources(undefined, false);
  }, [fetchResources]);

  const handleDelete = async (resource: CloudinaryResource) => {
    if (!confirm(`Xoa tai nguyen ${resource.public_id}?`)) return;

    try {
      setDeletingId(resource.public_id);
      const response = await fetch('/api/admin/cloudinary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          key: resource.public_id,
          bucket,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Khong the xoa tai nguyen');
      }

      setResources((prev) => prev.filter((item) => item.public_id !== resource.public_id));
      toast.success('Da xoa tai nguyen Storage');
    } catch (error: any) {
      toast.error(error.message || 'Loi xoa tai nguyen');
    } finally {
      setDeletingId(null);
    }
  };

  const summary = useMemo(() => {
    const totalBytes = resources.reduce((sum, item) => sum + Number(item.bytes || 0), 0);
    const imageCount = resources.filter((r) => r.resource_type === 'image').length;
    const videoCount = resources.filter((r) => r.resource_type === 'video').length;
    return {
      total: resources.length,
      images: imageCount,
      videos: videoCount,
      totalBytes,
    };
  }, [resources]);

  return (
    <PageContainer title="Storage Manager" description="Quan ly tai nguyen hinh anh, video tren Supabase S3 Storage">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Tong tai nguyen</p>
          <p className="text-xl font-bold text-gray-900">{summary.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Anh</p>
          <p className="text-xl font-bold text-blue-600">{summary.images}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Video</p>
          <p className="text-xl font-bold text-purple-600">{summary.videos}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Dung luong hien thi</p>
          <p className="text-xl font-bold text-emerald-600">{formatBytes(summary.totalBytes)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Bucket</label>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm"
            >
              {buckets.length > 0 ? (
                buckets.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))
              ) : (
                <>
                  <option value="mindx-videos">mindx-videos</option>
                  <option value="mindx-thumbnails">mindx-thumbnails</option>
                  <option value="mindx-posts-content">mindx-posts-content</option>
                  <option value="mindx-question-images">mindx-question-images</option>
                  <option value="feedback-images">feedback-images</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Prefix/folder</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="vi du: videos/"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-600 mb-1 block">Moi trang</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm"
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setAppliedPrefix(prefix);
                fetchResources(undefined, false);
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#a1001f] text-white rounded-lg text-sm hover:bg-[#7e0018]"
            >
              <RefreshCw className="w-4 h-4" />
              Tai lai
            </button>
          </div>
        </div>
      </div>

      {loading && resources.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {resources.map((resource) => (
            <div key={resource.asset_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-44 bg-gray-100 flex items-center justify-center">
                {resource.resource_type === 'image' ? (

                  <img src={resource.secure_url} alt={resource.public_id} className="w-full h-full object-cover" />
                ) : resource.resource_type === 'video' ? (
                  <video src={resource.secure_url} className="w-full h-full object-cover" controls preload="metadata" />
                ) : (
                  <div className="text-gray-500 text-sm">RAW FILE</div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 inline-flex items-center gap-1">
                    {resource.resource_type === 'image' ? <ImageIcon className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                    {resource.resource_type}
                  </span>
                  <span className="text-xs text-gray-500">{formatBytes(resource.bytes)}</span>
                </div>

                <p className="text-sm font-semibold text-gray-900 break-all line-clamp-2">{resource.public_id}</p>
                <p className="text-xs text-gray-500">
                  {resource.width && resource.height ? `${resource.width}x${resource.height} - ` : ''}
                  {resource.format?.toUpperCase()} - {new Date(resource.created_at).toLocaleString('vi-VN')}
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resource.secure_url);
                      toast.success('Da copy URL');
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs border border-gray-300 rounded-md py-1.5 hover:bg-gray-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy URL
                  </button>

                  <button
                    onClick={() => handleDelete(resource)}
                    disabled={deletingId === resource.public_id}
                    className="inline-flex items-center justify-center gap-1.5 text-xs border border-red-300 text-red-600 rounded-md py-1.5 px-2 hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingId === resource.public_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Xoa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            disabled={loading}
            onClick={() => fetchResources(nextCursor, true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Tai them
          </button>
        </div>
      )}
    </PageContainer>
  );
}
