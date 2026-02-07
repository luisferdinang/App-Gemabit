import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../services/supabaseClient';

interface PasswordChangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'self' | 'linked';
    targetUser?: { id: string; name: string; role: 'ALUMNO' | 'PADRE' };
    currentUserId: string;
    currentUserRole: 'ALUMNO' | 'PADRE' | 'MAESTRA';
    onSuccess: () => void;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
    isOpen,
    onClose,
    mode,
    targetUser,
    currentUserId,
    currentUserRole,
    onSuccess
}) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        // Validaciones
        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setIsLoading(true);

        try {
            if (mode === 'self') {
                // Validar contraseña actual
                if (!currentPassword) {
                    setError('Debes ingresar tu contraseña actual');
                    setIsLoading(false);
                    return;
                }

                // Verificar contraseña actual intentando hacer login
                const email = (await supabase.auth.getUser()).data.user?.email;
                if (!email) {
                    setError('Error al obtener información del usuario');
                    setIsLoading(false);
                    return;
                }

                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password: currentPassword
                });

                if (signInError) {
                    setError('La contraseña actual es incorrecta');
                    setIsLoading(false);
                    return;
                }

                // Cambiar contraseña propia
                const result = await supabaseService.updatePassword(newPassword);

                if (result.success) {
                    setSuccess(true);
                    setTimeout(() => {
                        onSuccess();
                        onClose();
                        resetForm();
                    }, 1500);
                } else {
                    setError(result.error || 'Error al cambiar la contraseña');
                }
            } else if (mode === 'linked' && targetUser) {
                // Si es MAESTRA, usamos el reset administrativo directo
                if (currentUserRole === 'MAESTRA') {
                    const result = await supabaseService.adminResetStudentPassword(targetUser.id, newPassword);
                    if (result.success) {
                        setSuccess(true);
                        setTimeout(() => {
                            onSuccess();
                            onClose();
                            resetForm();
                        }, 1500);
                    } else {
                        setError(result.error || 'Error al cambiar la contraseña');
                    }
                    return;
                }

                // Cambiar contraseña de usuario vinculado (Alumno/Padre)
                const result = await supabaseService.changeLinkedUserPassword(
                    currentUserId,
                    targetUser.id,
                    newPassword,
                    currentUserRole as 'ALUMNO' | 'PADRE'
                );

                if (result.success) {
                    setSuccess(true);
                    setTimeout(() => {
                        onSuccess();
                        onClose();
                        resetForm();
                    }, 1500);
                } else {
                    setError(result.error || 'Error al cambiar la contraseña');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Error inesperado');
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setSuccess(false);
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
    };

    const handleClose = () => {
        if (!isLoading) {
            resetForm();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border-4 border-indigo-300 relative overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-500 p-6 text-center relative border-b-4 border-indigo-600">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="absolute top-4 right-4 p-2 bg-indigo-600 rounded-full text-indigo-100 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                    <div className="inline-block p-3 bg-white/20 rounded-2xl mb-2">
                        <Lock size={32} className="text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white">
                        {mode === 'self' ? 'Cambiar mi Contraseña' : `Cambiar Contraseña de ${targetUser?.name}`}
                    </h3>
                    <p className="text-indigo-100 text-xs font-bold mt-1">
                        {mode === 'self' ? 'Actualiza tu contraseña de acceso' : 'Establece una nueva contraseña'}
                    </p>
                </div>

                {/* Body */}
                <div className="p-6">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="inline-block p-4 bg-emerald-100 rounded-full mb-4">
                                <Check size={48} className="text-emerald-600" />
                            </div>
                            <h4 className="text-lg font-black text-emerald-600 mb-2">¡Contraseña Actualizada!</h4>
                            <p className="text-sm text-slate-600">La contraseña se cambió correctamente</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Contraseña Actual (solo para modo 'self') */}
                            {mode === 'self' && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-2">
                                        Contraseña Actual
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 pr-12 font-bold text-sm text-slate-700 focus:border-indigo-400 outline-none transition-all"
                                            placeholder="Tu contraseña actual"
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Nueva Contraseña */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-2">
                                    Nueva Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 pr-12 font-bold text-sm text-slate-700 focus:border-indigo-400 outline-none transition-all"
                                        placeholder="Mínimo 6 caracteres"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                {newPassword && newPassword.length < 6 && (
                                    <p className="text-xs text-amber-600 mt-1 pl-2">Mínimo 6 caracteres</p>
                                )}
                            </div>

                            {/* Confirmar Contraseña */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-2">
                                    Confirmar Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 pr-12 font-bold text-sm text-slate-700 focus:border-indigo-400 outline-none transition-all"
                                        placeholder="Repite la contraseña"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                {confirmPassword && newPassword !== confirmPassword && (
                                    <p className="text-xs text-red-600 mt-1 pl-2">Las contraseñas no coinciden</p>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
                                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs font-bold text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading || !newPassword || !confirmPassword || (mode === 'self' && !currentPassword)}
                                className="w-full bg-indigo-500 text-white font-black py-4 rounded-2xl border-b-[6px] border-indigo-700 active:translate-y-1 active:border-b-0 transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Cambiando...
                                    </>
                                ) : (
                                    <>
                                        <Lock size={20} />
                                        Cambiar Contraseña
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
