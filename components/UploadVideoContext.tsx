"use client";

import React, { createContext, useContext, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/lib/app-toast";
import { FileVideo, Loader2, CheckCircle2, AlertCircle, Upload } from "lucide-react";

type UploadState = {
  isUploading: boolean;
  progress: number; // 0 to 100
  statusText: string;
  originalFilename: string;
};

type UploadContextType = {
  uploadState: UploadState;
  startUpload: (file: File) => Promise<void>;
};

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUploadVideo = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUploadVideo must be used within UploadVideoProvider");
  }
  return context;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
  let lastError = "";

  // Attach Bearer token if available
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (token) {
    options = {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    }
  }

  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    // Timeout cho mỗi part (ví dụ 2 phút cho 8MB là rất thoải mái)
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) return response;

      const errorText = await response.text();
      lastError = `Status ${response.status}: ${errorText}`;
      console.warn(`Retry ${i + 1} (${lastError})`);

      // Lỗi 4xx (trừ 408, 429) → không retry
      if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
        throw new Error(`Máy chủ từ chối (Status ${response.status}): ${errorText}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn(`Network retry ${i + 1}: ${err.name} - ${err.message}`);
      
      if (err.name === 'AbortError') {
        lastError = "Kết nối bị ngắt do chờ quá lâu hoặc mạng không ổn định (Timeout/Abort).";
      } else {
        lastError = err.message;
      }
      
      if (err.message.includes("Máy chủ từ chối")) throw err;
    }
    // Nghỉ 3s trước khi thử lại (giảm từ 5s xuống 3s để mượt hơn)
    if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Lỗi đường truyền hoặc máy chủ quá tải. Chi tiết: ${lastError}`);
};

/**
 * Khởi tạo multipart upload, trả về { uploadId, key, bucket }
 */
const initMultipartUpload = async (filename: string, contentType: string) => {
  const res = await fetchWithRetry("/api/upload-multipart-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType }),
  }, 5);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Không thể khởi tạo upload");
  return data as { uploadId: string; key: string; bucket: string };
};

/**
 * Upload một part, trả về { ETag, PartNumber }
 */
const uploadPart = async (
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  blob: Blob
): Promise<{ ETag: string; PartNumber: number }> => {
  const formData = new FormData();
  formData.append("bucket", bucket);
  formData.append("key", key);
  formData.append("uploadId", uploadId);
  formData.append("partNumber", String(partNumber));
  formData.append("file", blob, `part-${partNumber}`);

  const res = await fetchWithRetry("/api/upload-multipart-part", { method: "POST", body: formData }, 5);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || `Lỗi upload part ${partNumber}`);
  return { ETag: data.ETag, PartNumber: data.PartNumber };
};

/**
 * Hoàn tất multipart upload, trả về public URL
 */
const completeMultipartUpload = async (
  bucket: string,
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<string> => {
  const res = await fetchWithRetry("/api/upload-multipart-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, key, uploadId, parts }),
  }, 10); // Cho phép nhiều retry hơn ở bước cuối cùng
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Không thể hoàn tất upload");
  return data.url as string;
};

/**
 * Lưu video vào DB qua /api/training-videos
 */
const saveVideoToDB = async (params: {
  title: string;
  video_link: string;
  duration_seconds?: number;
  video_group_id?: string;
  chunk_index?: number;
  chunk_total?: number;
  original_filename?: string;
  original_size_bytes?: number;
}) => {
  const res = await fetchWithRetry("/api/training-videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: params.title,
      video_link: params.video_link,
      start_date: new Date().toISOString().split("T")[0],
      duration_minutes: Math.ceil((params.duration_seconds || 0) / 60) || 30,
      duration_seconds: params.duration_seconds || 0,
      status: "draft",
      video_group_id: params.video_group_id,
      chunk_index: params.chunk_index,
      chunk_total: params.chunk_total,
      original_filename: params.original_filename,
      original_size_bytes: params.original_size_bytes,
    }),
  });
  return res.json();
};

