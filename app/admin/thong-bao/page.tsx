'use client';
import { useQueryState } from '@/lib/use-query-state'


import { PageContainer } from '@/components/PageContainer';
import { DevicePushSetting } from '@/components/notifications/DevicePushSetting';
import { useAuth } from '@/lib/auth-context';
import { authHeaders } from '@/lib/auth-headers';
import { toast } from '@/lib/app-toast';
import { Bell, Check, MailOpen, Trash2, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

interface Notification {
  id: number;
  title: string;
  content: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATION_COUNT_REFRESH_MS = 180_000;
const NOTIFICATION_DEDUPING_MS = 60_000;

// Maps categories to their display configurations
const categoriesMap = {
  shift: {
    name: 'Ca trực',
    color: 'rgb(94, 106, 210)',
    bg: 'rgba(94, 106, 210, 0.1)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>
    )
  },
  examiner: {
    name: 'Giám khảo',
    color: 'rgb(139, 92, 246)',
    bg: 'rgba(139, 92, 246, 0.1)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clipboard-check" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="m9 14 2 2 4-4"></path></svg>
    )
  },
  leave: {
    name: 'Xin nghỉ',
    color: 'rgb(239, 68, 68)',
    bg: 'rgba(239, 68, 68, 0.1)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-x" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="17" x2="22" y1="8" y2="13"></line><line x1="22" x2="17" y1="8" y2="13"></line></svg>
    )
  },
  salary: {
    name: 'Lương & Thưởng',
    color: 'rgb(245, 158, 11)',
    bg: 'rgba(245, 158, 11, 0.1)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dollar-sign" aria-hidden="true"><line x1="12" x2="12" y1="2" y2="22"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
    )
  },
  other: {
    name: 'Khác',
    color: 'rgb(107, 114, 128)',
    bg: 'rgba(107, 114, 128, 0.1)',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
    )
  }
};

function getNotificationCategory(item: Notification): keyof typeof categoriesMap {
  const titleLower = item.title.toLowerCase();
  const typeLower = item.type.toLowerCase();
  
  if (
    typeLower.includes('exam') || 
    typeLower.includes('check_cong_feedback') ||
    typeLower.includes('explanation') || 
    titleLower.includes('giám khảo') || 
    titleLower.includes('phúc khảo') ||
    titleLower.includes('khảo thí')
  ) {
    return 'examiner';
  }
  
  if (
    typeLower.includes('leave') || 
    titleLower.includes('xin nghỉ') || 
    titleLower.includes('nghỉ dạy') ||
    titleLower.includes('nghỉ 1 buổi') ||
    titleLower.includes('hủy dạy')
  ) {
    return 'leave';
  }
  
  if (
    typeLower.includes('salary') || 
    typeLower.includes('deal') || 
    titleLower.includes('deal lương') ||
    titleLower.includes('lương') ||
    titleLower.includes('thưởng')
  ) {
    return 'salary';
  }
  
  if (
    typeLower.includes('shift') || 
    typeLower.includes('schedule') || 
    titleLower.includes('trực') || 
    titleLower.includes('dạy thay') ||
    titleLower.includes('lớp') || 
    titleLower.includes('tham gia') ||
    titleLower.includes('xác nhận')
  ) {
    return 'shift';
  }
  
  return 'other';
}

