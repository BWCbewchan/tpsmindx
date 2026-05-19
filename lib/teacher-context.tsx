"use client";

import { authHeaders } from '@/lib/auth-headers';
import {
  createHttpError,
  isTransientFetchError,
  parseJsonSafe,
} from '@/lib/auth-error-handling';
import { parseLegacyTeacherFromInfoJson } from '@/lib/teacher-db-mapper';
import { Teacher } from '@/types/teacher';
import { createContext, useContext, useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from './auth-context';
import { logger } from './logger';

interface TeacherContextType {
  teacherProfile: Teacher | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  currentBranch: string | null;
  currentCode: string | null;
}

const TeacherContext = createContext<TeacherContextType>({
  teacherProfile: null,
  isLoading: true,
  refreshProfile: async () => {},
  currentBranch: null,
  currentCode: null,
});

export const useTeacher = () => useContext(TeacherContext);

async function teacherInfoFetcher([url, token]: readonly [string, string | null]) {
  const res = await fetch(url, { headers: authHeaders(token) });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw createHttpError('Teacher info request failed', res, data);
  }
  return data;
}

export function TeacherProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();

  const swrKey = user?.email
    ? ([
        `/api/teachers/info?email=${encodeURIComponent(user.email)}`,
        token,
      ] as const)
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    teacherInfoFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 120_000,
      shouldRetryOnError: isTransientFetchError,
      errorRetryCount: 2,
      errorRetryInterval: 3_000,
    },
  );

  const teacherProfile = useMemo((): Teacher | null => {
    if (!data) return null;
    try {
      const parsed = parseLegacyTeacherFromInfoJson(data);
      return parsed?.teacher ?? null;
    } catch {
      return null;
    }
  }, [data]);

  if (error) {
    logger.warn('Teacher profile fetch error', { error });
  }

  const transientProfileError = Boolean(error && isTransientFetchError(error));

  const value = useMemo(
    () => ({
      teacherProfile,
      isLoading:
        Boolean(user?.email) &&
        (isLoading || (transientProfileError && !data && isValidating)),
      refreshProfile: async () => {
        await mutate();
      },
      currentBranch: teacherProfile?.branchCurrent || null,
      currentCode: teacherProfile?.code || null,
    }),
    [
      teacherProfile,
      user?.email,
      isLoading,
      transientProfileError,
      data,
      isValidating,
      mutate,
    ],
  );

  return (
    <TeacherContext.Provider value={value}>{children}</TeacherContext.Provider>
  );
}
