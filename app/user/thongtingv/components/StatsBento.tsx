'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Award, Clock, Star } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import CountUp from 'react-countup';

interface StatsBentoProps {
  expertise: Record<string, string>;
  experience: Record<string, string>;
}

export default function StatsBento({ expertise, experience }: StatsBentoProps) {
  // Process data for charts
  const processData = (data: Record<string, string>) => {
    return Object.entries(data)
      .map(([date, score]) => ({
        date,
        score: parseFloat(score) || 0
      }))
      .sort((a, b) => {
        // Simple month/year sort
        const [mA, yA] = a.date.split('/').map(Number);
        const [mB, yB] = b.date.split('/').map(Number);
        return yA !== yB ? yA - yB : mA - mB;
      });
  };

  const expertiseData = processData(expertise);
  const experienceData = processData(experience);

  const currentExpertise = expertiseData[expertiseData.length - 1]?.score || 0;
  const currentExperience = experienceData[experienceData.length - 1]?.score || 0;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
    >
      {/* Expertise Score */}
      <motion.div variants={item} className="col-span-1 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/20 p-2 text-blue-400">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white/90">Chuyên môn chuyên sâu</h3>
          </div>
          <div className="text-3xl font-bold text-blue-400">
            <CountUp end={currentExpertise} decimals={0} duration={2} />
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={expertiseData}>
              <defs>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#3b82f6' }}
              />
              <Area type="monotone" dataKey="score" stroke="#3b82f6" fillOpacity={1} fill="url(#colorExp)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Experience Score */}
      <motion.div variants={item} className="col-span-1 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/20 p-2 text-purple-400">
              <Star className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white/90">Kỹ năng & Trải nghiệm</h3>
          </div>
          <div className="text-3xl font-bold text-purple-400">
            <CountUp end={currentExperience} decimals={0} duration={2} />
          </div>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={experienceData}>
              <defs>
                <linearGradient id="colorSkill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#a855f7' }}
              />
              <Area type="monotone" dataKey="score" stroke="#a855f7" fillOpacity={1} fill="url(#colorSkill)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Summary Mini Cards */}
      <motion.div variants={item} className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-400 w-fit">
          <Clock className="h-5 w-5" />
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-white/50 uppercase tracking-wider">Cập nhật gần nhất</p>
          <p className="text-xl font-bold text-white">Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</p>
        </div>
      </motion.div>

      <motion.div variants={item} className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="rounded-xl bg-orange-500/20 p-2 text-orange-400 w-fit">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-white/50 uppercase tracking-wider">Trạng thái phát triển</p>
          <p className="text-xl font-bold text-white">Tăng trưởng tốt</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
