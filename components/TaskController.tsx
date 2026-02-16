import React, { useEffect, useState } from 'react';
import { TaskLog, TaskType } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { soundService } from '../services/soundService';
import { Check, Star, BookOpen, CalendarCheck, HandHeart, Sparkles, UserCheck, Trash2, Home, School, AlertCircle, X, Loader2 } from 'lucide-react';

interface TaskControllerProps {
  studentId: string;
  allowedType: TaskType;
  readOnly?: boolean;
  weekId?: string;
  onUpdate?: () => void;
}

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
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ key: string, label: string, currentVal: boolean, reward: number } | null>(null);

  const currentWeek = weekId || getCurrentWeekId();

  useEffect(() => {
    load();
  }, [studentId, currentWeek]);

  const load = async () => {
    const t = await supabaseService.getTasks(studentId, currentWeek);
    setTasks(t.filter(task => task.type === allowedType));
  };

  // Step 1: Trigger Confirmation Modal
  const requestToggle = (key: string, currentVal: boolean) => {
    if (readOnly) return;

    // Reward Calculation: School=20, Home=25 (to maintain 100 totals logic)
    const rewardValue = allowedType === 'SCHOOL' ? 20 : 25;

    setConfirmAction({
      key,
      label: getTaskLabel(key),
      currentVal,
      reward: rewardValue
    });
  };

  // Step 2: Execute Action after Confirmation
  const executeToggle = async () => {
    if (!confirmAction || processing) return; // Prevenir doble procesamiento

    const { key, currentVal } = confirmAction;
    const newVal = !currentVal;

    setProcessing(key); // Bloquear esta tarea específica
    setLoading(true);

    // Actualización Optimista (UI responde de inmediato)
    const activeTaskId = tasks[0]?.id;
    if (activeTaskId) {
      setTasks(prevTasks => prevTasks.map(t => {
        if (t.id === activeTaskId) {
          return { ...t, status: { ...t.status, [key]: newVal } };
        }
        return t;
      }));
    }

    // Play Sound immediately for feedback
    if (newVal) soundService.playCoin();
    else soundService.playPop(); // Use pop for removal

    const result = await supabaseService.updateTaskStatus(studentId, allowedType, key, newVal, currentWeek);

    setConfirmAction(null); // Cerrar modal DESPUÉS de recibir respuesta del servidor

    // Manejar respuesta - verificar si hay error de límite
    if (result && !result.success && result.error) {
      alert(`❌ ${result.error}`);
      soundService.playPop(); // Sonido de error
    }

    await load();
    if (onUpdate) onUpdate();

    setLoading(false);
    setProcessing(null); // Desbloquear
  };

  if (tasks.length === 0) return <div className="p-4 text-center text-slate-400 font-bold">Sin tareas asignadas</div>;

  const baseColor = allowedType === 'SCHOOL' ? 'violet' : 'emerald';
  const activeTask = tasks[0];

  return (
    <>
      <div className="space-y-4">
        <div key={activeTask.id} className="">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(activeTask.status).map(([key, completed]) => {
              const rewardValue = allowedType === 'SCHOOL' ? 20 : 25;

              return (
                <button
                  key={key}
                  disabled={loading || readOnly}
                  onClick={() => requestToggle(key, completed as boolean)}
                  className={`
                      relative overflow-hidden rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-center transition-all duration-300 border-b-4
                      ${readOnly ? 'cursor-default' : 'cursor-pointer active:scale-95 hover:brightness-105'}
                      ${completed
                      ? `bg-${baseColor}-500 border-${baseColor}-700 text-white shadow-${baseColor}-200 shadow-lg`
                      : 'bg-white border-slate-200 text-slate-400 shadow-sm hover:border-slate-300'
                    }
                    `}
                >
                  <div className={`
                      p-3 rounded-full transition-transform duration-300 relative
                      ${completed ? 'bg-white/20 scale-110 rotate-0' : 'bg-slate-100 scale-100 grayscale'}
                    `}>
                    {processing === key ? (
                      <Loader2 className="animate-spin text-slate-400" size={28} />
                    ) : getTaskIcon(key)}
                  </div>

                  <span className={`text-xs font-black uppercase tracking-wider ${completed ? 'opacity-100' : 'opacity-70'}`}>
                    {getTaskLabel(key)}
                  </span>

                  {completed && (
                    <div className="absolute top-2 right-2 animate-pop">
                      <div className="bg-white text-xs font-bold text-slate-800 px-1.5 rounded-full shadow-sm flex items-center gap-0.5 border border-slate-100">
                        +{rewardValue}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-6 shadow-2xl border-4 border-white text-center relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-2 ${confirmAction.currentVal ? 'bg-red-500' : 'bg-emerald-500'}`}></div>

            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmAction.currentVal ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>
              {confirmAction.currentVal ? <AlertCircle size={32} /> : <Check size={32} strokeWidth={4} />}
            </div>

            <h3 className="text-lg font-black text-slate-800 mb-1">
              {confirmAction.currentVal ? '¿Quitar Puntos?' : '¿Aprobar Misión?'}
            </h3>
            <p className="text-slate-500 font-bold text-sm mb-6">
              {confirmAction.label}
            </p>

            <div className={`py-3 px-4 rounded-xl mb-6 font-black text-xl flex items-center justify-center gap-2 ${confirmAction.currentVal ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
              {confirmAction.currentVal ? '-' : '+'}{confirmAction.reward} MiniBits
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={loading}
                onClick={executeToggle}
                className={`flex-1 py-3 text-white font-black rounded-xl shadow-lg border-b-4 transition-all flex items-center justify-center
                                ${confirmAction.currentVal ? 'bg-red-500 border-red-700 hover:bg-red-600' : 'bg-emerald-500 border-emerald-700 hover:bg-emerald-600'}
                                ${loading ? 'opacity-70 cursor-not-allowed' : 'active:border-b-0 active:translate-y-1'}
                            `}
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (confirmAction.currentVal ? 'QUITAR' : 'APROBAR')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};