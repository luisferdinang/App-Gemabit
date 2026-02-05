
import React from 'react';
import { 
  Coins, 
  Gamepad2, 
  School, 
  CheckCircle2, 
  Projector, 
  AlertTriangle, 
  Trophy,
  ArrowRight
} from 'lucide-react';

export const TeacherGuide: React.FC = () => {
  return (
    <div className="animate-fade-in space-y-8 pb-10">
      
      {/* HEADER */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2">Manual de la Maestra</h2>
          <p className="text-sky-100 font-bold max-w-xl text-lg">
            Aprende a gestionar la economía de tu aula, crear juegos y motivar a tus alumnos con Gemabit.
          </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        
        {/* CARD 1: ECONOMÍA */}
        <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <Coins size={24} />
            </div>
            <h3 className="font-black text-slate-700 text-lg">1. La Economía</h3>
          </div>
          <ul className="space-y-3 text-sm text-slate-500 font-bold">
            <li className="flex items-start gap-2">
              <div className="min-w-[6px] h-[6px] rounded-full bg-emerald-400 mt-1.5"></div>
              <span>
                <strong className="text-slate-700">MiniBits (MB):</strong> Son como centavos. Se ganan con tareas y juegos.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="min-w-[6px] h-[6px] rounded-full bg-emerald-400 mt-1.5"></div>
              <span>
                <strong className="text-slate-700">GemaBits (GB):</strong> Es la moneda mayor. <span className="bg-emerald-100 text-emerald-700 px-1 rounded">100 MB = 1 GB = $1 USD</span>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="min-w-[6px] h-[6px] rounded-full bg-emerald-400 mt-1.5"></div>
              <span>
                <strong className="text-slate-700">Tasa de Cambio:</strong> Los padres y alumnos pueden ver la conversión automática a Bolívares (Bs) según la tasa del día.
              </span>
            </li>
          </ul>
        </div>

        {/* CARD 2: TAREAS */}
        <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-violet-100 text-violet-600 rounded-xl">
              <School size={24} />
            </div>
            <h3 className="font-black text-slate-700 text-lg">2. Misiones Escolares</h3>
          </div>
          <p className="text-xs font-bold text-slate-400 mb-3">
            Tú controlas las tareas de la escuela. Los alumnos no pueden auto-evaluarse aquí.
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs font-black text-slate-600">
              <span className="bg-white border border-slate-200 px-2 py-1 rounded flex items-center gap-1">
                <CheckCircle2 size={12} className="text-violet-500"/> Asistencia
              </span>
              <ArrowRight size={14} className="text-slate-300"/>
              <span className="text-emerald-500">+20 MB</span>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-3">
            Ve a la pestaña <strong>"Alumnos"</strong>, toca un niño y marca sus logros del día.
          </p>
        </div>

        {/* CARD 3: ARCADE */}
        <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-sky-100 text-sky-600 rounded-xl">
              <Gamepad2 size={24} />
            </div>
            <h3 className="font-black text-slate-700 text-lg">3. El Arcade</h3>
          </div>
          <ol className="space-y-3 text-sm text-slate-500 font-bold list-decimal list-inside marker:text-sky-500">
            <li>
              Crea juegos en la pestaña <strong>"Juegos"</strong> (Trivias, Frases, Secuencias).
            </li>
            <li>
              El alumno juega y gana dinero en su <strong>"Bolsa Temporal"</strong>.
            </li>
            <li>
              El alumno pulsa <strong>"Cobrar"</strong> en su tablet.
            </li>
            <li>
              Tú recibes una alerta en <strong>"Solicitudes"</strong> para aprobar el pago real a su billetera.
            </li>
          </ol>
        </div>

        {/* CARD 4: MODO PRESENTACIÓN */}
        <div className="bg-slate-800 text-white rounded-[2rem] p-6 shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/10 rounded-xl text-yellow-400">
                <Projector size={24} />
              </div>
              <h3 className="font-black text-lg">4. Proyectar en Clase</h3>
            </div>
            <p className="text-sm font-bold text-slate-300 mb-4">
              Usa el botón <strong>"PROYECTAR"</strong> en la barra superior para mostrar el tablero en la TV o Pizarra Digital.
            </p>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-xs font-bold text-slate-400">
              Muestra el "Tesoro de la Clase" (suma de todos) y el Podio de los mejores ahorradores sin mostrar datos sensibles.
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER TIPS */}
      <div className="bg-amber-50 rounded-[2.5rem] p-6 border-2 border-amber-100 flex items-start gap-4">
        <div className="bg-amber-100 text-amber-600 p-3 rounded-full shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h4 className="font-black text-amber-700 text-lg mb-1">Consejo de Seguridad</h4>
          <p className="text-amber-600/80 text-sm font-bold leading-relaxed">
            Si un alumno olvida su contraseña, puedes restablecerla pulsando el icono de <strong>Engranaje</strong> en su perfil dentro de la pestaña "Alumnos".
          </p>
        </div>
      </div>

    </div>
  );
};
