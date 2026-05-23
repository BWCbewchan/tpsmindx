'use client';

import { motion } from 'framer-motion';
import { User, Mail, Shield, MapPin, Briefcase, BadgeCheck } from 'lucide-react';
import { Teacher } from '@/types/teacher';

interface ProfileHeroProps {
  teacher: Teacher;
}

export default function ProfileHero({ teacher }: ProfileHeroProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl"
    >
      {/* Background Orbs */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative flex flex-col items-center gap-8 md:flex-row md:items-start">
        {/* Avatar Section */}
        <div className="relative">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 p-1 shadow-xl"
          >
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-900">
              <User className="h-16 w-16 text-white/90" />
            </div>
          </motion.div>
          <div className={`absolute -bottom-2 -right-2 h-6 w-6 rounded-full border-4 border-slate-900 ${teacher.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
        </div>

        {/* Info Section */}
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                {teacher.name}
              </h1>
              {teacher.status === 'Active' && (
                <BadgeCheck className="h-6 w-6 text-blue-400" />
              )}
            </div>
            <p className="mt-1 text-lg font-medium text-blue-400">
              {teacher.code} • {teacher.position}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center justify-center gap-3 rounded-xl bg-white/5 p-3 md:justify-start">
              <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
                <Mail className="h-4 w-4" />
              </div>
              <span className="text-sm truncate text-white/70">{teacher.emailMindx}</span>
            </div>

            <div className="flex items-center justify-center gap-3 rounded-xl bg-white/5 p-3 md:justify-start">
              <div className="rounded-lg bg-purple-500/20 p-2 text-purple-400">
                <MapPin className="h-4 w-4" />
              </div>
              <span className="text-sm text-white/70">{teacher.branchCurrent}</span>
            </div>

            <div className="flex items-center justify-center gap-3 rounded-xl bg-white/5 p-3 md:justify-start">
              <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
                <Briefcase className="h-4 w-4" />
              </div>
              <span className="text-sm text-white/70">{teacher.programCurrent}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/20">
              {teacher.manager}
            </span>
            <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400 ring-1 ring-inset ring-purple-500/20">
              {teacher.responsible}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
              Onboard: {teacher.startDate}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
