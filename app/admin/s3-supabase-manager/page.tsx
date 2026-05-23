"use client";

import { PageContainer } from "@/components/PageContainer";
import { PageSkeleton } from "@/components/skeletons/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/primitives/icon";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { useAuth } from "@/lib/auth-context";
import { authHeaders } from "@/lib/auth-headers";
import { File, Filter, Image as ImageIcon, RefreshCw, Video, Database } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/app-toast";

type ResourceType = "image" | "video" | "file";
type ResourceFilter = "all" | ResourceType;

interface StorageItem {
  id: string;
  name: string;
  bucket: string;
  kind: ResourceType;
  size: number;
  updatedAt: string | null;
  createdAt: string | null;
  previewUrl?: string | null;
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export default function S3SupabaseManagerPage() {
  const { user, token } = useAuth();
  const [items, setItems] = useState<StorageItem[]>([]);
  const [buckets, setBuckets] = useState<Array<{ name: string; public: boolean }>>([]);
  const [bucket, setBucket] = useState("");
  const [loading, setLoading] = useState(true);
  const [resourceType, setResourceType] = useState<ResourceFilter>("all");
  const [prefix, setPrefix] = useState("");
  const [appliedPrefix, setAppliedPrefix] = useState("");
  const [configured, setConfigured] = useState(true);
  const [configMessage, setConfigMessage] = useState("");

  const fetchItems = async () => {
    if (!user?.email) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        kind: resourceType,
      });
      if (bucket) params.set("bucket", bucket);
      if (appliedPrefix.trim()) {
        params.set("prefix", appliedPrefix);
      }

      const response = await fetch(`/api/admin/s3-supabase-manager?${params.toString()}`, {
        cache: "no-store",
        headers: authHeaders(token),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Không thể tải thư viện");
      }
      setConfigured(Boolean(data.configured));
      setConfigMessage(data.message || "");
      setBuckets(data.buckets || []);
      setItems(data.items || []);
    } catch (error: any) {
      toast.error(error.message || "Lỗi tải thư viện");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();

  }, [resourceType, appliedPrefix, bucket, user?.email]);

  const stats = useMemo(() => {
    const images = items.filter((item) => item.kind === "image").length;
    const videos = items.filter((item) => item.kind === "video").length;
    const files = items.filter((item) => item.kind === "file").length;
    const totalBytes = items.reduce((sum, item) => sum + Number(item.size || 0), 0);
    return { images, videos, files, total: items.length, totalBytes };
  }, [items]);

  return (
    <PageContainer
      title="S3 Supabase Manager"
      description="Thư viện Supabase Storage: phân loại hình ảnh, video và file"
    >
      {!configured && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          Chưa cấu hình Supabase Storage. {configMessage}
        </div>
      )}

      <StatGrid cols={6}>
        <StatCard
          label="Tổng tài nguyên"
          value={stats.total}
          icon={File}
        />
        <StatCard
          label="Hình ảnh"
          value={stats.images}
          icon={ImageIcon}
          variant="blue"
        />
        <StatCard
          label="Video"
          value={stats.videos}
          icon={Video}
          variant="purple"
        />
        <StatCard
          label="File khác"
          value={stats.files}
          icon={File}
          variant="amber"
        />
        <StatCard
          label="Bucket"
          value={bucket || "Tất cả buckets"}
          icon={Database}
          className="md:col-span-2"
        />
        <StatCard
          label="Dung lượng"
          value={formatBytes(stats.totalBytes)}
          variant="emerald"
        />
      </StatGrid>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Bucket</label>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Tất cả buckets</option>
              {buckets.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-600 mb-1 block">Prefix/folder</label>
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Ví dụ: mindx_"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Phân loại</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value as ResourceFilter)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">Tất cả</option>
              <option value="image">Hình ảnh</option>
              <option value="video">Video</option>
              <option value="file">File khác</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={() => setAppliedPrefix(prefix)}
              variant="default"
              size="sm"
              className="flex-1"
            >
              <Icon icon={Filter} size="sm" />
              Áp dụng
            </Button>
            <Button
              onClick={fetchItems}
              variant="outline"
              size="icon-sm"
            >
              <Icon icon={RefreshCw} size="sm" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <PageSkeleton variant="grid" itemCount={6} showHeader={false} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-44 bg-gray-100 flex items-center justify-center">
                {item.kind === "image" ? (
                  item.previewUrl ? (

                    <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-blue-500" />
                  )
                ) : item.kind === "video" ? (
                  item.previewUrl ? (
                    <video src={item.previewUrl} className="w-full h-full object-cover" controls preload="metadata" />
                  ) : (
                    <Video className="w-10 h-10 text-purple-500" />
                  )
                ) : (
                  <div className="text-gray-500 text-sm inline-flex items-center gap-2">
                    <File className="w-4 h-4" />
                    FILE
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 inline-flex items-center gap-1">
                  {item.kind === "image" ? (
                    <ImageIcon className="w-3 h-3" />
                  ) : item.kind === "video" ? (
                    <Video className="w-3 h-3" />
                  ) : (
                    <File className="w-3 h-3" />
                  )}
                  {item.kind}
                </span>
                <p className="text-sm font-semibold text-gray-900 break-all line-clamp-2">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.bucket} - {formatBytes(item.size)} -{" "}
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN") : "--"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
