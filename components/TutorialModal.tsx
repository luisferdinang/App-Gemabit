import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, School, Baby, User, Gamepad2, Coins, CheckCircle2, Home, Trophy, Wallet, ShoppingBag, Link as LinkIcon, ArrowUpCircle } from 'lucide-react';

interface TutorialModalProps {
  onClose: () => void;
}

type TutorialMode = 'SELECT' | 'STUDENT' | 'PARENT';

interface Step {
  title: string;
  desc: string;
  visual: React.ReactNode;
  color: string;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
  const [mode, setMode] = useState<TutorialMode>('SELECT');
  const [stepIndex, setStepIndex] = useState(0);

  // --- COMPONENTES VISUALES SIMULADOS PARA EL TUTORIAL ---
  
  // Simulación: Tarjeta de Tarea (Para Alumnos)
  const MockTaskCard = () => (
    <div className="bg-white rounded-2xl p-3 shadow-md border-b-4 border-slate-200 w-48 mx-auto relative transform rotate-3">
        <div className="flex justify-between items-start">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600"><Home size={20}/></div>
            <div className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-lg shadow-sm">+25 MB</div>
        </div>
        <div className="mt-2 text-left">
            <div className="h-2 w-16 bg-slate-200 rounded-full mb-1"></div>
            <div className="text-xs font-black text-slate-700">Ayudar en Casa</div>
        </div>
        <div className="absolute -right-2 -top-2 bg-white rounded-full p-1 border-2 border-emerald-100 shadow-sm"><CheckCircle2 className="text-emerald-500" size={16}/></div>
    </div>
  );

  // Simulación: Billetera (Para Alumnos)
  const MockWallet = () => (
    <div className="bg-violet-500 text-white p-4 rounded-2xl w-56 mx-auto shadow-lg shadow-violet-200 border-b-4 border-violet-700 relative overflow-hidden">
        <div className="relative z-10 text-left">
            <p className="text-[9px] font-bold uppercase opacity-80 mb-1">Tu Saldo</p>
            <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black">3</span>
                <span className="text-xs font-bold">GB</span>
                <span className="text-xl font-black ml-2">50</span>
                <span className="text-xs font-bold">MB</span>
            </div>
        </div>
        <Coins className="absolute -right-4 -bottom-4 text-violet-300 opacity-30" size={64}/>
    </div>
  );

  // Simulación: Vinculación (Para Padres)
  const MockLinking = () => (
    <div className="bg-yellow-50 p-4 rounded-2xl border-2 border-yellow-200 w-56 mx-auto text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ingresa el Código del Niño</p>
        <div className="bg-white p-2 rounded-xl border-2 border-slate-100 font-mono font-black text-xl tracking-widest text-slate-700 shadow-inner">
            102030
        </div>
        <div className="mt-3 bg-yellow-400 h-8 rounded-xl w-full flex items-center justify-center text-xs font-black text-yellow-900">VINCULAR</div>
    </div>
  );

  // Simulación: Aprobación (Para Padres)
  const MockApproval = () => (
    <div className="bg-white p-3 rounded-2xl shadow-md border-l-4 border-rose-500 w-60 mx-auto flex items-center justify-between">
        <div className="text-left">
            <p className="text-xs font-black text-slate-700">Comprar Helado</p>
            <p className="text-[10px] font-bold text-rose-500">-50 MiniBits</p>
        </div>
        <div className="flex gap-1">
            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle2 size={16}/></div>
            <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><X size={16}/></div>
        </div>
    </div>
  );

  // --- PASOS DEL TUTORIAL ---

