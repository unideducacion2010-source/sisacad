import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Sparkles, 
  RotateCcw, 
  Save, 
  Calendar, 
  Users, 
  X,
  Volume2,
  Check
} from 'lucide-react';
export interface AlumnoItem {
  id?: string;
  matricula?: string;
  nombres: string;
  apellidos: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  grado?: string;
  grupo?: string;
  nivel?: string;
  email?: string;
}

export interface AttendanceRecord {
  alumnoId: string;
  alumnoNombre: string;
  gradoGrupo: string;
  fecha: string;
  status: 'A' | 'R' | 'F'; // A = Asistencia, R = Retardo, F = Falta
}

interface VoiceAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  alumnosList: AlumnoItem[];
  onSaveAttendance?: (records: AttendanceRecord[]) => void;
  playClickSound?: () => void;
  playSuccessSound?: () => void;
}

export const VoiceAttendanceModal: React.FC<VoiceAttendanceModalProps> = ({
  isOpen,
  onClose,
  alumnosList,
  onSaveAttendance,
  playClickSound,
  playSuccessSound
}) => {
  if (!isOpen) return null;

  const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedGrado, setSelectedGrado] = useState<string>('Todos');
  const [selectedGrupo, setSelectedGrupo] = useState<string>('Todos');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'A' | 'R' | 'F'>>({});
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [aiFeedback, setAiFeedback] = useState<string>('Presiona "Iniciar Voz con IA" y dicta el nombre del alumno (ej. "Juan Pérez"). Por defecto se asigna Asistencia (A). Si dices "retardo" o "falta", se actualizará.');
  const [confidence, setConfidence] = useState<number | null>(null);

  const recognitionRef = useRef<any>(null);

  // Filter alumnos based on grade and group if selected
  const filteredAlumnos = alumnosList.filter(a => {
    const matchGrado = selectedGrado === 'Todos' || (a.grado || '').toLowerCase().includes(selectedGrado.toLowerCase()) || (a.nivel || '').toLowerCase().includes(selectedGrado.toLowerCase());
    const matchGrupo = selectedGrupo === 'Todos' || (a.grupo || '').toLowerCase().includes(selectedGrupo.toLowerCase());
    return matchGrado && matchGrupo;
  });

  // Initialize all visible students with 'A' (Asistencia) by default if not set
  useEffect(() => {
    const initial: Record<string, 'A' | 'R' | 'F'> = {};
    alumnosList.forEach(a => {
      const id = a.id || a.matricula;
      initial[id] = 'A';
    });
    setAttendanceMap(initial);
  }, [alumnosList]);

  // Handle Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-MX';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        processVoiceCommand(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        setAiFeedback('Error en el reconocimiento de voz. Intenta nuevamente.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [alumnosList]);

  const toggleListening = () => {
    if (playClickSound) playClickSound();
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Google Chrome o Microsoft Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setAiFeedback('Micrófono pausado.');
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        setAiFeedback('Escuchando... Dicta alumno y estado (Asistencia, Retardo o Falta).');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // AI Voice Command Parser
  const processVoiceCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    let updatedCount = 0;
    const newMap = { ...attendanceMap };

    alumnosList.forEach(alumno => {
      const fullName = `${alumno.nombres} ${alumno.apellidos}`.toLowerCase();
      const firstName = alumno.nombres.toLowerCase();
      const lastName = alumno.apellidoPaterno ? alumno.apellidoPaterno.toLowerCase() : '';

      // Check if student name or parts are mentioned in transcript
      if (lowerText.includes(fullName) || (firstName && lastName && lowerText.includes(firstName) && lowerText.includes(lastName)) || (firstName && lowerText.includes(firstName))) {
        const id = alumno.id || alumno.matricula;
        
        // Determine status keyword following or preceding name
        if (lowerText.includes('falta') || lowerText.includes('ausente') || lowerText.includes('no vino') || lowerText.includes(' f ')) {
          newMap[id] = 'F';
          updatedCount++;
          setAiFeedback(`IA: Marcado a ${alumno.nombres} ${alumno.apellidos} como FALTA (F)`);
        } else if (lowerText.includes('retardo') || lowerText.includes('tarde') || lowerText.includes('tardanza') || lowerText.includes(' r ')) {
          newMap[id] = 'R';
          updatedCount++;
          setAiFeedback(`IA: Marcado a ${alumno.nombres} ${alumno.apellidos} como RETARDO (R)`);
        } else {
          // Default to Asistencia (A) simply by mentioning student name
          newMap[id] = 'A';
          updatedCount++;
          setAiFeedback(`IA: Marcado a ${alumno.nombres} ${alumno.apellidos} como ASISTENCIA (A)`);
        }
      }
    });

    if (updatedCount > 0) {
      setAttendanceMap(newMap);
      if (playSuccessSound) playSuccessSound();
    }
  };

  const setStatus = (id: string, status: 'A' | 'R' | 'F') => {
    if (playClickSound) playClickSound();
    setAttendanceMap(prev => ({ ...prev, [id]: status }));
  };

  const handleSave = () => {
    if (playClickSound) playClickSound();
    const records: AttendanceRecord[] = alumnosList.map(a => {
      const id = a.id || a.matricula;
      return {
        alumnoId: id,
        alumnoNombre: `${a.nombres} ${a.apellidos}`,
        gradoGrupo: `${a.grado || '1'}° ${a.grupo || 'A'}`,
        fecha,
        status: attendanceMap[id] || 'A'
      };
    });

    if (onSaveAttendance) {
      onSaveAttendance(records);
    }
    if (playSuccessSound) playSuccessSound();
    alert(`¡Asistencia guardada correctamente para ${records.length} alumnos (${fecha})!`);
    onClose();
  };

  const countPresent = Object.values(attendanceMap).filter(v => v === 'A').length;
  const countRetardo = Object.values(attendanceMap).filter(v => v === 'R').length;
  const countFalta = Object.values(attendanceMap).filter(v => v === 'F').length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
              <Mic size={26} className="text-emerald-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">Control de Asistencia por Voz con IA</h2>
                <span className="bg-emerald-500/30 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={10} /> Voz & IA
                </span>
              </div>
              <p className="text-xs text-emerald-100/80">Dicta los nombres y estatus en el salón de clases (Asistencia, Retardo, Falta)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Toolbar & Voice Control Panel */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs">
              <Calendar size={16} className="text-slate-500" />
              <input 
                type="date" 
                value={fecha} 
                onChange={(e) => setFecha(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs">
              <Users size={16} className="text-slate-500" />
              <select 
                value={selectedGrado}
                onChange={(e) => setSelectedGrado(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="Todos">Todos los Grados</option>
                <option value="1er">1er Grado</option>
                <option value="2do">2do Grado</option>
                <option value="3er">3er Grado</option>
                <option value="Primaria">Primaria</option>
                <option value="Secundaria">Secundaria</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs">
              <span className="text-xs text-slate-500 font-bold">Grupo:</span>
              <select 
                value={selectedGrupo}
                onChange={(e) => setSelectedGrupo(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="Todos">Todos</option>
                <option value="A">Grupo A</option>
                <option value="B">Grupo B</option>
                <option value="C">Grupo C</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={toggleListening}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                isListening 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse ring-4 ring-rose-300' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{isListening ? 'Detener Escucha IA' : 'Iniciar Voz con IA'}</span>
            </button>
          </div>
        </div>

        {/* AI Live Feedback & Transcript Banner */}
        <div className="bg-slate-900 text-slate-100 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2 text-emerald-400 font-mono">
            <Sparkles size={14} className="shrink-0" />
            <span className="font-semibold">{aiFeedback}</span>
          </div>
          {transcript && (
            <div className="bg-slate-800 px-3 py-1 rounded-lg text-slate-300 italic font-mono max-w-md truncate">
              🗣️ "{transcript}"
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between shrink-0 text-xs font-semibold">
          <div className="flex items-center gap-6">
            <span className="text-slate-600">Total Alumnos: <strong className="text-slate-900">{filteredAlumnos.length}</strong></span>
            <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <CheckCircle2 size={14} /> Asistencias (A): {countPresent}
            </span>
            <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              <Clock size={14} /> Retardos (R): {countRetardo}
            </span>
            <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              <XCircle size={14} /> Faltas (F): {countFalta}
            </span>
          </div>

          <button
            onClick={() => {
              const reset: Record<string, 'A' | 'R' | 'F'> = {};
              filteredAlumnos.forEach(a => reset[a.id || a.matricula] = 'A');
              setAttendanceMap(reset);
            }}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Restablecer Todos a (A)</span>
          </button>
        </div>

        {/* Student Table / List */}
        <div className="overflow-y-auto flex-1 p-6 bg-slate-50/50">
          {filteredAlumnos.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No hay alumnos registrados o que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-5">Matrícula / C.U.R.P.</th>
                    <th className="py-3.5 px-5">Nombre del Alumno</th>
                    <th className="py-3.5 px-5">Grado y Grupo</th>
                    <th className="py-3.5 px-5 text-center">Estatus de Asistencia (Dictado por Voz o Manual)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredAlumnos.map((alumno, index) => {
                    const id = alumno.id || alumno.matricula;
                    const status = attendanceMap[id] || 'A';

                    return (
                      <tr key={id || index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-5 font-mono text-slate-600 font-medium">
                          {alumno.matricula || 'N/A'}
                        </td>
                        <td className="py-3 px-5 font-bold text-slate-900">
                          {alumno.nombres} {alumno.apellidos}
                        </td>
                        <td className="py-3 px-5 text-slate-600">
                          {alumno.grado || '1°'} {alumno.grupo || 'A'} ({alumno.nivel || 'Primaria'})
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex items-center justify-center gap-2">
                            {/* A button */}
                            <button
                              type="button"
                              onClick={() => setStatus(id, 'A')}
                              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                status === 'A'
                                  ? 'bg-emerald-600 text-white shadow-md scale-105 ring-2 ring-emerald-300'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Asistencia (A)"
                            >
                              <Check size={13} />
                              <span>Asistencia (A)</span>
                            </button>

                            {/* R button */}
                            <button
                              type="button"
                              onClick={() => setStatus(id, 'R')}
                              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                status === 'R'
                                  ? 'bg-amber-500 text-white shadow-md scale-105 ring-2 ring-amber-300'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Retardo (R)"
                            >
                              <Clock size={13} />
                              <span>Retardo (R)</span>
                            </button>

                            {/* F button */}
                            <button
                              type="button"
                              onClick={() => setStatus(id, 'F')}
                              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                status === 'F'
                                  ? 'bg-rose-600 text-white shadow-md scale-105 ring-2 ring-rose-300'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title="Falta (F)"
                            >
                              <XCircle size={13} />
                              <span>Falta (F)</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-600" />
            <span>Nota: El registro de asistencia es para control interno y no afecta el cálculo de promedios académicos.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save size={15} />
              <span>Guardar Asistencia del Día</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
