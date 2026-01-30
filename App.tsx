import React, { useState, useEffect } from 'react';
import { RoleSelector } from './components/RoleSelector';
import { Layout } from './components/Layout';
import { StudentView } from './components/StudentView';
import { TeacherView } from './components/TeacherView';
import { ParentView } from './components/ParentView';
import { User } from './types';
import { supabaseService } from './services/supabaseService';
import { supabase } from './services/supabaseClient';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          console.log("Restoring session for:", session.user.email);
          const userProfile = await supabaseService.getStudentById(session.user.id);
          if (userProfile) {
            setCurrentUser(userProfile);
          }
        }
      } catch (error) {
        console.error("Error restoring session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // 2. Listen for auth changes (optional, keeps state in sync)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Function to refresh user data (e.g. after earning coins or profile updates)
  const handleRefreshUser = async () => {
    if (currentUser) {
      const updated = await supabaseService.getStudentById(currentUser.uid);
      if (updated) setCurrentUser({ ...updated });
    }
  };

  const handleLogout = async () => {
    await supabaseService.logout();
    setCurrentUser(null);
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
    return <RoleSelector onLogin={setCurrentUser} />;
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