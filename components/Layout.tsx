
import React, { useState, useRef, useEffect } from 'react';
import { LogOut, LayoutDashboard, Settings, X, Camera, RefreshCw, Check, Smartphone, Download, Share, PlusSquare, ExternalLink, Laptop, DollarSign } from 'lucide-react';
import { User } from '../types';
import { STUDENT_AVATARS, PARENT_AVATARS } from './RoleSelector';
import { supabaseService } from '../services/supabaseService';
import { useUserStore } from '../store/userStore';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  refreshUser: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, refreshUser }) => {
  const { exchangeRate } = useUserStore(); // Get Exchange Rate from global store
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Detect Install State
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // 2. Detect iOS (iPhone, iPad, iPod, including iPads with iPadOS 13+ that act like desktops)
    const isIOSDevice = 
      (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && 
      !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 3. Check for Global Deferred Prompt (Captured in index.html)
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    // 4. Listen for PWA Ready Event (dispatched from index.html)
    const handlePwaReady = () => {
      setDeferredPrompt((window as any).deferredPrompt);
    };
    window.addEventListener('pwa-ready', handlePwaReady);

    // 5. Fallback local listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('pwa-ready', handlePwaReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!user) return <>{children}</>;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName.trim()) return;
    setLoading(true);
    const success = await supabaseService.updateDisplayName(user.uid, newDisplayName);
    if (success) {
      refreshUser();
      setShowProfileModal(false);
    }
    setLoading(false);
  };

  const handleAvatarSelect = async (url: string) => {
    setLoading(true);
    const success = await supabaseService.updateAvatar(user.uid, url);
    if (success) refreshUser();
    setLoading(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        setLoading(true);
        const success = await supabaseService.updateAvatar(user.uid, base64String);
        if (success) refreshUser();
        setLoading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
       // If iOS, open the profile modal to show instructions if not already open
       setShowProfileModal(true);
    }
  };

  const avatarOptions = user.role === 'ALUMNO' ? STUDENT_AVATARS : PARENT_AVATARS;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b-4 border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <img 
            src="https://i.ibb.co/kVhqQ0K9/gemabit.png" 
            alt="Gemabit Logo" 
            className="w-10 h-10 object-contain hover:scale-110 transition-transform" 
          />
          <div className="hidden sm:block">
             <span className="font-black text-xl tracking-tight text-slate-700 block leading-none">
                Gemabit
             </span>
             {exchangeRate > 0 && (
                 <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                    $1 = {exchangeRate.toFixed(2)} Bs
                 </span>
             )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          
          {/* CURRENCY TICKER MOBILE */}
          {exchangeRate > 0 && (
             <div className="sm:hidden bg-slate-100 px-2 py-1 rounded-lg text-[9px] font-black text-slate-500">
                1$ = {exchangeRate.toFixed(1)}Bs
             </div>
          )}

          {/* BOTÓN DE INSTALACIÓN VISIBLE EN BARRA SUPERIOR */}
          {(!isInstalled && (deferredPrompt || isIOS)) && (
            <button
              onClick={handleInstallApp}
              className="mr-1 bg-sky-500 hover:bg-sky-400 text-white p-2 sm:px-4 sm:py-2 rounded-xl font-black text-xs shadow-lg shadow-sky-200 transition-all flex items-center gap-2 animate-bounce-slow"
            >
              <Download size={20} strokeWidth={3} />
              <span className="hidden sm:inline">INSTALAR APP</span>
            </button>
          )}

          <button 
            onClick={() => {
              setNewDisplayName(user.displayName);
              setShowProfileModal(true);
            }}
            className="flex items-center gap-3 text-right group hover:bg-slate-50 p-1.5 rounded-2xl transition-all"
          >
            <div className="flex flex-col items-end">
              <span className="font-extrabold text-sm text-slate-700 leading-none group-hover:text-violet-600 transition-colors">
                {user.displayName}
              </span>
              <span className="text-[10px] font-bold text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full mt-1 uppercase tracking-wider">
                {user.role}
              </span>
            </div>
            
            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden group-hover:border-violet-300 transition-all">
               <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </button>

          <button 
            onClick={onLogout}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-red-500"
            title="Salir"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-8 border-b-[10px] border-slate-200 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowProfileModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
              <X size={24}/>
            </button>

            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="w-32 h-32 rounded-[2rem] border-4 border-slate-100 mx-auto overflow-hidden shadow-xl bg-slate-50">
                  <img src={user.avatar} className="w-full h-full object-cover" />
                  {loading && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <RefreshCw className="animate-spin text-violet-600" size={32} />
                    </div>
                  )}
                </div>
                
                {user.role === 'MAESTRA' && (
                  <>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 p-3 bg-violet-600 text-white rounded-2xl shadow-lg hover:bg-violet-500 transition-all border-4 border-white active:scale-95"
                    >
                      <Camera size={20} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                  </>
                )}
              </div>
              <h3 className="font-black text-2xl text-slate-800 mt-4 tracking-tight">Mi Perfil</h3>
              <p className="text-slate-400 font-bold text-sm">Personaliza tu cuenta</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-2 uppercase pl-2 tracking-widest">Nombre Visible</label>
                <input 
                  required
                  type="text" 
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 font-black text-slate-700 focus:border-violet-500 outline-none transition-all"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-3 uppercase pl-2 text-center tracking-widest">Elige un Personaje</label>
                <div className="grid grid-cols-4 gap-3 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  {avatarOptions.map(opt => (
                    <button 
                      key={opt.url}
                      type="button"
                      onClick={() => handleAvatarSelect(opt.url)}
                      className={`rounded-2xl aspect-square border-4 transition-all overflow-hidden bg-white shadow-sm ${user.avatar === opt.url ? 'border-violet-500 scale-105 z-10' : 'border-white hover:border-slate-200'}`}
                    >
                      <img src={opt.url} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t-2 border-slate-100">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-violet-600 text-white font-black py-4 rounded-2xl border-b-[6px] border-violet-800 active:translate-y-1 active:border-b-0 transition-all uppercase tracking-widest shadow-xl shadow-violet-100"
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>

                {/* APP INSTALLATION SECTION (FALLBACK & INSTRUCTIONS) */}
                {!isInstalled && (
                  <div className="bg-slate-50 rounded-3xl p-5 border-2 border-slate-100 mt-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-sky-100 text-sky-600 rounded-xl">
                        <Smartphone size={20} strokeWidth={3} />
                      </div>
                      <span className="font-black text-xs text-slate-500 uppercase tracking-widest">Instalar App</span>
                    </div>

                    {deferredPrompt ? (
                      /* Automatic installation (Android/Chrome/Edge) */
                      <button 
                        type="button"
                        onClick={handleInstallApp}
                        className="w-full bg-sky-500 text-white font-black py-4 rounded-2xl border-b-[6px] border-sky-700 active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-100"
                      >
                        <Download size={18} strokeWidth={3} />
                        Instalar Ahora
                      </button>
                    ) : isIOS ? (
                      /* Manual instructions for iPhone/iPad */
                      <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-500 leading-snug">
                          Instalar en iPhone/iPad:
                        </p>
                        <ol className="text-[11px] font-bold text-slate-400 space-y-2">
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center shrink-0">1</span>
                            Toca el botón <Share size={14} className="text-sky-500" /> (Compartir).
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center shrink-0">2</span>
                            Elige <PlusSquare size={14} className="text-sky-500" /> "Añadir a inicio".
                          </li>
                        </ol>
                      </div>
                    ) : (
                      /* Generic fallback (PC/Mac/Others) */
                      <div className="bg-white p-4 rounded-2xl border border-slate-200">
                         <div className="flex items-center gap-2 mb-2 text-sky-500">
                             <Laptop size={18} />
                             <span className="text-xs font-bold uppercase">Instalación Manual</span>
                         </div>
                         <p className="text-[11px] font-bold text-slate-400 leading-snug">
                           Para instalar, busca el icono de <strong>"Instalar App"</strong> en la barra de direcciones del navegador o en el menú de opciones (tres puntos).
                         </p>
                      </div>
                    )}
                  </div>
                )}
                
                {isInstalled && (
                  <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 rounded-2xl border-2 border-emerald-100 text-emerald-600 font-black text-xs uppercase tracking-widest">
                    <Check size={16} strokeWidth={4} />
                    App Instalada
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
        {children}
      </main>
      
      {/* Mobile Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around md:hidden z-40 pb-safe">
         <div className="flex flex-col items-center text-slate-400">
             <LayoutDashboard size={24} />
             <span className="text-[10px] font-bold">Inicio</span>
         </div>
      </div>
    </div>
  );
};
