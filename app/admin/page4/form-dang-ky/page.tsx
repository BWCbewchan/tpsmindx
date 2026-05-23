"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { ClipboardCheck, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "@/lib/app-toast";

interface RegistrationTemplate {
  id: string;
  title: string;
  statusLabel: string;
}

const REGISTER_OPTIONS = [
  "[COD] Scratch",
  "[COD] GameMaker",
  "[COD] Web",
  "[COD] AppProducer",
  "[COD] ComputerScience",
  "[ROB] VexGo",
  "[ROB] VexIQ",
  "[ART] Test chuyên sâu",
  "Kiểm tra quy trình - kỹ năng trải nghiệm",
];

const FORM_TEMPLATES: RegistrationTemplate[] = [
  {
    id: "official",
    title:
      "[MindX | Teaching K12] Kiểm tra Chuyên môn Chuyên sâu & Quy trình - Kỹ năng trải nghiệm [Chính thức]",
    statusLabel: "Chính thức",
  },
  {
    id: "supplement",
    title:
      "[MindX | Teaching K12] Kiểm tra Chuyên môn Chuyên sâu & Quy trình - Kỹ năng trải nghiệm[Bổ sung]",
    statusLabel: "Bổ sung",
  },
];

export default function ProfessionalExamRegistrationFormsPage() {
  const [activeTemplateId, setActiveTemplateId] = useState<string>(FORM_TEMPLATES[0].id);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const activeTemplate = useMemo(
    () => FORM_TEMPLATES.find((template) => template.id === activeTemplateId) || FORM_TEMPLATES[0],
    [activeTemplateId]
  );

  const toggleOption = (value: string) => {
    setSelectedOptions((previous) => {
      if (previous.includes(value)) {
        return previous.filter((option) => option !== value);
      }
      return [...previous, value];
    });
  };

  const copyTemplateName = async () => {
    try {
      await navigator.clipboard.writeText(activeTemplate.title);
      toast.success("Đã sao chép tên mẫu form");
    } catch {
      toast.error("Không thể sao chép tên mẫu form");
    }
  };

  const copyFormContent = async () => {
    const body = [
      activeTemplate.title,
      "",
      "Nội dung đăng ký kiểm tra chuyên sâu",
      "* Các bạn vui lòng chọn ít nhất 1 option",
      "Lịch kiểm tra Giáo viên có thể xem tại đây: /admin/page4/lich-danh-gia",
      ...REGISTER_OPTIONS.map((option) => `- ${option}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(body);
      toast.success("Đã sao chép nội dung mẫu");
    } catch {
      toast.error("Không thể sao chép nội dung mẫu");
    }
  };

  return (
    <PageContainer
      title="Quản lý form đăng ký kiểm tra chuyên môn"
      description="Tạo và quản lý mẫu form đăng ký kiểm tra chuyên sâu cho giáo viên"
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-1" padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-5 w-5 text-[#a1001f]" />
            <h2 className="text-base font-bold text-gray-900">Danh sách form mẫu</h2>
          </div>

          <div className="space-y-3">
            {FORM_TEMPLATES.map((template) => {
              const isActive = template.id === activeTemplate.id;
              return (
                <button
                  key={template.id}
                  onClick={() => {
                    setActiveTemplateId(template.id);
                    setSelectedOptions([]);
                  }}
                  className={`w-full text-left border rounded-lg p-3 transition ${
                    isActive
                      ? "border-[#a1001f] bg-red-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-500 mb-1">{template.statusLabel}</div>
                  <div className="text-sm font-semibold text-gray-900 leading-5">{template.title}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <button
              onClick={copyTemplateName}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              <Copy className="h-4 w-4" /> Sao chép tên form
            </button>
            <button
              onClick={copyFormContent}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#a1001f] text-white px-3 py-2 text-sm font-semibold hover:bg-[#8a0019]"
            >
              <Copy className="h-4 w-4" /> Sao chép toàn bộ mẫu
            </button>
          </div>
        </Card>

        <Card className="xl:col-span-2" padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">{activeTemplate.title}</h2>
            <Link
              href="/admin/page4/lich-danh-gia"
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 px-3 py-2 text-sm font-semibold hover:bg-blue-100"
            >
              Xem lịch chính <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 bg-white">

            <div className="text-base font-semibold text-gray-900 mb-1">Nội dung đăng ký kiểm tra chuyên sâu</div>
            <div className="text-sm text-gray-600 mb-3">Các bạn vui lòng chọn ít nhất 1 option</div>
            <div className="text-sm text-gray-700 mb-4">
              Lịch kiểm tra Giáo viên có thể xem tại đây (
              <Link href="/admin/page4/lich-danh-gia" className="text-blue-600 hover:text-blue-700 underline">
                link về lịch chính
              </Link>
              )
            </div>

            <div className="space-y-2">
              {REGISTER_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={() => toggleOption(option)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900">{option}</span>
                </label>
              ))}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Đã chọn: <span className="font-semibold text-gray-700">{selectedOptions.length}</span> mục
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