// Format date in DD/MM/YYYY format
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Format date in HH:MM DD/MM/YYYY format for detailed notifications (e.g. Leave Requests)
function formatDateWithTime(dateString: string): string {
  const date = new Date(dateString);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${min} ${dd}/${mm}/${yyyy}`;
}

// Clean and format JavaScript Date string representations inside notification content
function formatContentText(text: string): string {
  if (!text) return '';
  
  const jsDateRegex = /[A-Z][a-z]{2}\s[A-Z][a-z]{2}\s\d{1,2}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT[+-]\d{2,4}(?::\d{2})?(?:\s\([^)]+\))?/g;
  
  let formatted = text.replace(jsDateRegex, (match) => {
    try {
      const d = new Date(match);
      if (isNaN(d.getTime())) return match;
      
      const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const dayName = dayNames[d.getDay()];
      const dateStr = String(d.getDate()).padStart(2, '0');
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const yearStr = d.getFullYear();
      
      return `${dayName} ${dateStr}/${monthStr}/${yearStr}`;
    } catch {
      return match;
    }
  });

  const isoDateRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;
  formatted = formatted.replace(isoDateRegex, (match) => {
    try {
      const d = new Date(match);
      if (isNaN(d.getTime())) return match;
      const dateStr = String(d.getDate()).padStart(2, '0');
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const yearStr = d.getFullYear();
      return `${dateStr}/${monthStr}/${yearStr}`;
    } catch {
      return match;
    }
  });
  
  return formatted;
}

export default function AdminNotificationCenterPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useQueryState<'all' | 'unread' | 'read' | 'settings'>('tab', 'all', { values: ["all","unread","read","settings"], history: 'push' });
  const [activeCategory, setActiveCategory] = useQueryState<'all' | keyof typeof categoriesMap>('category', 'all', {values:['all', ...Object.keys(categoriesMap)]});

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('settings') === 'device') {
      setActiveTab('settings');
    }
  }, []);

  const [busyNotificationId, setBusyNotificationId] = useState<number | null>(null);

  const fetcher = useMemo(
    () => async (url: string) => {
      const response = await fetch(url, { headers: authHeaders(token) });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || 'Không thể tải dữ liệu thông báo');
      }
      return data;
    },
    [token]
  );

  const {
    data: notificationsData,
    mutate: mutateNotifications,
    error: notificationsError,
    isLoading: isNotificationsLoading,
  } = useSWR(
    user?.email ? '/api/notifications?limit=100' : null,
    fetcher
  );

  const { data: unreadData, mutate: mutateUnread } = useSWR(
    user?.email ? '/api/notifications/unread-count' : null,
    fetcher,
    {
      refreshInterval: NOTIFICATION_COUNT_REFRESH_MS,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      dedupingInterval: NOTIFICATION_DEDUPING_MS,
    }
  );

  const notifications: Notification[] = notificationsData?.data || [];
  const unreadCount = unreadData?.count || 0;

  const refreshNotificationData = () => {
    void mutateNotifications();
    void mutateUnread();
  };

  const resolveNotificationLink = (item: Pick<Notification, 'link' | 'type'>) => {
    const link = item.link;
    if (item.type?.toLowerCase().includes('check_cong_feedback')) {
      if (link?.startsWith('/admin/check-cong')) {
        return '/admin/check-cong?tab=feedback';
      }
      return '/user/thong-tin-giao-vien?tab=checkCongFeedback';
    }
    if (!link) return null;
    if (link === '/user/lich-cua-toi') {
      return '/user/lich-cua-toi?tab=xin-nghi';
    }
    return link;
  };

  const assertMutationSuccess = async (response: Response) => {
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success === false) {
      throw new Error(data?.error || 'Thao tác thông báo không thành công');
    }
    return data;
  };

  const handleMarkAsRead = async (id: number, link: string | null) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ id, is_read: true }),
      });
      await assertMutationSuccess(response);
      refreshNotificationData();

      const finalLink = link;
      if (finalLink) {
        router.push(finalLink);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleSetReadState = async (
    event: React.MouseEvent<HTMLButtonElement>,
    item: Notification,
    isRead: boolean,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (busyNotificationId === item.id) return;

    try {
      setBusyNotificationId(item.id);
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ id: item.id, is_read: isRead }),
      });
      await assertMutationSuccess(response);
      refreshNotificationData();
      toast.success(isRead ? 'Đã đánh dấu đã đọc' : 'Đã chuyển về chưa đọc');
    } catch (err) {
      console.error('Error updating notification read state:', err);
      toast.error('Không thể cập nhật trạng thái thông báo');
    } finally {
      setBusyNotificationId(null);
    }
  };

  const handleDeleteNotification = async (
    event: React.MouseEvent<HTMLButtonElement>,
    item: Notification,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (typeof window !== 'undefined' && !window.confirm('Xóa thông báo này?')) {
      return;
    }
    if (busyNotificationId === item.id) return;

    try {
      setBusyNotificationId(item.id);
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ id: item.id }),
      });
      await assertMutationSuccess(response);
      refreshNotificationData();
      toast.success('Đã xóa thông báo');
    } catch (err) {
      console.error('Error deleting notification:', err);
      toast.error('Không thể xóa thông báo');
    } finally {
      setBusyNotificationId(null);
    }
  };

  const handleOpenNotification = (item: Notification) => {
    if (!item.is_read) {
      void handleMarkAsRead(item.id, null);
    }

    const finalLink = resolveNotificationLink(item);
    if (finalLink) {
      router.push(finalLink);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({ all: true, is_read: true }),
      });
      await assertMutationSuccess(response);
      refreshNotificationData();
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast.error('Lỗi khi đánh dấu đã đọc');
    }
  };

  const tabFilteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'unread') return notifications.filter((n) => !n.is_read);
    if (activeTab === 'read') return notifications.filter((n) => n.is_read);
    return [];
  }, [notifications, activeTab]);

  const categoryFilteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return tabFilteredNotifications;
    return tabFilteredNotifications.filter((n) => {
      return getNotificationCategory(n) === activeCategory;
    });
  }, [tabFilteredNotifications, activeCategory]);

  const activeCategoriesInTab = useMemo(() => {
    const keys = new Set<keyof typeof categoriesMap>();
    tabFilteredNotifications.forEach((n) => {
      keys.add(getNotificationCategory(n));
    });
    const orderPriority: Array<keyof typeof categoriesMap> = ['shift', 'examiner', 'leave', 'salary', 'other'];
    return orderPriority.filter((k) => keys.has(k));
  }, [tabFilteredNotifications]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {
      all: tabFilteredNotifications.length,
      shift: 0,
      examiner: 0,
      leave: 0,
      salary: 0,
      other: 0,
    };
    tabFilteredNotifications.forEach((n) => {
      const catKey = getNotificationCategory(n);
      acc[catKey] = (acc[catKey] || 0) + 1;
    });
    return acc;
  }, [tabFilteredNotifications]);

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <PageContainer
      className="notifications-page-shell"
      title="Trung tâm thông báo (Quản lý)"
      description="Xem và quản lý các cập nhật quan trọng từ hệ thống."
    >
      <div className="page-module__Qo6x2W__pageContainer">
        
        {/* Tab Bar Container */}
        <div className="page-module__Qo6x2W__tabBar">
          <div className="page-module__Qo6x2W__tabs">
            <button
              className={`page-module__Qo6x2W__tab ${activeTab === 'all' ? 'page-module__Qo6x2W__tabActive' : ''}`}
              onClick={() => {
                setActiveTab('all');
                setActiveCategory('all');
              }}
            >
              Tất cả
            </button>
            <button
              className={`page-module__Qo6x2W__tab ${activeTab === 'unread' ? 'page-module__Qo6x2W__tabActive' : ''}`}
              onClick={() => {
                setActiveTab('unread');
                setActiveCategory('all');
              }}
            >
              Chưa đọc
              {unreadCount > 0 && (
                <span className="page-module__Qo6x2W__tabBadge">{unreadCount}</span>
              )}
            </button>
            <button
              className={`page-module__Qo6x2W__tab ${activeTab === 'read' ? 'page-module__Qo6x2W__tabActive' : ''}`}
              onClick={() => {
                setActiveTab('read');
                setActiveCategory('all');
              }}
            >
              Đã đọc
            </button>
            <button
              className={`page-module__Qo6x2W__tab ${activeTab === 'settings' ? 'page-module__Qo6x2W__tabActive' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Cài đặt
            </button>
          </div>
          
          {hasUnread && activeTab !== 'settings' && (
            <button className="page-module__Qo6x2W__markAllBtn" onClick={handleMarkAllAsRead}>
              <Check className="h-3.5 w-3.5" />
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>

        {/* Category Bar Chips */}
        {activeTab !== 'settings' && (
          <div className="page-module__Qo6x2W__categoryBar">
            <button
              className={`page-module__Qo6x2W__categoryChip ${
                activeCategory === 'all' ? 'page-module__Qo6x2W__categoryChipActive' : ''
              }`}
              onClick={() => setActiveCategory('all')}
            >
              Tất cả loại
              <span className="page-module__Qo6x2W__chipCount">{counts.all}</span>
            </button>

            {activeCategoriesInTab.map((catKey) => {
              const cat = categoriesMap[catKey];
              return (
                <button
                  key={catKey}
                  className={`page-module__Qo6x2W__categoryChip ${
                    activeCategory === catKey ? 'page-module__Qo6x2W__categoryChipActive' : ''
                  }`}
                  onClick={() => setActiveCategory(catKey)}
                >
                  <span className="page-module__Qo6x2W__chipIcon" style={{ color: cat.color }}>
                    {cat.icon}
                  </span>
                  {cat.name}
                  <span className="page-module__Qo6x2W__chipCount">{counts[catKey]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Dynamic Display Panel */}
        <div className="page-module__Qo6x2W__listPanel">
          {activeTab === 'settings' ? (
            <div className="page-module__Qo6x2W__settingsPanel">
              <h3 className="page-module__Qo6x2W__settingsTitle">Cấu hình thông báo</h3>
              <p className="page-module__Qo6x2W__settingsDesc">
                Thiết lập cách thức bạn nhận các thông tin cập nhật mới nhất từ hệ thống.
              </p>

              <div className="space-y-1">
                {/* In-app Notification Setting */}
                <div className="page-module__Qo6x2W__settingRow">
                  <div className="page-module__Qo6x2W__settingInfo">
                    <span className="page-module__Qo6x2W__settingLabel">Thông báo trong ứng dụng</span>
                    <span className="page-module__Qo6x2W__settingSub">
                      Hiển thị chấm đỏ và danh sách thông báo trên thanh tiện ích của giao diện ứng dụng.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-not-allowed opacity-80">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={true}
                      disabled={true}
                      readOnly
                    />
                    <div className="w-11 h-6 bg-[#a1001f] rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[22px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>

                <DevicePushSetting />
              </div>
            </div>
          ) : (
            <div className="page-module__Qo6x2W__notificationList">
              {notificationsError ? (
                <div className="p-16 text-center text-sm text-gray-500">
                  <p>Không tải được danh sách thông báo.</p>
                  <button
                    type="button"
                    className="mt-3 rounded-lg border border-[#a1001f]/30 px-3 py-1.5 text-xs font-semibold text-[#a1001f] hover:bg-[#a1001f]/5"
                    onClick={() => void mutateNotifications()}
                  >
                    Tải lại
                  </button>
                </div>
              ) : isNotificationsLoading && notifications.length === 0 ? (
                <div className="p-16 text-center text-sm text-gray-500">
                  Đang tải thông báo...
                </div>
              ) : categoryFilteredNotifications.length === 0 ? (
                <div className="p-16 text-center text-sm text-gray-500">
                  Không tìm thấy thông báo nào trong danh mục này.
                </div>
              ) : (
                categoryFilteredNotifications.map((item) => {
                  const catKey = getNotificationCategory(item);
                  const cat = categoriesMap[catKey];
                  
                  const isLeave = catKey === 'leave';
                  const formattedTime = isLeave ? formatDateWithTime(item.created_at) : formatDate(item.created_at);

                  return (
                    <div
                      key={item.id}
                      className={`page-module__Qo6x2W__notificationItem ${
                        !item.is_read ? 'page-module__Qo6x2W__unread' : ''
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenNotification(item)}
                      onKeyDown={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenNotification(item);
                        }
                      }}
                    >
                      <div
                        className="page-module__Qo6x2W__notifIconWrapper"
                        style={{ background: cat.bg, color: cat.color }}
                      >
                        {cat.icon}
                      </div>

                      <div className="page-module__Qo6x2W__notifContent">
                        <div className="page-module__Qo6x2W__notifHeader">
                          <div className="page-module__Qo6x2W__notifTitleRow">
                            <h4 className="page-module__Qo6x2W__notifTitle">{item.title}</h4>
                            <span
                              className="page-module__Qo6x2W__categoryLabel"
                              style={{ color: cat.color, background: cat.bg }}
                            >
                              {cat.name}
                            </span>
                           </div>
                           <span className="page-module__Qo6x2W__notifTime">
                             {formattedTime}
                           </span>
                        </div>
                        
                        <p className="page-module__Qo6x2W__notifBody">
                          {formatContentText(item.content)}
                        </p>
                        
                        {item.link && (
                          <span className="page-module__Qo6x2W__notifLink">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
                            Xem chi tiết
                          </span>
                        )}
                      </div>

                      <div className="page-module__Qo6x2W__notifActions">
                        <button
                          type="button"
                          className="page-module__Qo6x2W__notifActionBtn"
                          title={item.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                          aria-label={item.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                          disabled={busyNotificationId === item.id}
                          onClick={(event) => handleSetReadState(event, item, !item.is_read)}
                        >
                          {item.is_read ? (
                            <Undo2 className="h-3.5 w-3.5" />
                          ) : (
                            <MailOpen className="h-3.5 w-3.5" />
                          )}
                          <span className="page-module__Qo6x2W__notifActionText">
                            {item.is_read ? 'Chưa đọc' : 'Đã đọc'}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="page-module__Qo6x2W__notifActionBtn page-module__Qo6x2W__notifActionDanger"
                          title="Xóa thông báo"
                          aria-label="Xóa thông báo"
                          disabled={busyNotificationId === item.id}
                          onClick={(event) => handleDeleteNotification(event, item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="page-module__Qo6x2W__notifActionText">
                            Xóa
                          </span>
                        </button>
                      </div>

                      {!item.is_read && (
                        <div className="page-module__Qo6x2W__unreadDot"></div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>
    </PageContainer>
  );
}