// ─── S3 Multipart chunk size: 8MB (S3 yêu cầu tối thiểu 5MB/part) ──────────
// Lưu ý: Next.js Proxy mặc định giới hạn body 10MB, nên để 8MB cho an toàn.
const PART_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

// ─── Provider ────────────────────────────────────────────────────────────────

export const UploadVideoProvider = ({ children }: { children: React.ReactNode }) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    statusText: "",
    originalFilename: "",
  });

  const startUpload = async (file: File) => {
    if (uploadState.isUploading) {
      toast.error("Đang có một tiến trình upload, vui lòng chờ!");
      return;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      statusText: "Đang khởi tạo tải lên...",
      originalFilename: file.name,
    });

    let isSuccess = false;

    try {
      const fileMB = file.size / (1024 * 1024);
      // Ngưỡng dùng multipart: > 30MB (an toàn hơn với limit server)
      const USE_MULTIPART_THRESHOLD = 30 * 1024 * 1024;

      if (file.size > USE_MULTIPART_THRESHOLD) {
        // ── MULTIPART UPLOAD (file lớn > 50MB) ──────────────────────────────
        setUploadState((prev) => ({ ...prev, statusText: "Đang khởi tạo multipart upload..." }));

        const { uploadId, key, bucket } = await initMultipartUpload(file.name, file.type || "video/mp4");

        const totalParts = Math.ceil(file.size / PART_SIZE_BYTES);
        const parts: Array<{ ETag: string; PartNumber: number }> = [];

        for (let i = 0; i < totalParts; i++) {
          const start = i * PART_SIZE_BYTES;
          const end = Math.min(start + PART_SIZE_BYTES, file.size);
          const chunk = file.slice(start, end);

          const uploadProgress = Math.round(((i + 1) / totalParts) * 90);
          setUploadState((prev) => ({
            ...prev,
            statusText: `Đang tải lên phần ${i + 1}/${totalParts}...`,
            progress: uploadProgress,
          }));

          const part = await uploadPart(bucket, key, uploadId, i + 1, chunk);
          parts.push(part);
        }

        setUploadState((prev) => ({ ...prev, statusText: "Đang hoàn tất upload...", progress: 92 }));
        const videoUrl = await completeMultipartUpload(bucket, key, uploadId, parts);

        setUploadState((prev) => ({ ...prev, statusText: "Đang lưu vào kho dữ liệu...", progress: 96 }));

        // Lấy duration từ video element
        const durationSec = await getVideoDuration(file).catch(() => 0);

        const videoData = await saveVideoToDB({
          title: file.name.replace(/\.[^/.]+$/, ""),
          video_link: videoUrl,
          duration_seconds: durationSec,
          original_filename: file.name,
          original_size_bytes: file.size,
        });

        if (videoData.success) {
          isSuccess = true;
        } else {
          throw new Error("Lỗi khi lưu video: " + videoData.error);
        }

      } else if (file.size > 100 * 1024 * 1024) {
        // ── FFmpeg CHUNKING + MULTIPART (file 100MB–50MB range đã bị loại bởi điều kiện trên)
        // Nhánh này không còn cần thiết vì threshold đã là 50MB
        // Giữ lại để tương thích nếu threshold thay đổi
        throw new Error("File quá lớn, vui lòng dùng multipart upload");

      } else {
        // ── SINGLE UPLOAD (file ≤ 50MB) ─────────────────────────────────────
        setUploadState((prev) => ({ ...prev, statusText: "Đang tải lên video...", progress: 30 }));

        const formData = new FormData();
        formData.append("video", file);

        const uploadRes = await fetchWithRetry("/api/upload-video", { method: "POST", body: formData }, 5);
        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
          throw new Error(uploadData.error || "Upload thất bại");
        }

        setUploadState((prev) => ({ ...prev, statusText: "Đang lưu vào kho dữ liệu...", progress: 90 }));

        const durationSec = await getVideoDuration(file).catch(() => 0);

        const videoData = await saveVideoToDB({
          title: file.name.replace(/\.[^/.]+$/, ""),
          video_link: uploadData.url,
          duration_seconds: durationSec,
          original_filename: file.name,
          original_size_bytes: file.size,
        });

        if (videoData.success) {
          isSuccess = true;
        } else {
          throw new Error("Lỗi khi lưu video: " + videoData.error);
        }
      }

      setUploadState((prev) => ({ ...prev, progress: 100, statusText: "Hoàn tất!" }));
      if (isSuccess) {
        toast.success("Tải lên video thành công!");
        window.dispatchEvent(new Event("videoUploaded"));
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Lỗi khi upload video!");
    } finally {
      setTimeout(() => {
        setUploadState({ isUploading: false, progress: 0, statusText: "", originalFilename: "" });
      }, 3000);
    }
  };

  return (
    <UploadContext.Provider value={{ uploadState, startUpload }}>
      {children}
      {uploadState.isUploading && (
        <div className="fixed bottom-8 right-8 z-[9999] group flex flex-col items-end gap-3 transform transition-all duration-300">
          {/* Card chi tiết (hiện khi hover) */}
          <div className="opacity-0 translate-y-3 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 w-[340px] bg-white shadow-[0_10px_40px_rgba(161,0,31,0.15)] border border-rose-100 rounded-2xl p-4 origin-bottom-right">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100 shadow-inner">
                  <FileVideo className="w-5 h-5 text-[#a1001f]" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex justify-between items-center mb-1">
                    <h4
                      className="text-sm font-semibold text-gray-800 truncate pr-2 w-[80%]"
                      title={uploadState.originalFilename}
                    >
                      {uploadState.originalFilename}
                    </h4>
                    <span className="text-xs font-bold text-[#a1001f] bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                      {uploadState.progress}%
                    </span>
                  </div>
                  <p
                    className="text-[11.5px] text-gray-500 truncate w-full font-medium"
                    title={uploadState.statusText}
                  >
                    {uploadState.statusText}
                  </p>
                </div>
              </div>

              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-rose-400 to-[#a1001f] transition-all duration-300 ease-out"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>

              <div className="flex items-center gap-2 mt-1 bg-gradient-to-r from-rose-50 to-white p-2.5 rounded-xl border border-rose-100/50 text-[11.5px] text-gray-700 shadow-sm">
                {uploadState.progress === 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Loader2 className="w-4 h-4 text-[#a1001f] animate-spin" />
                )}
                <span className="font-medium">
                  {uploadState.progress === 100
                    ? "Tải lên hoàn tất!"
                    : "Hệ thống đang xử lý, xin vui lòng giữ nguyên trang."}
                </span>
              </div>
            </div>
          </div>

          {/* Vòng tròn tiến trình nhỏ */}
          <div className="relative w-14 h-14 bg-white rounded-full shadow-[0_8px_25px_rgba(161,0,31,0.2)] flex items-center justify-center cursor-pointer border-2 border-white hover:scale-105 hover:shadow-[0_8px_30px_rgba(161,0,31,0.3)] transition-all duration-300">
            <svg
              className="absolute inset-0 w-full h-full -rotate-90 transform origin-center"
              viewBox="0 0 36 36"
            >
              <path
                className="text-gray-100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                className={
                  uploadState.progress === 100
                    ? "text-emerald-500 transition-all duration-500 ease-out"
                    : "text-[#a1001f] transition-all duration-500 ease-out"
                }
                strokeDasharray="100, 100"
                strokeDashoffset={100 - uploadState.progress}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            {uploadState.progress === 100 ? (
              <CheckCircle2 className="w-[22px] h-[22px] text-emerald-500 relative z-10 animate-in zoom-in" />
            ) : (
              <div className="relative z-10 flex items-center justify-center">
                <Upload className="w-[18px] h-[18px] text-[#a1001f] absolute" />
                <div className="absolute w-[22px] h-[22px] bg-[#a1001f] rounded-full blur-[10px] opacity-20 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      )}
    </UploadContext.Provider>
  );
};

// ─── Utility ─────────────────────────────────────────────────────────────────

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = reject;
    video.src = URL.createObjectURL(file);
  });
}
