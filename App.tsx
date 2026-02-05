
import React, { useState, useEffect } from 'react';
import { RoleSelector } from './components/RoleSelector';
import { Layout } from './components/Layout';
import { StudentView } from './components/StudentView';
import { TeacherView } from './components/TeacherView';
import { ParentView } from './components/ParentView';
import { User } from './types';
import { supabaseService, mapProfileToUser } from './services/supabaseService';
import { supabase } from './services/supabaseClient';
import { RefreshCw } from 'lucide-react';
import { useUserStore } from './store/userStore';

export default function App() {
  const { currentUser, setUser, updateUserFields, setExchangeRate } = useUserStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch Currency Rate (Runs once on load)
    const loadCurrency = async () => {
        const rate = await supabaseService.getDailyExchangeRate();
        if (rate > 0) setExchangeRate(rate);
    };
    loadCurrency();

    // 2. Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          console.log("Restoring session for:", session.user.email);
          const userProfile = await supabaseService.getStudentById(session.user.id);
          if (userProfile) {
            setUser(userProfile);
          }
        }
      } catch (error) {
        console.error("Error restoring session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
    await supabaseService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center animate-bounce-slow">
           <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-12 h-12 object-contain" />
        </div>
        <div className="flex items-center gap-2 text-violet-500 font-black text-sm uppercase tracking-widest">
           <RefreshCw className="animate-spin" size={18} />
           Cargando Gemabit...
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
