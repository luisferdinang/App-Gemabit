import React from 'react';
import { Zap, ShieldCheck, Smile, HeartHandshake, Hand, Sparkles, BookOpen, Trophy } from 'lucide-react';

export const getTaskVisuals = (key: string) => {
  const k = key.toUpperCase();
  if (k.includes('ATTENDANCE')) return { icon: <Zap size={32} />, label: 'Asistencia Rayo', color: 'bg-yellow-400 text-yellow-900 border-yellow-600' };
  if (k.includes('RESPONSIBILITY')) return { icon: <ShieldCheck size={32} />, label: 'Super Responsable', color: 'bg-blue-400 text-white border-blue-600' };
  if (k.includes('BEHAVIOR')) return { icon: <Smile size={32} />, label: 'Buen Comportamiento', color: 'bg-purple-400 text-white border-purple-600' };
  if (k.includes('RESPECT')) return { icon: <HeartHandshake size={32} />, label: 'Respeto Total', color: 'bg-pink-400 text-white border-pink-600' };
  if (k.includes('PARTICIPATION')) return { icon: <Hand size={32} />, label: 'Participación', color: 'bg-orange-400 text-white border-orange-600' };
  if (k.includes('CHORES')) return { icon: <Sparkles size={32} />, label: 'Ayuda en Casa', color: 'bg-emerald-400 text-white border-emerald-600' };
  if (k.includes('HYGIENE')) return { icon: <Sparkles size={32} />, label: 'Higiene Brillante', color: 'bg-cyan-400 text-white border-cyan-600' };
  if (k.includes('READING') || k.includes('STUDY')) return { icon: <BookOpen size={32} />, label: 'Genio Leyendo', color: 'bg-indigo-400 text-white border-indigo-600' };
  return { icon: <Trophy size={32} />, label: key, color: 'bg-slate-400 text-white border-slate-600' };
};