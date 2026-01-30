import React, { useState } from 'react';
import { RoleSelector } from './components/RoleSelector';
import { Layout } from './components/Layout';
import { StudentView } from './components/StudentView';
import { TeacherView } from './components/TeacherView';
import { ParentView } from './components/ParentView';
import { User } from './types';
import { supabaseService } from './services/supabaseService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Function to refresh user data (e.g. after earning coins or profile updates)
  const handleRefreshUser = async () => {
    if (currentUser) {
      const updated = await supabaseService.getStudentById(currentUser.uid);
      if (updated) setCurrentUser({ ...updated });
    }
  };

  if (!currentUser) {
    return <RoleSelector onLogin={setCurrentUser} />;
  }

  return (
    <Layout user={currentUser} onLogout={() => setCurrentUser(null)} refreshUser={handleRefreshUser}>
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