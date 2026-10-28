'use client'
import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import { useQueryState } from './use-query-state'

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export function useQueryDate(key: string, initial: Date | (() => Date)): [Date, Dispatch<SetStateAction<Date>>] {
  const [value, setValue] = useQueryState<string>(key, () => dateKey(typeof initial === 'function' ? initial() : initial), { kind: 'date' })
  const date = useMemo(() => new Date(`${value}T12:00:00`), [value])
  const setDate = useCallback<Dispatch<SetStateAction<Date>>>((action) => {
    setValue(previous => dateKey(typeof action === 'function' ? action(new Date(`${previous}T12:00:00`)) : action))
  }, [setValue])
  return [date, setDate]
}
