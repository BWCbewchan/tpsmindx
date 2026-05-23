"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageSkeleton } from '@/components/skeletons/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/primitives/icon';
import { FilterBar, FilterSection } from '@/components/ui/filter-bar';
import { Modal, ModalHeader, ModalTitle, ModalClose, ModalBody } from '@/components/ui/modal';
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { Calendar, MapPin, User, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

interface TeacherAvailability {
  timestamp: string;
  email: string;
  name: string;
  mainSubject: string;
  subjects: string;
  mainBranch: string;
  branches: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  notes: string;
}

interface Center {
  id: number;
  region: string;
  short_code: string;
  full_name: string;
  display_name: string;
  status: string;
}

interface AvailabilityCount {
  count: number;
  teachers: TeacherAvailability[];
}

interface RegionGroup {
  region: string;
  centers: Center[];
  aliases: string[];
}

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type TimeSlot = 'Sáng' | 'Chiều' | 'Tối';

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'monday', label: 'Thứ 2', short: 'T2' },
  { key: 'tuesday', label: 'Thứ 3', short: 'T3' },
  { key: 'wednesday', label: 'Thứ 4', short: 'T4' },
  { key: 'thursday', label: 'Thứ 5', short: 'T5' },
  { key: 'friday', label: 'Thứ 6', short: 'T6' },
  { key: 'saturday', label: 'Thứ 7', short: 'T7' },
  { key: 'sunday', label: 'Chủ nhật', short: 'CN' },
];

const TIME_SLOTS: TimeSlot[] = ['Sáng', 'Chiều', 'Tối'];

const PROGRAMS = ['Tất cả', 'Coding', 'Robotics', 'Art'];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const buildCenterAliases = (center: Center) => {
  const values = [center.full_name, center.display_name, center.short_code, center.region];
  return Array.from(new Set(values.filter(Boolean).map((value) => value.trim()).filter(Boolean)));
};

const matchesAnyAlias = (teacherBranch: string, aliases: string[]) => {
  const normalizedTeacherBranch = normalizeText(teacherBranch);
  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return (
      normalizedTeacherBranch === normalizedAlias ||
      normalizedTeacherBranch.includes(normalizedAlias) ||
      normalizedAlias.includes(normalizedTeacherBranch)
    );
  });
};

// Fetcher với cache
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    next: { revalidate: 60 },
    headers: { 'Accept-Encoding': 'gzip, deflate' }
  });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

// Memoized cell component
const CalendarCell = memo(({ 
  count, 
  teachers, 
  day, 
  timeSlot, 
  onTeacherClick 
}: { 
  count: number; 
  teachers: TeacherAvailability[]; 
  day: string; 
  timeSlot: TimeSlot;
  onTeacherClick: (teacher: TeacherAvailability, day: string, timeSlot: TimeSlot) => void;
}) => {
  const bgColor = count === 0 ? 'bg-gray-100' : 
                  count <= 2 ? 'bg-yellow-50' :
                  count <= 5 ? 'bg-green-50' :
                  'bg-blue-50';

  return (
    <TableCell className={`border border-gray-300 p-2 align-top ${bgColor}`}>
      {count === 0 ? (
        <div className="text-center text-gray-400 text-xs py-2">Không có</div>
      ) : (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-gray-700 mb-2">
            {count} giáo viên
          </div>
          {teachers.map((teacher, idx) => (
            <Button
              key={`${teacher.email}-${idx}`}
              onClick={() => onTeacherClick(teacher, day, timeSlot)}
              variant="outline"
              size="xs"
              className="w-full justify-start text-left h-auto py-1"
            >
              <div className="w-full">
                <div className="font-medium text-gray-900 truncate">{teacher.name}</div>
                <div className="text-gray-600 text-[10px] truncate">{teacher.mainBranch}</div>
              </div>
            </Button>
          ))}
        </div>
      )}
    </TableCell>
  );
});
CalendarCell.displayName = 'CalendarCell';

