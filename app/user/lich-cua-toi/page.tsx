'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { Tabs } from '@/components/Tabs';

import TabLichHoatDong from './components/TabLichHoatDong';
import TabNhanLop from './components/TabNhanLop';
import TabXinNghi from './components/TabXinNghi';
import TabLichLopHoc from './components/TabLichLopHoc';

const TAB_IDS = ['lich', 'lich-lop-hoc', 'xin-nghi', 'nhan-lop'] as const;
type TabId = (typeof TAB_IDS)[number];

export default function LichCuaToiPage() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') as TabId || 'lich';
  const [activeTab, setActiveTab] = useState<TabId>(currentTab);

  const tabs = [
    { id: 'lich', label: 'Lịch hoạt động' },
    { id: 'lich-lop-hoc', label: 'Lịch lớp học' },
    { id: 'xin-nghi', label: 'Xin nghỉ' },
    { id: 'nhan-lop', label: 'Nhận lớp' },
  ];

  const handleTabChange = (id: string) => {
    setActiveTab(id as TabId);
  };

  return (
    <PageContainer title="Lịch của tôi">
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      <div className="mt-6">
        {activeTab === 'lich' && <TabLichHoatDong />}
        {activeTab === 'lich-lop-hoc' && <TabLichLopHoc />}
        {activeTab === 'xin-nghi' && <TabXinNghi />}
        {activeTab === 'nhan-lop' && <TabNhanLop />}
      </div>
    </PageContainer>
  );
}