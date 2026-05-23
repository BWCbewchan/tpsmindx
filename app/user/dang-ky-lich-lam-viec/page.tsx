import { redirect } from 'next/navigation'

export default function DangKyLichLamViecRedirect() {
  redirect('/user/lich-cua-toi?tab=lich')
}