import React from 'react';
import { QuizType } from '../types';
import { Puzzle, Layers, Key, Ghost, MessageCircleQuestion, Gamepad2 } from 'lucide-react';

export const getGameTypeStyles = (type: QuizType) => {
  switch (type) {
    case 'SENTENCE': return { label: 'Construir Frase', icon: <Puzzle size={24} />, color: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' };
    case 'SORTING': return { label: 'Clasificar', icon: <Layers size={24} />, color: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600' };
    case 'SECRET_WORD': return { label: 'Palabra Secreta', icon: <Key size={24} />, color: 'bg-pink-500', light: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-600' };
    case 'INTRUDER': return { label: 'El Intruso', icon: <Ghost size={24} />, color: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600' };
    case 'TEXT': default: return { label: 'Pregunta Rápida', icon: <MessageCircleQuestion size={24} />, color: 'bg-sky-500', light: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600' };
  }
};

export const getGameVisual = (type: QuizType) => {
    switch(type) {
        case 'TEXT': return { icon: <MessageCircleQuestion size={20}/>, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', label: 'Pregunta' };
        case 'SENTENCE': return { icon: <Puzzle size={20}/>, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Frase' };
        case 'SORTING': return { icon: <Layers size={20}/>, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', label: 'Categoría' };
        case 'SECRET_WORD': return { icon: <Key size={20}/>, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', label: 'Palabra Secreta' };
        case 'INTRUDER': return { icon: <Ghost size={20}/>, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', label: 'El Intruso' };
        default: return { icon: <Gamepad2 size={20}/>, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Juego' };
    }
};