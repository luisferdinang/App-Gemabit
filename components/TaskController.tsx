import React, { useEffect, useState } from 'react';
import { TaskLog, TaskType } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { soundService } from '../services/soundService';
import { Check, Star, BookOpen, CalendarCheck, HandHeart, Sparkles, UserCheck, Trash2, Home, School } from 'lucide-react';

interface TaskControllerProps {
  studentId: string;
  allowedType: TaskType;
  readOnly?: boolean;
  weekId?: string;
  onUpdate?: () => void; // New prop for immediate feedback
}

// Icon mapping helper
const getTaskIcon = (key: string) => {
  const k = key.toUpperCase();
  if (k.includes('ATTENDANCE')) return <CalendarCheck size={28} />;
  if (k.includes('RESPONSIBILITY') || k.includes('CHORES')) return <Sparkles size={28} />;
  if (k.includes('BEHAVIOR') || k.includes('RESPECT')) return <HandHeart size={28} />;
  if (k.includes('PARTICIPATION')) return <UserCheck size={28} />;
  if (k.includes('READING') || k.includes('STUDY')) return <BookOpen size={28} />;
  if (k.includes('HYGIENE')) return <Star size={28} />;
  return <Star size={28} />;
};

// Label mapping helper for Spanish
const getTaskLabel = (key: string) => {
  const map: Record<string, string> = {
    'ATTENDANCE': 'Asistencia',
    'RESPONSIBILITY': 'Responsabilidad',
    'BEHAVIOR': 'Comportamiento',
    'RESPECT': 'Respeto',
    'PARTICIPATION': 'Participación',
    'CHORES': 'Quehaceres',
    'HYGIENE': 'Higiene',
    'READING': 'Lectura/Estudio'
  };
  return map[key] || key;
};

export const TaskController: React.FC<TaskControllerProps> = ({ studentId, allowedType, readOnly = false, weekId, onUpdate }) => {
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);

  const currentWeek = weekId || getCurrentWeekId();

  useEffect(() => {
    load();
  }, [studentId, currentWeek]);

  const load = async () => {
    const t = await supabaseService.getTasks(studentId, currentWeek);
    setTasks(t.filter(task => task.type === allowedType));
  };

  const toggleTask = async (taskType: TaskType, key: string, currentValue: boolean) => {
    if (readOnly) return;
    
    // Sound Effect based on action
    if (!currentValue) {
        soundService.playSuccess();
    } else {
        soundService.playPop();
    }

    setLoading(true);
    setAnimatingKey(key);
    
    // Simulate a small delay for animation feel
    setTimeout(async () => {
        await supabaseService.updateTaskStatus(studentId, taskType, key, !currentValue, currentWeek);
        await load();
        if (onUpdate) onUpdate(); // Notify parent immediately
        setLoading(false);
        setAnimatingKey(null);
    }, 300);
  };

  if (tasks.length === 0) return <div className="p-4 text-center text-slate-400 font-bold">Sin tareas asignadas</div>;

  const baseColor = allowedType === 'SCHOOL' ? 'violet' : 'emerald';

  return (
    <div className="space-y-4">
      {tasks.map(task => (
        <div key={task.id} className="">
          {/* Header hidden as it will be handled by parent components usually, but keeping grid */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(task.status).map(([key, completed]) => {
               const isAnimating = animatingKey === key;
               
               return (
                <button
                  key={key}
                  disabled={loading || readOnly}
                  onClick={() => toggleTask(task.type, key, completed as boolean)}
                  className={`
                    relative overflow-hidden rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all duration-300 border-b-4
                    ${readOnly ? 'cursor-default' : 'cursor-pointer active:scale-95 hover:brightness-105'}
                    ${completed 
                        ? `bg-${baseColor}-500 border-${baseColor}-700 text-white shadow-${baseColor}-200 shadow-lg` 
                        : 'bg-white border-slate-200 text-slate-400 shadow-sm hover:border-slate-300'
                    }
                  `}
                >
                  {/* Background Burst Animation Effect */}
                  {isAnimating && (
                      <div className="absolute inset-0 bg-white/30 animate-ping rounded-full"></div>
                  )}

                  <div className={`
                    p-3 rounded-full transition-transform duration-300
                    ${completed ? 'bg-white/20 scale-110 rotate-0' : 'bg-slate-100 scale-100 grayscale'}
                  `}>
                    {getTaskIcon(key)}
                  </div>
                  
                  <span className={`text-xs font-black uppercase tracking-wider ${completed ? 'opacity-100' : 'opacity-70'}`}>
                    {getTaskLabel(key)}
                  </span>

                  {completed && (
                      <div className="absolute top-2 right-2">
                          <div className="bg-white text-xs font-bold text-slate-800 px-1.5 rounded-full shadow-sm">
                              +{allowedType === 'SCHOOL' ? 20 : 25}
                          </div>
                      </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};