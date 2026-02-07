import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabaseService } from '../services/supabaseService';
import { Lock, User as UserIcon, GraduationCap, Baby, KeyRound, ShieldCheck, UserPlus, LogIn, CheckCircle2, Info, Download, Share, PlusSquare, X, Smartphone, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { TutorialModal } from './TutorialModal';

interface RoleSelectorProps {
  onLogin: (user: User) => void;
}

// COLECCIÓN DE ROBOTS PARA NIÑOS (12 Opciones: 6 Estilo Masculino/Neutro, 6 Estilo Femenino/Neutro)
export const STUDENT_AVATARS = [
  // Grupo A: Tonos Azules/Grises/Neutros
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Gizmo", name: "Gizmo" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Felix", name: "Felix" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Tank", name: "Tank" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Rock", name: "Rock" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Buster", name: "Buster" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Ziggy", name: "Ziggy" },

  // Grupo B: Tonos Rosas/Morados/Cálidos
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Lola", name: "Lola" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Kiki", name: "Kiki" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Bella", name: "Bella" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Coco", name: "Coco" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Mimi", name: "Mimi" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Sassy", name: "Sassy" },
];

// COLECCIÓN DE OBJETOS 3D PARA PADRES (CDN Optimizado para evitar errores de carga)
const FLUENT_CDN = "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Animated-Fluent-Emojis@master/Emojis";

