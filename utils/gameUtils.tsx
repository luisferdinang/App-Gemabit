
import React from 'react';
import { QuizType } from '../types';
import { Puzzle, Layers, ListOrdered, Ghost, MessageCircleQuestion, Gamepad2, Link as LinkIcon } from 'lucide-react';

export const getGameTypeStyles = (type: QuizType) => {
  switch (type) {
    case 'SENTENCE': return { label: 'Construir Frase', icon: <Puzzle size={24} />, color: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' };
    case 'SORTING': return { label: 'Clasificar', icon: <Layers size={24} />, color: 'bg-violet-500', light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600' };
    case 'SEQUENCE': return { label: 'Secuencia', icon: <ListOrdered size={24} />, color: 'bg-cyan-500', light: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600' };
    case 'INTRUDER': return { label: 'El Intruso', icon: <Ghost size={24} />, color: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600' };
    case 'MATCHING': return { label: 'Emparejar', icon: <LinkIcon size={24} />, color: 'bg-rose-500', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600' };
    case 'TEXT': default: return { label: 'Trivia', icon: <MessageCircleQuestion size={24} />, color: 'bg-sky-500', light: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600' };
  }
};

export const getGameVisual = (type: QuizType) => {
  switch (type) {
    case 'TEXT': return { icon: <MessageCircleQuestion size={20} />, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', label: 'Pregunta' };
    case 'SENTENCE': return { icon: <Puzzle size={20} />, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Frase' };
    case 'SORTING': return { icon: <Layers size={20} />, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', label: 'Categoría' };
    case 'SEQUENCE': return { icon: <ListOrdered size={20} />, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', label: 'Orden' };
    case 'INTRUDER': return { icon: <Ghost size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', label: 'El Intruso' };
    case 'MATCHING': return { icon: <LinkIcon size={20} />, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Emparejar' };
    default: return { icon: <Gamepad2 size={20} />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Juego' };
  }
};