  const STUDENT_STEPS: Step[] = [
    {
      title: "Tu Misión Diaria",
      desc: "Tienes tareas de Escuela (moradas) y de Casa (verdes). ¡Haz click para completarlas! Tus padres o maestra deben aprobarlas para que los puntos sean reales.",
      color: "bg-emerald-500",
      visual: <div className="space-y-4 pt-4"><MockTaskCard /></div>
    },
    {
      title: "Tu Dinero Mágico",
      desc: "Ganas MiniBits (MB). Cuando juntas 100 MB, se convierten automáticamente en 1 GemaBit (GB). ¡Ahorra para premios grandes!",
      color: "bg-violet-500",
      visual: <div className="pt-6"><MockWallet /></div>
    },
    {
      title: "Zona Arcade",
      desc: "¿Quieres ganar más? Entra al Arcade, juega trivias o resuelve frases. El dinero que ganas va a tu 'Bolsa' y debes pedir 'Cobrar' para usarlo.",
      color: "bg-sky-500",
      visual: (
        <div className="bg-sky-500 text-white w-40 h-40 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-xl animate-bounce-slow">
            <Gamepad2 size={64} />
        </div>
      )
    },
    {
      title: "Comprar Premios",
      desc: "Cuando quieras gastar tus monedas en la vida real (un helado, tiempo de TV), ve a 'Mis Gastos' y envía una solicitud a tus padres.",
      color: "bg-rose-500",
      visual: (
        <div className="bg-rose-100 p-6 rounded-full inline-block">
            <ShoppingBag size={48} className="text-rose-500"/>
        </div>
      )
    }
  ];

  const PARENT_STEPS: Step[] = [
    {
      title: "Conecta con tu Hijo",
      desc: "Pide a tu hijo su 'Código de Vinculación' (está en su perfil, icono naranja). Úsalo en tu panel para conectar cuentas.",
      color: "bg-yellow-500",
      visual: <div className="pt-4"><MockLinking /></div>
    },
    {
      title: "Valida en Casa",
      desc: "Tú eres el juez de las tareas del hogar. Si tu hijo marca 'Higiene' o 'Lectura', verás la tarea en tu panel. Tócala para validarla o rechazarla.",
      color: "bg-emerald-500",
      visual: (
        <div className="relative pt-2">
            <div className="bg-emerald-100 p-4 rounded-2xl flex items-center gap-3 w-56 mx-auto border-2 border-emerald-200">
                <Home className="text-emerald-600"/>
                <div className="text-left">
                    <div className="h-2 w-20 bg-emerald-200 rounded-full mb-1"></div>
                    <div className="text-xs font-bold text-emerald-700">Validar Tareas</div>
                </div>
            </div>
            <div className="absolute -right-2 top-0 bg-white p-1 rounded-full shadow-sm animate-bounce"><ArrowUpCircle className="text-emerald-500" size={24}/></div>
        </div>
      )
    },
    {
      title: "Control de Gastos",
      desc: "Cuando tu hijo quiera gastar sus ahorros, recibirás una notificación. Puedes Aprobar (se descuenta el saldo) o Rechazar la compra.",
      color: "bg-rose-500",
      visual: <div className="pt-6"><MockApproval /></div>
    },
    {
      title: "Historia Financiera",
      desc: "En 'Mi Tesoro' podrás ver gráficas de cuánto han ahorrado y gastado. ¡Enséñales el valor del dinero a largo plazo!",
      color: "bg-amber-500",
      visual: (
        <div className="bg-white p-4 rounded-2xl shadow-lg w-48 mx-auto">
            <div className="flex items-end gap-2 h-20 justify-center pb-2 border-b-2 border-slate-100">
                <div className="w-4 bg-emerald-200 h-[80%] rounded-t-lg"></div>
                <div className="w-4 bg-emerald-300 h-[60%] rounded-t-lg"></div>
                <div className="w-4 bg-emerald-400 h-[90%] rounded-t-lg"></div>
                <div className="w-4 bg-emerald-500 h-full rounded-t-lg"></div>
            </div>
            <p className="text-[10px] font-black text-center text-slate-400 mt-2">CRECIMIENTO</p>
        </div>
      )
    }
  ];

  const currentSteps = mode === 'STUDENT' ? STUDENT_STEPS : PARENT_STEPS;
  const step = currentSteps[stepIndex];