export const PARENT_AVATARS = [
  // Masculinos / Neutros (Deportes, Gaming, Coches)
  { url: `${FLUENT_CDN}/Activities/Soccer%20ball.png`, name: "Fútbol" },
  { url: `${FLUENT_CDN}/Activities/Video%20game.png`, name: "Gamer" },
  { url: `${FLUENT_CDN}/Travel%20and%20places/Automobile.png`, name: "Coche" },
  { url: `${FLUENT_CDN}/Objects/Necktie.png`, name: "Corbata" },
  { url: `${FLUENT_CDN}/Activities/Trophy.png`, name: "Campeón" },
  { url: `${FLUENT_CDN}/Objects/Guitar.png`, name: "Música" },

  // Femeninos / Neutros (Moda, Joyas, Belleza)
  { url: `${FLUENT_CDN}/Objects/Lipstick.png`, name: "Labial" },
  { url: `${FLUENT_CDN}/Objects/Handbag.png`, name: "Bolso" },
  { url: `${FLUENT_CDN}/Objects/High-heeled%20shoe.png`, name: "Tacones" },
  { url: `${FLUENT_CDN}/Objects/Gem%20stone.png`, name: "Diamante" },
  { url: `${FLUENT_CDN}/Objects/Crown.png`, name: "Reina" },
  { url: `${FLUENT_CDN}/Objects/Ring.png`, name: "Anillo" },
];

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [activeTab, setActiveTab] = useState<UserRole>('ALUMNO');

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // New state for password visibility
  const [fullName, setFullName] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(STUDENT_AVATARS[0].url);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // 1. Detect Install State
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // 2. Detect iOS
    const isIOSDevice =
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
      !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 3. Check for Global Deferred Prompt
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    // 4. Listen for PWA Ready Event
    const handlePwaReady = () => {
      setDeferredPrompt((window as any).deferredPrompt);
    };
    window.addEventListener('pwa-ready', handlePwaReady);

    return () => {
      window.removeEventListener('pwa-ready', handlePwaReady);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setFullName('');
    setSecurityCode('');
    setError('');
    setSuccessMsg('');
    setSelectedAvatar(activeTab === 'ALUMNO' ? STUDENT_AVATARS[0].url : PARENT_AVATARS[0].url);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { user, error: authError } = await supabaseService.login(username, password);

      if (authError) {
        setError(authError);
      } else if (user) {
        onLogin(user);
      }
    } catch (err) {
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (activeTab === 'MAESTRA') {
      setError('El registro de nuevas maestras está bloqueado por seguridad.');
      setLoading(false);
      return;
    }

    try {
      const result = await supabaseService.register({
        username,
        password,
        displayName: fullName,
        role: activeTab,
        avatar: selectedAvatar
      }, securityCode);

      if (result.success) {
        setSuccessMsg('¡Cuenta enviada! La maestra debe aprobarte antes de que puedas entrar.');
        setTimeout(() => {
          setMode('LOGIN');
          setSuccessMsg('');
          resetForm();
        }, 4000);
      } else {
        setError(result.error || 'Error al registrarse');
      }
    } catch (err) {
      setError('Error del servidor: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (role: UserRole) => {
    setActiveTab(role);
    if (role === 'ALUMNO') {
      setSelectedAvatar(STUDENT_AVATARS[0].url);
    } else if (role === 'PADRE') {
      setSelectedAvatar(PARENT_AVATARS[0].url);
    }
    resetForm();
    setActiveTab(role);
  };

  const TabButton = ({ role, icon: Icon, label }: { role: UserRole; icon: any; label: string }) => (
    <button
      type="button"
      onClick={() => handleTabChange(role)}
      className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-3xl border-b-4 transition-all duration-200 active:scale-95 ${activeTab === role
          ? 'bg-white border-violet-500 text-violet-600 shadow-md'
          : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-100'
        }`}
    >
      <Icon size={24} strokeWidth={3} />
      <span className="font-extrabold text-[10px] sm:text-xs tracking-wide">{label}</span>
    </button>
  );

  const currentAvatarOptions = activeTab === 'PADRE' ? PARENT_AVATARS : STUDENT_AVATARS;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans relative">
      {/* TUTORIAL MODAL */}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl border-b-8 border-slate-200 overflow-hidden relative z-10">
        <div className="bg-violet-500 p-8 text-center relative overflow-hidden">

          {/* INSTALL BUTTON */}
          {(!isInstalled && (deferredPrompt || isIOS)) && (
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={handleInstallClick}
                className="text-xs font-black bg-white/20 text-white px-3 py-1.5 rounded-full hover:bg-white/30 transition-all border-2 border-white/20 flex items-center gap-1.5 animate-bounce-slow"
              >
                <Download size={14} strokeWidth={3} />
                INSTALAR APP
              </button>
            </div>
          )}

          {/* TUTORIAL TRIGGER BUTTON */}
          <div className="absolute top-4 left-4 z-20 md:left-auto md:right-32 lg:right-32">
            <button
              onClick={() => setShowTutorial(true)}
              className="text-white bg-white/20 hover:bg-white/30 rounded-full p-1.5 transition-colors border-2 border-white/20"
              title="¿Cómo funciona?"
            >
              <HelpCircle size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <img
              src="https://i.ibb.co/kVhqQ0K9/gemabit.png"
              alt="Gemabit Logo"
              className="w-28 h-28 object-contain mb-2 drop-shadow-xl hover:scale-105 transition-transform duration-300 animate-float"
            />
            <h1 className="text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md">Gemabit</h1>
            <p className="text-violet-100 font-bold text-sm">Ahorra, aprende y gana</p>
          </div>

          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={() => {
                setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                resetForm();
              }}
              className="text-xs font-bold bg-white/20 text-white px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors border-2 border-white/20"
            >
              {mode === 'LOGIN' ? 'Crear Cuenta' : 'Tengo Cuenta'}
            </button>
          </div>
        </div>

        {mode === 'REGISTER' && (
          <div className="flex px-2 pt-4 gap-2 bg-slate-50 pb-2">
            <TabButton role="ALUMNO" icon={Baby} label="ALUMNO" />
            <TabButton role="PADRE" icon={UserIcon} label="PADRE" />
          </div>
        )}

        <div className="p-8 pt-6">
          <form onSubmit={mode === 'LOGIN' ? handleLogin : handleRegister} className="space-y-5">

            {mode === 'REGISTER' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase text-center">
                    Elige tu Personaje ({activeTab === 'ALUMNO' ? 'Robots' : 'Objetos'})
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-4 max-h-48 overflow-y-auto pr-1">
                    {currentAvatarOptions.map((option) => (
                      <button
                        key={option.url}
                        type="button"
                        onClick={() => setSelectedAvatar(option.url)}
                        className={`relative rounded-2xl aspect-square p-2 border-4 transition-all flex items-center justify-center ${selectedAvatar === option.url
                            ? 'border-violet-500 scale-110 shadow-lg bg-violet-50 z-10'
                            : 'border-slate-100 hover:border-slate-300 bg-slate-50'
                          }`}
                      >
                        <img src={option.url} alt={option.name} className="w-full h-full object-contain drop-shadow-sm" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 uppercase pl-2">Nombre Completo</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl py-3 px-4 pl-10 font-bold text-slate-700 focus:outline-none focus:border-violet-500 transition-colors"
                      placeholder="Ej. Juan Pérez"
                      required
                    />
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase pl-2">Usuario</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl py-3 px-4 pl-10 font-bold text-slate-700 focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="Tu nombre de usuario"
                  required
                />
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase pl-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl py-3 px-4 pl-10 pr-10 font-bold text-slate-700 focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {mode === 'REGISTER' && (
              <div className="pt-2">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center">
                  <label className="block text-xs font-bold text-amber-600 mb-1 uppercase">Código Especial</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={securityCode}
                      onChange={(e) => setSecurityCode(e.target.value)}
                      className="w-full bg-white border-2 border-amber-200 rounded-xl py-2 px-4 pl-10 font-bold text-slate-700 focus:border-amber-500 transition-colors text-sm text-center"
                      placeholder="Ingresa el código secreto"
                      required
                    />
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={18} />
                  </div>
                  <p className="text-[10px] text-amber-600/70 mt-2 font-bold uppercase tracking-tight">
                    Solicita este código a tu Maestra para unirte.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl text-xs font-bold text-center border-2 border-red-200 animate-pulse">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-100 text-green-700 rounded-2xl text-xs font-bold text-center border-2 border-green-200">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 active:translate-y-1 active:border-b-0 text-white font-black py-4 rounded-2xl border-b-[6px] border-green-700 uppercase tracking-widest transition-all disabled:opacity-50 mt-6 flex items-center justify-center gap-2"
            >
              {loading ? 'Cargando...' : mode === 'LOGIN' ? '¡Entrar!' : 'Registrarse'}
            </button>
          </form>
        </div>
      </div>

      {/* IOS INSTRUCTION MODAL */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-6 relative shadow-2xl border-4 border-slate-200">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Smartphone size={32} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Instalar en iOS</h3>
              <p className="text-xs text-slate-400 font-bold mt-1">Sigue estos pasos para instalar la App</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border-2 border-slate-100">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 bg-white rounded-full border-2 border-slate-200 flex items-center justify-center font-black text-xs text-slate-500 shrink-0">1</span>
                <p className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  Toca el botón <Share size={14} className="text-sky-500" /> Compartir
                </p>
              </div>
              <div className="w-full h-px bg-slate-200"></div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 bg-white rounded-full border-2 border-slate-200 flex items-center justify-center font-black text-xs text-slate-500 shrink-0">2</span>
                <p className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  Busca <PlusSquare size={14} className="text-sky-500" /> "Añadir a inicio"
                </p>
              </div>
            </div>

            <button onClick={() => setShowIOSModal(false)} className="w-full mt-4 bg-slate-800 text-white font-black py-3 rounded-xl">Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
};