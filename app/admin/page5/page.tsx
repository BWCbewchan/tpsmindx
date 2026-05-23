"use client";

import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { SearchBar } from "@/components/SearchBar";
import { SkeletonList } from "@/components/skeletons";
import { Tabs } from "@/components/Tabs";
import { Eye, Lock, Trash2, Upload, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from '@/lib/app-toast';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { useUploadVideo } from "@/components/UploadVideoContext";

interface Video {
  id: number;
  title: string;
  video_link: string;
  start_date: string;
  duration_minutes: number;
  view_count: number;
  status: string;
  description: string;
  thumbnail_url: string;
  lesson_number: number;
  actual_view_count?: number;
  actual_viewers?: number;
  video_group_id?: string;
  chunk_index?: number;
  chunk_total?: number;
  original_filename?: string;
}

export default function Page5() {
  const { token } = useAuth();
  const [tab, setTab] = useState<'assigned' | 'draft' | 'locked'>('assigned');
  const [search, setSearch] = useState("");
  const { uploadState, startUpload } = useUploadVideo();
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoDurations, setVideoDurations] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: "danger" | "warning" | "info";
    requireTextConfirm?: boolean;
    icon?: "delete" | "lock" | "warning";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchVideos();

    const handleUploadDone = () => {
        fetchVideos();
    };
    window.addEventListener("videoUploaded", handleUploadDone);
    return () => window.removeEventListener("videoUploaded", handleUploadDone);
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/training-videos');
      const data = await response.json();
      if (data.success) {
        setVideos(data.data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLockVideo = (videoId: number, videoTitle: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Khóa video",
      message: `Bạn có chắc chắn muốn khóa video "${videoTitle}"?\n\nVideo sẽ chuyển sang trạng thái inactive và không thể truy cập bởi giáo viên.`,
      type: "warning",
      icon: "lock",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        try {
          const response = await fetch('/api/training-videos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: videoId, status: 'inactive' })
          });

          const data = await response.json();
          if (data.success) {
            toast.success('Khóa video thành công!');
            fetchVideos();
          } else {
            toast.error('Lỗi: ' + data.error);
          }
        } catch (error) {
          console.error('Error locking video:', error);
          toast.error('Lỗi khi khóa video!');
        }
      },
    });
  };

  const handleDeleteVideo = (videoId: number, videoTitle: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Xóa video vĩnh viễn",
      message: `Bạn có chắc chắn muốn XÓA VĨNH VIỄN video "${videoTitle}"?\n\n⚠️ CẢNH BÁO: Hành động này KHÔNG THỂ HOÀN TÁC!\n\n- Video sẽ bị xóa khỏi database và Cloudinary\n- Nếu video có nhiều phần (cùng group), tất cả sẽ bị xóa\n- Tất cả câu hỏi liên quan sẽ bị xóa\n- Dữ liệu xem của giáo viên sẽ bị xóa`,
      type: "danger",
      icon: "delete",
      requireTextConfirm: true,
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        try {
          const response = await fetch('/api/training-videos', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: videoId })
          });

          const data = await response.json();
          if (!data.success) {
            toast.error('Lỗi: ' + data.error);
            return;
          }

          // Xóa file trên Storage cho tất cả video đã bị xóa (kể cả cùng group)
          const extractS3Key = (url: string): { key: string; bucket: string } | null => {
            if (!url) return null;
            // Supabase public URL: /storage/v1/object/public/<bucket>/<key>
            const supabaseMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
            if (supabaseMatch) return { bucket: supabaseMatch[1], key: supabaseMatch[2] };
            return null;
          };

          const deletedVideos: Array<{ video_link: string; thumbnail_url: string }> = data.deleted_videos || [];
          const storageDeletes: Promise<void>[] = [];

          for (const v of deletedVideos) {
            const videoParsed = extractS3Key(v.video_link);
            if (videoParsed) {
              storageDeletes.push(
                fetch('/api/admin/cloudinary', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                  body: JSON.stringify({ key: videoParsed.key, bucket: videoParsed.bucket })
                }).then(() => {}).catch(e => console.warn('S3 video delete warn:', e))
              );
            }
            const thumbParsed = extractS3Key(v.thumbnail_url);
            if (thumbParsed) {
              storageDeletes.push(
                fetch('/api/admin/cloudinary', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                  body: JSON.stringify({ key: thumbParsed.key, bucket: thumbParsed.bucket })
                }).then(() => {}).catch(e => console.warn('S3 thumb delete warn:', e))
              );
            }
          }

          await Promise.allSettled(storageDeletes);

          toast.success('Xóa video thành công!');
          fetchVideos();
        } catch (error) {
          console.error('Error deleting video:', error);
          toast.error('Lỗi khi xóa video!');
        }
      },
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await startUpload(file);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const groupedVideos = videos.reduce((acc, video) => {
    if (!video.video_group_id) {
      acc.push(video);
    } else {
      const existingGroup = acc.find(v => v.video_group_id === video.video_group_id);
      if (existingGroup) {
        existingGroup.duration_minutes = (existingGroup.duration_minutes || 0) + (video.duration_minutes || 0);
      } else {
        const groupRep = { ...video };
        if (groupRep.original_filename) {
            groupRep.title = groupRep.original_filename.replace(/\.[^/.]+$/, "");
        } else {
            groupRep.title = groupRep.title.replace(/\s*\(Phần \d+\)$/i, "");
        }
        acc.push(groupRep);
      }
    }
    return acc;
  }, [] as Video[]);

  const filteredVideos = groupedVideos
    .filter((v) => {
      if (tab === 'assigned') return v.status === 'active';
      if (tab === 'draft') return v.status === 'draft';
      if (tab === 'locked') return v.status === 'inactive';
      return false;
    })
    .filter((v) => v.title.toLowerCase().includes(search.toLowerCase()));

  const tabCounts = {
    assigned: groupedVideos.filter(v => v.status === 'active').length,
    draft: groupedVideos.filter(v => v.status === 'draft').length,
    locked: groupedVideos.filter(v => v.status === 'inactive').length,
  };

  // Show skeleton while loading
  if (loading) {
    return (
      <PageContainer
        title="Quản lý đào tạo nâng cao"
        description="Quản lý video và bài học đào tạo"
      >
        <SkeletonList items={8} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Quản lý đào tạo nâng cao"
      description="Quản lý video và bài học đào tạo"
    >
      {/* Upload Button */}
      <div className="flex justify-end mb-4">
        <input
          type="file"
          accept="video/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          className="flex items-center gap-2 bg-[#a1001f] hover:bg-[#c41230] text-white px-4 py-2 rounded-lg font-semibold disabled:bg-gray-400 transition-colors"
          onClick={handleUploadClick}
          disabled={uploadState.isUploading}
        >
          <Upload className="h-4 w-4" />
          {uploadState.isUploading ? "Đang tải lên..." : "Upload video"}
        </button>
      </div>

      {/* Loading Overlay */}
      

      <Card>
        {/* Tabs */}
        <Tabs
          tabs={[
            { id: 'assigned', label: 'Video đã giao', count: tabCounts.assigned },
            { id: 'draft', label: 'Video nháp', count: tabCounts.draft },
            { id: 'locked', label: 'Video đã khóa', count: tabCounts.locked },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as 'assigned' | 'draft' | 'locked')}
        />

        {/* Search */}
        <div className="my-4">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Tìm kiếm video..."
          />
        </div>

        {/* Videos Grid */}
        {filteredVideos.length === 0 ? (
          <EmptyState
            icon={Video}
            title={search ? "Không tìm thấy video" : "Chưa có video"}
            description={search ? "Thử tìm kiếm với từ khóa khác" : 'Nhấn "Upload video" để thêm video mới'}
            action={!search ? {
              label: "Upload video",
              onClick: handleUploadClick
            } : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
            {filteredVideos.map(video => (
              <div
                key={video.id}
                className="bg-white rounded-lg border border-gray-200 p-2 hover:border-gray-300 hover:shadow-sm transition-all group relative"
              >
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  {/* Delete Button */}
                  {video.status !== 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(video.id, video.title);
                      }}
                      className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                      title="Xóa video"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  
                  {/* Lock Button */}
                  {video.status !== 'inactive' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLockVideo(video.id, video.title);
                      }}
                      className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-orange-600"
                      title="Khóa video"
                    >
                      <Lock className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/video-detail?id=${video.id}`)}
                >
                  {/* Thumbnail */}
                  <div className="bg-gray-100 rounded h-24 mb-2 flex items-center justify-center overflow-hidden">
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <Video className="h-8 w-8 text-gray-400" />
                    )}
                    {video.video_link && (
                      <video
                        src={video.video_link}
                        preload="metadata"
                        className="hidden"
                        onLoadedMetadata={(event) => {
                          const duration = event.currentTarget.duration;
                          if (Number.isFinite(duration) && duration > 0) {
                            const minutes = Math.max(1, Math.round(duration / 60));
                            setVideoDurations((prev) => {
                              if (prev[video.id] === minutes) return prev;
                              return { ...prev, [video.id]: minutes };
                            });
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="text-xs text-gray-500 mb-1 flex items-center gap-1 flex-wrap">
                    {video.lesson_number && (
                      <span className="font-semibold">L{video.lesson_number}</span>
                    )}
                    {video.lesson_number && <span>•</span>}
                    <span>{videoDurations[video.id] ?? video.duration_minutes ?? 0}p</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {Math.max(video.view_count || 0, video.actual_view_count || 0, video.actual_viewers || 0)}
                    </span>
                  </div>

                  <div className="font-semibold text-xs mb-1 line-clamp-2">{video.title}</div>

                  <span className={`inline-block text-xs px-2 py-0.5 rounded ${video.status === 'active' ? 'bg-green-100 text-green-800' :
                      video.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                    }`}>
                    {video.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        requireTextConfirm={confirmDialog.requireTextConfirm}
        icon={confirmDialog.icon}
      />
    </PageContainer>
  );
}