  const handleNext = () => {
    if (stepIndex < currentSteps.length - 1) {
      setStepIndex(curr => curr + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex(curr => curr - 1);
    } else {
      setMode('SELECT'); // Volver al inicio
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative border-4 border-white max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors z-30 backdrop-blur-sm"
        >
          <X size={24} strokeWidth={3} />
        </button>

        {mode === 'SELECT' ? (
            <div className="p-8 flex flex-col items-center justify-center h-full min-h-[500px] text-center bg-slate-50">
                <div className="mb-8">
                    <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-24 h-24 object-contain mx-auto mb-4 animate-float"/>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">¡Hola!</h2>
                    <p className="text-slate-500 font-bold">¿Quién va a usar la App hoy?</p>
                </div>

                <div className="grid gap-4 w-full">
                    <button 
                        onClick={() => { setMode('STUDENT'); setStepIndex(0); }}
                        className="group relative bg-white p-6 rounded-[2rem] border-4 border-emerald-100 hover:border-emerald-400 hover:shadow-xl transition-all text-left flex items-center gap-4 active:scale-95"
                    >
                        <div className="bg-emerald-100 text-emerald-600 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                            <Baby size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors">Soy Alumno</h3>
                            <p className="text-xs font-bold text-slate-400">Quiero jugar y ganar</p>
                        </div>
                        <ChevronRight className="absolute right-6 text-slate-300 group-hover:text-emerald-500" />
                    </button>

                    <button 
                        onClick={() => { setMode('PARENT'); setStepIndex(0); }}
                        className="group relative bg-white p-6 rounded-[2rem] border-4 border-sky-100 hover:border-sky-400 hover:shadow-xl transition-all text-left flex items-center gap-4 active:scale-95"
                    >
                        <div className="bg-sky-100 text-sky-600 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                            <User size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 group-hover:text-sky-600 transition-colors">Soy Representante</h3>
                            <p className="text-xs font-bold text-slate-400">Padres o Maestros</p>
                        </div>
                        <ChevronRight className="absolute right-6 text-slate-300 group-hover:text-sky-500" />
                    </button>
                </div>
            </div>
        ) : (
            <>
                {/* Dynamic Header */}
                <div className={`h-64 ${step.color} flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 shrink-0`}>
                    <div className="absolute inset-0 bg-white/10 opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/40 to-transparent scale-150 animate-pulse"></div>
                    
                    {/* Visual Container */}
                    <div className="relative z-10 transform transition-all duration-500 hover:scale-105">
                        {step.visual}
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 text-center flex-1 flex flex-col bg-white relative z-20 -mt-6 rounded-t-[2.5rem]">
                    <div className="flex-1">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-3 inline-block ${step.color.replace('bg-', 'bg-opacity-10 text-').replace('500', '600')} bg-opacity-20`}>
                            Paso {stepIndex + 1} de {currentSteps.length}
                        </span>
                        <h3 className="text-2xl font-black text-slate-800 mb-3 leading-tight">
                            {step.title}
                        </h3>
                        <p className="text-sm font-bold text-slate-500 leading-relaxed mb-6">
                            {step.desc}
                        </p>
                    </div>

                    {/* Navigation Dots */}
                    <div className="flex justify-center gap-2 mb-6">
                        {currentSteps.map((_, idx) => (
                            <div 
                            key={idx} 
                            className={`h-2 rounded-full transition-all duration-300 ${idx === stepIndex ? `w-8 ${step.color}` : 'w-2 bg-slate-200'}`}
                            />
                        ))}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between gap-4">
                        <button 
                            onClick={handlePrev}
                            className="p-4 rounded-2xl bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all active:scale-95"
                        >
                            <ChevronLeft size={24} strokeWidth={3} />
                        </button>

                        <button 
                            onClick={handleNext}
                            className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 ${stepIndex === currentSteps.length - 1 ? 'bg-slate-800 text-white border-slate-950' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}
                            style={stepIndex === currentSteps.length - 1 ? {backgroundColor: '#1e293b', borderColor: '#020617', color: 'white'} : {}}
                        >
                            {stepIndex === currentSteps.length - 1 ? (
                            <>¡Entendido! <CheckCircle2 size={18} /></>
                            ) : (
                            <>Siguiente <ChevronRight size={18} /></>
                            )}
                        </button>
                    </div>
                </div>
            </>
        )}

      </div>
    </div>
  );
};