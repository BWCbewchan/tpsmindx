'use client';
import { AppStore, makeStore } from '@/lib/redux/store';
import { useState } from 'react';
import { Provider } from 'react-redux';

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store] = useState<AppStore>(() => makeStore());

  return <Provider store={store}>{children}</Provider>;
}
