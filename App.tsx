
import React, { useState, useEffect } from 'react';
import { RoleSelector } from './components/RoleSelector';
import { Layout } from './components/Layout';
import { User } from './types';
import { supabaseService } from './services/supabaseService';
import { supabase } from './services/supabaseClient';
import { RefreshCw, LogOut } from 'lucide-react';
import { useUserStore } from './store/userStore';
// Lazy load components for performance
const StudentView = React.lazy(() => import('./components/StudentView').then(module => ({ default: module.StudentView })));
const TeacherView = React.lazy(() => import('./components/TeacherView').then(module => ({ default: module.TeacherView })));
const ParentView = React.lazy(() => import('./components/ParentView').then(module => ({ default: module.ParentView })));

export default function App() {
  const { currentUser, setUser, updateUserFields, setExchangeRate, setSystemStartDate } = useUserStore();
  const [loading, setLoading] = useState(true);

  // 1. Defining Emergency Cleanup at Top Level so it's accessible everywhere
  const handleEmergencyReset = async () => {
    console.warn("🚨 EMERGENCY RESET TRIGGERED");
    localStorage.clear();
    sessionStorage.clear();
    setUser(null);
    setLoading(false);

    // Clear Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // Force Supabase Signout
    await supabase.auth.signOut().catch(() => { });

    // Reload if needed (optional, but good for clean slate)
    // window.location.reload(); 
  };

  useEffect(() => {
    let mounted = true;

    const initializeApp = async () => {
      console.log("🚀 Starting App Initialization...");

      // SAFETY TIMER: If init takes > 7 seconds, nuke it.
      const safetyTimer = setTimeout(() => {
        if (mounted && loading) {
          console.error("⏱️ Initialization TIMEOUT (7s) - Forcing Reset");
          handleEmergencyReset();
        }
      }, 7000);

      try {
        // Step A: Load Settings (Parallel is fine here, but we await completion)
        const settingsPromise = (async () => {
          try {
            const rate = await supabaseService.getDailyExchangeRate();
            if (mounted && rate > 0) setExchangeRate(rate);
            const startWeek = await supabaseService.getSystemStartWeekId();
            if (mounted) setSystemStartDate(startWeek);
          } catch (e) {
            console.warn("Settings load warning:", e);
          }
        })();

        // Step B: Check Session (The Critical Part)
        const sessionPromise = (async () => {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (session?.user) {
            console.log("👤 Found active session:", session.user.email);
            const profile = await supabaseService.getStudentById(session.user.id);

            if (profile) {
              if (mounted) setUser(profile);
            } else {
              throw new Error("Zombie Session (User exists in Auth but not in DB)");
            }
          }
        })();

        // Await both (Settings + Session)
        await Promise.all([settingsPromise, sessionPromise]);

      } catch (error: any) {
        console.error("❌ App Initialization Failed:", error.message);
        if (mounted) handleEmergencyReset();
      } finally {
        console.log("✅ Initialization Complete");
        clearTimeout(safetyTimer);
        if (mounted) setLoading(false);
      }
    };

    initializeApp();

    // Step C: Auth Listener (For FUTURE changes only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.clear();
        sessionStorage.clear();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Optionally handle re-fetch if needed, but 'initializeApp' handles the mount case.
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONCE on mount

  // 4. GLOBAL REALTIME LISTENER FOR CURRENT USER
  useEffect(() => {
    if (!currentUser) return;

    console.log("Setting up Realtime Listener for User:", currentUser.uid);

    const subscription = supabaseService.subscribeToChanges('profiles', `id=eq.${currentUser.uid}`, (payload) => {
      if (payload && payload.new) {
        console.log("⚡️ REALTIME UPDATE RECEIVED:", payload.new);
        const updatedFields: Partial<User> = {
          balance: payload.new.balance,
          xp: payload.new.xp,
          streakWeeks: payload.new.streak_weeks,
          status: payload.new.status,
          avatar: payload.new.avatar_url,
          displayName: payload.new.display_name,
        };
        updateUserFields(updatedFields);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser?.uid]);

  const handleRefreshUser = async () => {
    if (currentUser) {
      const updated = await supabaseService.getStudentById(currentUser.uid);
      if (updated) setUser({ ...updated });
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    await handleEmergencyReset();
    window.location.reload(); // Ensure clean state
  };

  // Reusable loading component with Emergency Reset Button
  const LoadingScreen = () => {
    const [showReset, setShowReset] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => setShowReset(true), 5000);
      return () => clearTimeout(timer);
    }, []);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6 p-4">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center animate-bounce-slow relative">
          <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-12 h-12 object-contain" alt="Gemabit Logo" />
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-violet-500 font-black text-sm uppercase tracking-widest">
            <RefreshCw className="animate-spin" size={18} />
            CARGANDO GEMABIT...
          </div>

          {showReset && (
            <button
              onClick={() => {
                handleEmergencyReset();
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-100 text-red-600 rounded-full text-xs font-bold hover:bg-red-200 transition-colors animate-pulse"
            >
              ¿Problemas de carga? Toca aquí para reiniciar
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <RoleSelector onLogin={setUser} />;
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout} refreshUser={handleRefreshUser}>
      <React.Suspense fallback={<LoadingScreen />}>
        {currentUser.role === 'ALUMNO' && (
          <StudentView student={currentUser} refreshUser={handleRefreshUser} />
        )}
        {currentUser.role === 'MAESTRA' && (
          <TeacherView currentUser={currentUser} refreshUser={handleRefreshUser} />
        )}
        {currentUser.role === 'PADRE' && (
          <ParentView currentUser={currentUser} />
        )}
      </React.Suspense>
    </Layout>
  );
}