export default function Page2() {
  const { token } = useAuth();
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('Tất cả');
  const [centers, setCenters] = useState<Center[]>([]);
  const [centersLoading, setCentersLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    teacher: TeacherAvailability;
    day: string;
    timeSlot: TimeSlot;
  } | null>(null);

  // Date range state - mặc định 10 ngày gần nhất
  const today = useMemo(() => new Date(), []);
  const defaultFromDate = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() - 10);
    return date.toISOString().split('T')[0];
  }, [today]);
  const defaultToDate = useMemo(() => today.toISOString().split('T')[0], [today]);
  
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);

  useEffect(() => {
    let isActive = true;

    const loadCenters = async () => {
      try {
        const response = await fetch('/api/app-auth/data?table=centers&status=Active', {
          headers: authHeaders(token),
        });
        const data = await response.json();

        if (!isActive) return;

        const rows = Array.isArray(data.rows) ? data.rows : [];
        setCenters(rows.map((row: any) => ({
          id: Number(row.id),
          region: String(row.region || ''),
          short_code: String(row.short_code || ''),
          full_name: String(row.full_name || ''),
          display_name: String(row.display_name || ''),
          status: String(row.status || ''),
        })));
      } catch (error) {
        console.error('Error loading centers:', error);
        if (isActive) {
          setCenters([]);
        }
      } finally {
        if (isActive) {
          setCentersLoading(false);
        }
      }
    };

    loadCenters();

    return () => {
      isActive = false;
    };
  }, [token]);

  const regionGroups = useMemo<RegionGroup[]>(() => {
    const grouped = new Map<string, Center[]>();

    centers.forEach((center) => {
      const region = center.region?.trim() || 'Khác';
      const current = grouped.get(region) || [];
      current.push(center);
      grouped.set(region, current);
    });

    return Array.from(grouped.entries())
      .map(([region, items]) => ({
        region,
        centers: items.sort((a, b) => a.display_name.localeCompare(b.display_name, 'vi')),
        aliases: Array.from(new Set(items.flatMap(buildCenterAliases))),
      }))
      .sort((a, b) => a.region.localeCompare(b.region, 'vi'));
  }, [centers]);

  const regionOptions = useMemo(() => ['Tất cả', ...regionGroups.map((group) => group.region)], [regionGroups]);

  const selectedRegionGroup = useMemo(
    () => regionGroups.find((group) => group.region === selectedRegion) || null,
    [regionGroups, selectedRegion]
  );

  const selectedRegionSummary = useMemo(() => {
    if (!selectedRegionGroup) return '';

    const names = selectedRegionGroup.centers.map((center) => center.display_name || center.full_name).filter(Boolean);
    return names.length <= 4 ? names.join(', ') : `${names.slice(0, 4).join(', ')} +${names.length - 4}`;
  }, [selectedRegionGroup]);

  // Build API URL với date params
  const apiUrl = useMemo(() => {
    return `/api/availability?fromDate=${fromDate}&toDate=${toDate}`;
  }, [fromDate, toDate]);

  // Fetch data với SWR
  const { data, error, isLoading } = useSWR<{ 
    teachers: TeacherAvailability[]; 
    totalRecords: number;
    fromDate: string;
    toDate: string;
  }>(
    apiUrl,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const teachers = data?.teachers || [];

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [modalOpen]);

  // Filter teachers theo program và region
  const filteredTeachers = useMemo(() => {
    let filtered = teachers;
    
    // Filter by program - if any programs selected
    if (selectedPrograms.length > 0) {
      filtered = filtered.filter(t => 
        selectedPrograms.some(program => 
          t.mainSubject.includes(program) || t.subjects.includes(program)
        )
      );
    }
    
    // Filter by region
    if (selectedRegion !== 'Tất cả' && selectedRegionGroup) {
      filtered = filtered.filter(t => {
        // Check if teacher's main branch or any available branch is in the region
        const branches = [t.mainBranch, ...t.branches.split(',').map(b => b.trim())].filter(Boolean);
        return branches.some(branch => matchesAnyAlias(branch, selectedRegionGroup.aliases));
      });
    }
    
    return filtered;
  }, [teachers, selectedPrograms, selectedRegion, selectedRegionGroup]);

  // Calculate availability counts
  const availabilityMatrix = useMemo(() => {
    const matrix: Record<DayKey, Record<TimeSlot, AvailabilityCount>> = {
      monday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      tuesday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      wednesday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      thursday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      friday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      saturday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
      sunday: { 'Sáng': { count: 0, teachers: [] }, 'Chiều': { count: 0, teachers: [] }, 'Tối': { count: 0, teachers: [] } },
    };

    filteredTeachers.forEach(teacher => {
      DAYS.forEach(({ key }) => {
        const availability = teacher[key];
        if (!availability || availability === 'Bận') return;

        TIME_SLOTS.forEach(slot => {
          if (availability.includes(slot)) {
            matrix[key][slot].count++;
            matrix[key][slot].teachers.push(teacher);
          }
        });
      });
    });

    return matrix;
  }, [filteredTeachers]);

  const handleTeacherClick = useCallback((teacher: TeacherAvailability, day: string, timeSlot: TimeSlot) => {
    setModalData({ teacher, day, timeSlot });
    setModalOpen(true);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium">Lỗi tải dữ liệu</p>
          <p className="text-gray-600 mt-2">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout padding="sm">
      <PageLayoutContent spacing="lg">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Lịch Rảnh Giáo Viên</h1>
          </div>
          <p className="text-gray-600">Xem số lượng giáo viên rảnh theo khung giờ và chương trình</p>
        </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-600" />
          <span className="text-gray-700 font-medium">Khoảng thời gian:</span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Từ ngày:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Đến ngày:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button
            onClick={() => {
              const newToDate = new Date().toISOString().split('T')[0];
              const newFromDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              setFromDate(newFromDate);
              setToDate(newToDate);
            }}
            variant="outline"
            size="sm"
          >
            10 ngày gần nhất
          </Button>
        </div>
      </div>

      {/* Region and Program Filters */}
      <FilterSection>
        <FilterBar
          label="Khu vực"
          icon={MapPin}
          options={regionOptions}
          selected={selectedRegion}
          onSelect={(value) => setSelectedRegion(value as string)}
        />

        <FilterBar
          label="Chương trình"
          icon={Calendar}
          options={PROGRAMS}
          selected={selectedPrograms}
          onSelect={(value) => setSelectedPrograms(value as string[])}
          multiple
          onClear={() => setSelectedPrograms([])}
        />

        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          {selectedRegion !== 'Tất cả' && selectedRegionGroup && (
            <div className="text-xs text-gray-600 bg-purple-50 px-3 py-1 rounded-full">
              {centersLoading ? 'Đang tải cơ sở...' : selectedRegionSummary}
            </div>
          )}
          <span className="ml-auto text-sm text-gray-600">
            Tổng: <span className="font-bold text-gray-900">{filteredTeachers.length}</span> giáo viên
            {selectedPrograms.length > 0 && (
              <span className="text-blue-600 ml-2">({selectedPrograms.join(', ')})</span>
            )}
          </span>
        </div>
      </FilterSection>

      {/* Calendar */}
      {isLoading ? (
        <PageSkeleton variant="table" itemCount={6} showHeader={false} />
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="w-full border-collapse">
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-blue-600 to-blue-800 hover:bg-blue-800 text-white">
                  <TableHead className="border border-blue-700 p-3 text-left sticky left-0 bg-blue-700 z-10 text-white">
                    Khung giờ
                  </TableHead>
                  {DAYS.map(day => (
                    <TableHead key={day.key} className="border border-blue-700 p-3 text-center min-w-32 text-white">
                      <div className="font-bold">{day.label}</div>
                      <div className="text-xs font-normal opacity-90">({day.short})</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {TIME_SLOTS.map(slot => (
                  <TableRow key={slot}>
                    <TableCell className="border border-gray-300 p-3 font-semibold bg-gray-50 sticky left-0 z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        {slot}
                      </div>
                    </TableCell>
                    {DAYS.map(day => (
                      <CalendarCell
                        key={`${day.key}-${slot}`}
                        count={availabilityMatrix[day.key][slot].count}
                        teachers={availabilityMatrix[day.key][slot].teachers}
                        day={day.label}
                        timeSlot={slot}
                        onTeacherClick={handleTeacherClick}
                      />
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Chú thích màu sắc:</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-100 border border-gray-300 rounded"></div>
            <span className="text-sm text-gray-700">Không có giáo viên rảnh</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-100 border border-gray-300 rounded"></div>
            <span className="text-sm text-gray-700">1-2 giáo viên</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 border border-gray-300 rounded"></div>
            <span className="text-sm text-gray-700">3-5 giáo viên</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 border border-gray-300 rounded"></div>
            <span className="text-sm text-gray-700">6+ giáo viên</span>
          </div>
        </div>
      </div>

      {/* Modal - Teacher Detail */}
      {modalOpen && modalData && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <div>
                  <h3 className="text-xl font-bold">{modalData.teacher.name}</h3>
                  <p className="text-sm opacity-90">
                    {modalData.day} - {modalData.timeSlot}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setModalOpen(false)}
                variant="ghost"
                size="icon-sm"
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <Icon icon={X} size="sm" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="overflow-auto max-h-[calc(90vh-140px)] p-6">
              <div className="space-y-4">
                {/* Basic Info */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Thông tin cơ bản</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium text-gray-900">{modalData.teacher.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Chi nhánh chính:</span>
                      <span className="font-medium text-gray-900">{modalData.teacher.mainBranch}</span>
                    </div>
                    {modalData.teacher.branches && modalData.teacher.branches !== modalData.teacher.mainBranch && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Có thể làm việc:</span>
                        <span className="font-medium text-gray-900 text-right">{modalData.teacher.branches}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subjects */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Môn dạy</h4>
                  <div className="flex flex-wrap gap-2">
                    {modalData.teacher.subjects.split(',').map((subject, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                      >
                        {subject.trim()}
                      </span>
                    ))}
                  </div>
                  {modalData.teacher.mainSubject && (
                    <div className="mt-3 text-xs text-gray-600">
                      Môn chính: <span className="font-semibold text-gray-900">{modalData.teacher.mainSubject}</span>
                    </div>
                  )}
                </div>

                {/* Weekly Schedule */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Lịch rảnh trong tuần</h4>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map(day => {
                      const availability = modalData.teacher[day.key];
                      const isBusy = !availability || availability === 'Bận';
                      return (
                        <div key={day.key} className="text-center">
                          <div className="text-xs font-semibold text-gray-700 mb-1">{day.short}</div>
                          <div className={`text-[10px] p-1 rounded ${isBusy ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-800'}`}>
                            {isBusy ? 'Bận' : availability}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                {modalData.teacher.notes && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-yellow-50">
                    <h4 className="font-semibold text-gray-900 mb-2">Ghi chú</h4>
                    <p className="text-sm text-gray-700 italic">{modalData.teacher.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gradient-to-b from-gray-50 to-gray-100 border-t border-gray-200">
              <Button
                onClick={() => setModalOpen(false)}
                variant="default"
                className="w-full"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
      </PageLayoutContent>
    </PageLayout>
  );
}
