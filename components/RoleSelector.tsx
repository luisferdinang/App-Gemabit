import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { supabaseService } from '../services/supabaseService';
import { Lock, User as UserIcon, GraduationCap, Baby, KeyRound, ShieldCheck, UserPlus, LogIn, CheckCircle2, Info } from 'lucide-react';

interface RoleSelectorProps {
  onLogin: (user: User) => void;
}

// COLECCIÓN DE ROBOTS PARA NIÑOS (12 Opciones)
// Estilo: bottts (Divertidos, coloridos, sin expresiones tristes)
export const STUDENT_AVATARS = [
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Gizmo", name: "Gizmo" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Felix", name: "Felix" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Bubba", name: "Bubba" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Cuddles", name: "Cuddles" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Rock", name: "Rock" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Zoe", name: "Zoe" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Bear", name: "Bear" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Jack", name: "Jack" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Luka", name: "Luka" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Sassy", name: "Sassy" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Coco", name: "Coco" },
  { url: "https://api.dicebear.com/9.x/bottts/svg?seed=Lucky", name: "Lucky" },
];

// COLECCIÓN DE PERSONAS PARA PADRES (8 Opciones)
// Estilo: micah (Moderno, limpio, profesional)
export const PARENT_AVATARS = [
  { url: "https://api.dicebear.com/9.x/micah/svg?seed=George", name: "Papá 1" },
  { url: "https://api.dicebear.com/9.x/micah/svg?seed=Leah", name: "Mamá 1" },
  { url: "https://api.dicebear.com/9.x/micah/svg?seed=Christopher", name: "Papá 2" },
  { url: "https://api.dicebear.com/9.x/micah/svg?seed=Jessica", name: "Mamá 2" },
  { url: "https://api.dicebear.com/9.x/micah/svg?seed=Sawyer", name: "Papá 3" },
  { url: "https://api.dicebear.com/9.x/micah/svg?seed=Emery", name: "Mamá 3" },
  { url: "https://api.dicebear.com/9.x/micah/svg?seed=Dale", name: "Papá 4" },
  { url: "https://api.dicebear.com/9.x/micah/svg?seed=Ariel", name: "Mamá 4" },
];

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [activeTab, setActiveTab] = useState<UserRole>('ALUMNO');
  
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(STUDENT_AVATARS[0].url);
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setFullName('');
    setSecurityCode('');
    setError('');
    setSuccessMsg('');
    // Reset avatar based on current tab
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
      // Automatically select the first avatar of the new list to avoid showing a robot for a parent
      if (role === 'ALUMNO') {
          setSelectedAvatar(STUDENT_AVATARS[0].url);
      } else if (role === 'PADRE') {
          setSelectedAvatar(PARENT_AVATARS[0].url);
      }
      resetForm();
      setActiveTab(role); // Re-set because resetForm clears it if not handled carefully, though here resetForm uses activeTab so order matters or we pass it.
      // Actually resetForm reads state, so let's set state then update avatar manually
  };

  const TabButton = ({ role, icon: Icon, label }: { role: UserRole; icon: any; label: string }) => (
    <button
      type="button"
      onClick={() => handleTabChange(role)}
      className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-3xl border-b-4 transition-all duration-200 active:scale-95 ${
        activeTab === role
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl border-b-8 border-slate-200 overflow-hidden">
        <div className="bg-violet-500 p-8 text-center relative overflow-hidden">
           <div className="relative z-10 flex flex-col items-center">
             <img 
                src="https://i.ibb.co/kVhqQ0K9/gemabit.png" 
                alt="Gemabit Logo" 
                className="w-28 h-28 object-contain mb-2 drop-shadow-xl hover:scale-105 transition-transform duration-300 animate-float"
             />
             <h1 className="text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md">Gemabit</h1>
             <p className="text-violet-100 font-bold text-sm">¡Aprende y Gana!</p>
           </div>
           
           <div className="absolute top-4 right-4 z-20">
              <button 
                onClick={() => {
                  setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                  resetForm();
                }}
                className="text-xs font-bold bg-white/20 text-white px-3 py-1 rounded-full hover:bg-white/30 transition-colors border-2 border-white/20"
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
                    Elige tu Personaje ({activeTab === 'ALUMNO' ? 'Robots' : 'Avatar'})
                 </label>
                 <div className="grid grid-cols-4 gap-2 mb-4 max-h-48 overflow-y-auto pr-1">
                    {currentAvatarOptions.map((option) => (
                      <button
                        key={option.url}
                        type="button"
                        onClick={() => setSelectedAvatar(option.url)}
                        className={`relative rounded-2xl aspect-square p-1 border-4 transition-all flex items-center justify-center ${
                          selectedAvatar === option.url 
                            ? 'border-violet-500 scale-110 shadow-lg bg-violet-50 z-10' 
                            : 'border-slate-100 hover:border-slate-300'
                        }`}
                      >
                         <img src={option.url} alt={option.name} className="w-full h-full object-contain" />
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl py-3 px-4 pl-10 font-bold text-slate-700 focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
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
    </div>
  );
};