
import React, { useState, useEffect } from 'react';
import { RoleSelector } from './components/RoleSelector';
import { Layout } from './components/Layout';
import { StudentView } from './components/StudentView';
import { TeacherView } from './components/TeacherView';
import { ParentView } from './components/ParentView';
import { User } from './types';
import { supabaseService, mapProfileToUser } from './services/supabaseService';
import { supabase } from './services/supabaseClient';
import { RefreshCw, LogOut } from 'lucide-react';
import { useUserStore } from './store/userStore';

export default function App() {
  const { currentUser, setUser, updateUserFields, setExchangeRate, setSystemStartDate } = useUserStore();
  // Estados para manejo de carga y errores
  const [loading, setLoading] = useState(true);
  const [showErrorOptions, setShowErrorOptions] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Cargando Gemabit...");

  useEffect(() => {
    // 1. Fetch Currency Rate & System Settings (Runs once on load)
    const loadSettings = async () => {
      try {
        const rate = await supabaseService.getDailyExchangeRate();
        if (rate > 0) setExchangeRate(rate);

        const startWeek = await supabaseService.getSystemStartWeekId();
        setSystemStartDate(startWeek);
      } catch (e) {
        console.warn("Error loading settings", e);
      }
    };
    loadSettings();

    // 2. Control de tiempo de espera para mostrar opciones de recuperación
    const safetyTimer = setTimeout(() => {
      if (loading) {
        setShowErrorOptions(true);
        setLoadingMessage("Tardando más de lo esperado...");
      }
    }, 5000); // 5 segundos antes de mostrar opciones

    // 3. Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session && session.user) {
          console.log("Restoring session for:", session.user.email);
          const userProfile = await supabaseService.getStudentById(session.user.id);

          if (userProfile) {
            setUser(userProfile);
          } else {
            console.error("Session exists but profile not found. Waiting for user action.");
            // No hacemos logout automático aquí para dar oportunidad de reintentar si es fallo de red
            setLoadingMessage("No se pudo cargar el perfil.");
            setShowErrorOptions(true);
            return; // Mantenemos loading en true hasta que el usuario decida
          }
        }
      } catch (error) {
        console.error("Error restoring session:", error);
        setLoadingMessage("Error de conexión.");
        setShowErrorOptions(true);
      } finally {
        // Solo quitamos el loading si TUVIMOS ÉXITO encontrando usuario o si NO HABÍA sesión
        // Si hubo error (userProfile null pero session active), dejamos que la UI de error maneje
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setLoading(false);
        } else {
          // Si hay sesión, esperamos a haber seteado el usuario
          // Si llegamos aquí y userProfile falló, showErrorOptions ya está en true
          // Si userProfile tuvo éxito, setUser ya se llamó
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => clearTimeout(safetyTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔔 Auth Event State Change:", event);
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        localStorage.clear();
        sessionStorage.clear(); // Limpiar también sessionStorage
      } else if (event === 'SIGNED_IN' && session?.user) {
        const userProfile = await supabaseService.getStudentById(session.user.id);
        if (userProfile) {
          setUser(userProfile);
          setLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  // 4. GLOBAL REALTIME LISTENER FOR CURRENT USER
  // This ensures that whenever the DB changes (balance, xp, etc.), the UI updates INSTANTLY
  useEffect(() => {
    if (!currentUser) return;

    console.log("Setting up Realtime Listener for User:", currentUser.uid);

    const subscription = supabaseService.subscribeToChanges('profiles', `id=eq.${currentUser.uid}`, (payload) => {
      if (payload && payload.new) {
        console.log("⚡️ REALTIME UPDATE RECEIVED:", payload.new);
        // Optimistically update the store without a network fetch
        const updatedFields: Partial<User> = {
          balance: payload.new.balance,
          xp: payload.new.xp,
          streakWeeks: payload.new.streak_weeks,
          status: payload.new.status,
          avatar: payload.new.avatar_url,
          displayName: payload.new.display_name,
          // Add other mapped fields if necessary
        };
        updateUserFields(updatedFields);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser?.uid]); // Only recreate if UID changes

  // Legacy refresh function (still used by some components for deep refreshes)
  const handleRefreshUser = async () => {
    if (currentUser) {
      const updated = await supabaseService.getStudentById(currentUser.uid);
      if (updated) setUser({ ...updated });
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setLoadingMessage("Cerrando sesión...");
    await supabaseService.logout();
    setUser(null);
    setLoading(false);
    window.location.reload();
  };

  const handleForceReload = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6 p-4">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center animate-bounce-slow relative">
          <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-12 h-12 object-contain" alt="Gemabit Logo" />
          {showErrorOptions && <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping" />}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-violet-500 font-black text-sm uppercase tracking-widest">
            {!showErrorOptions && <RefreshCw className="animate-spin" size={18} />}
            {loadingMessage}
          </div>

          {showErrorOptions && (
            <div className="flex flex-col gap-3 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={handleForceReload}
                className="flex items-center gap-2 px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-bold shadow-lg transition-all transform hover:scale-105"
              >
                <RefreshCw size={18} />
                Recargar App
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-red-50 text-red-500 border-2 border-red-100 hover:border-red-200 rounded-full font-bold shadow-sm transition-all"
              >
                <LogOut size={18} />
                Cerrar Sesión / Reiniciar
              </button>

              <p className="text-xs text-slate-400 max-w-xs text-center mt-2">
                Si el problema persiste, intenta cerrar sesión y volver a entrar.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <RoleSelector onLogin={setUser} />;
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout} refreshUser={handleRefreshUser}>
      {currentUser.role === 'ALUMNO' && (
        <StudentView student={currentUser} refreshUser={handleRefreshUser} />
      )}
      {currentUser.role === 'MAESTRA' && (
        <TeacherView currentUser={currentUser} refreshUser={handleRefreshUser} />
      )}
      {currentUser.role === 'PADRE' && (
        <ParentView currentUser={currentUser} />
      )}
    </Layout>
  );
}
