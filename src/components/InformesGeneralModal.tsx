import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Calendar, 
  Users, 
  Download, 
  Printer, 
  ExternalLink, 
  FolderOpen,
  X, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Award, 
  BookOpen, 
  Sparkles,
  School,
  ChevronDown
} from 'lucide-react';
import { resolveDriveFolderLink } from '../driveLinks';

interface CicloEscolarItem {
  id: string;
  clave: string;
  nombre: string;
  periodo: string;
  fechaInicio?: string;
  fechaFin?: string;
  estatus: 'Activo' | 'Próximo' | 'Concluido';
  folderUrl?: string;
  spreadsheetUrl?: string;
  observaciones?: string;
}

interface AlumnoItem {
  id: string;
  matricula?: string;
  nombres: string;
  apellidos: string;
  genero?: string;
  curp?: string;
  grado: string;
  grupo?: string;
  nivel?: string;
  turno?: string;
  email: string;
  promedio?: string | number;
  estatus?: string;
}

interface MateriaItem {
  id: string;
  clave?: string;
  nombre: string;
  profesor: string;
  creditos: number;
  area?: string;
  estatus?: string;
}

interface SystemUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  status: 'Activo' | 'Inactivo';
}

interface InformesGeneralModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionName: string;
  institutionLogo: string;
  ciclosList: CicloEscolarItem[];
  alumnosList: AlumnoItem[];
  materiasList: MateriaItem[];
  systemUsers: SystemUser[];
  sheetLink?: string | null;
  folderLink?: string | null;
  workspaceResult?: any;
  playClickSound?: () => void;
  playSuccessSound?: () => void;
}

export const InformesGeneralModal: React.FC<InformesGeneralModalProps> = ({
  isOpen,
  onClose,
  institutionName,
  institutionLogo,
  ciclosList,
  alumnosList,
  materiasList,
  systemUsers,
  sheetLink,
  folderLink,
  workspaceResult,
  playClickSound,
  playSuccessSound
}) => {
  const [activeTab, setActiveTab] = useState<'ciclo' | 'docentes' | 'alumnos'>('ciclo');

  // Resolved Google Drive Link depending on the currently open view
  const activeDriveLink = useMemo(() => {
    let category: 'ciclo' | 'docentes' | 'alumnos' = 'ciclo';
    if (activeTab === 'docentes') category = 'docentes';
    else if (activeTab === 'alumnos') category = 'alumnos';
    return resolveDriveFolderLink(category, workspaceResult, folderLink, sheetLink);
  }, [activeTab, workspaceResult, folderLink, sheetLink]);
  
  // Selected cycle for KPI calculation
  const [selectedCycleName, setSelectedCycleName] = useState<string>(() => {
    const active = ciclosList.find(c => c.estatus === 'Activo');
    return active ? active.nombre : (ciclosList[0]?.nombre || '2026 - 2027');
  });

  // Current Date formatted (like 11/Oct/2026)
  const currentDateFormatted = useMemo(() => {
    const now = new Date();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  // Compute dynamic stats or fallback to high-fidelity benchmarks matching the reference dashboard
  const totalStudents = alumnosList.length > 0 ? alumnosList.length : 767;
  const totalTeachers = systemUsers.filter(u => u.role === 'Maestros' || u.role === 'Docente' || u.role === 'Directivo').length || 44;

  // Level Distribution dataset for Ciclo Escolar Matrix
  const levelDistribution = [
    { nivel: 'Maternal', paralelos: 2, fem: 23, masc: 21, total: 44, promedio: 9.9 },
    { nivel: 'Prekinder', paralelos: 2, fem: 23, masc: 20, total: 43, promedio: 9.9 },
    { nivel: 'Kinder', paralelos: 2, fem: 29, masc: 22, total: 51, promedio: 9.8 },
    { nivel: '1ero. Básica', paralelos: 2, fem: 23, masc: 29, total: 52, promedio: 9.2 },
    { nivel: '2do. Básica', paralelos: 2, fem: 30, masc: 30, total: 60, promedio: 9.1 },
    { nivel: '3ero. Básica', paralelos: 2, fem: 23, masc: 30, total: 53, promedio: 8.9 },
    { nivel: '4to. Básica', paralelos: 2, fem: 22, masc: 23, total: 45, promedio: 8.9 },
    { nivel: '5to. Básica', paralelos: 2, fem: 20, masc: 28, total: 48, promedio: 9.0 },
    { nivel: '6to. Básica', paralelos: 2, fem: 29, masc: 23, total: 52, promedio: 8.2 },
    { nivel: '7mo. Básica', paralelos: 2, fem: 23, masc: 28, total: 51, promedio: 8.3 },
    { nivel: '8vo. Básica', paralelos: 3, fem: 21, masc: 18, total: 39, promedio: 8.2 },
    { nivel: '9no. Básica', paralelos: 2, fem: 24, masc: 20, total: 44, promedio: 8.4 },
    { nivel: '10mo. Básica', paralelos: 3, fem: 19, masc: 25, total: 44, promedio: 8.4 },
    { nivel: '1ero. Bachillerato', paralelos: 2, fem: 29, masc: 19, total: 48, promedio: 8.5 },
    { nivel: '2do. Bachillerato', paralelos: 3, fem: 22, masc: 20, total: 42, promedio: 8.4 },
    { nivel: '3ero. Bachillerato', paralelos: 3, fem: 28, masc: 23, total: 51, promedio: 8.6 },
  ];

  const totalParalelos = levelDistribution.reduce((acc, row) => acc + row.paralelos, 0);
  const totalFem = levelDistribution.reduce((acc, row) => acc + row.fem, 0);
  const totalMasc = levelDistribution.reduce((acc, row) => acc + row.masc, 0);
  const totalSum = levelDistribution.reduce((acc, row) => acc + row.total, 0);

  // Monthly Attendance Breakdown (matching Abril to Septiembre)
  const attendanceMonthly = [
    { mes: 'ABRIL', asistencias: 94.95, ausencias: 5.05 },
    { mes: 'MAYO', asistencias: 96.74, ausencias: 3.26 },
    { mes: 'JUNIO', asistencias: 98.60, ausencias: 1.40 },
    { mes: 'JULIO', asistencias: 97.13, ausencias: 2.87 },
    { mes: 'AGOSTO', asistencias: 96.44, ausencias: 3.56 },
    { mes: 'SEPTIEMBRE', asistencias: 97.56, ausencias: 2.44 }
  ];

  // CSV Export
  const exportToCSV = () => {
    let csvContent = '\uFEFF';
    const sanitize = (text: any) => `"${String(text || '').replace(/"/g, '""')}"`;

    if (activeTab === 'ciclo') {
      csvContent += 'INFORME DE KPIS - CICLO ESCOLAR\n';
      csvContent += `Institución,${sanitize(institutionName)}\n`;
      csvContent += `Año Lectivo,${sanitize(selectedCycleName)}\n`;
      csvContent += `Fecha Generación,${sanitize(currentDateFormatted)}\n`;
      csvContent += `Total Estudiantes,${totalStudents}\n`;
      csvContent += `Incremento Estudiantes,5.21%\n`;
      csvContent += `Promedio Est. Por Paralelo,21\n`;
      csvContent += `Capacidad Infraestructura,82%\n\n`;

      csvContent += 'Nivel,Paralelos,Femenino,Masculino,Total,Promedio\n';
      levelDistribution.forEach(row => {
        csvContent += `${sanitize(row.nivel)},${row.paralelos},${row.fem},${row.masc},${row.total},${row.promedio}\n`;
      });
      csvContent += `Total,${totalParalelos},${totalFem},${totalMasc},${totalSum},9.02\n`;
    } else if (activeTab === 'docentes') {
      csvContent += 'INFORME DE KPIS - DOCENTES Y MAESTROS\n';
      csvContent += `Institución,${sanitize(institutionName)}\n`;
      csvContent += `Total Docentes,${totalTeachers}\n`;
      csvContent += `Asistencia Docente,98.6%\n`;
      csvContent += `Cumplimiento Planeaciones,97.4%\n`;
      csvContent += `Horas Lectivas Semanales,1320\n\n`;

      csvContent += 'ID,Nombre,Rol,Correo,Estatus,Materias\n';
      systemUsers.filter(u => u.role === 'Maestros' || u.role === 'Docente' || u.role === 'Directivo').forEach(t => {
        csvContent += `${sanitize(t.id)},${sanitize(t.name)},${sanitize(t.role)},${sanitize(t.email)},${sanitize(t.status)}\n`;
      });
    } else {
      csvContent += 'INFORME DE KPIS - ALUMNOS Y MATRÍCULA\n';
      csvContent += `Institución,${sanitize(institutionName)}\n`;
      csvContent += `Matrícula Total,${totalStudents}\n`;
      csvContent += `Promedio General,9.2\n`;
      csvContent += `Tasa de Aprobación,98.1%\n`;
      csvContent += `Asistencia Global,96.8%\n\n`;

      csvContent += 'Matrícula,Nombre,Grado,Nivel,Promedio,Estatus\n';
      alumnosList.forEach(a => {
        csvContent += `${sanitize(a.matricula || a.id)},${sanitize(`${a.nombres} ${a.apellidos}`)},${sanitize(a.grado)},${sanitize(a.nivel || 'Básica')},${sanitize(a.promedio || '9.2')},${sanitize(a.estatus || 'Activo')}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `kpi_informe_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccessSound?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-[1300px] max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Top Floating App Action Bar (Sheets, Print, Export, Close) */}
        <div className="px-5 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold tracking-wide text-slate-200 uppercase">
              Panel de Indicadores y Analíticas Ejecutivas (KPIs)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={activeDriveLink.url} 
              target="_blank" 
              rel="noreferrer"
              onClick={() => playClickSound?.()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 px-3 rounded-lg transition-all text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              title={activeDriveLink.tooltip}
            >
              <FolderOpen size={13} />
              <span>Abrir</span>
            </a>
            {sheetLink && (
              <a 
                href={sheetLink} 
                target="_blank" 
                rel="noreferrer"
                className="bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-medium py-1.5 px-3 rounded-lg transition-all text-xs flex items-center gap-1.5"
                title="Abrir base de datos completa en Google Sheets"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">Google Sheets</span>
              </a>
            )}
            <button 
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium py-1.5 px-3 rounded-lg transition-all text-xs flex items-center gap-1.5 cursor-pointer"
              title="Imprimir panel de KPIs"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button 
              onClick={exportToCSV}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-3 rounded-lg transition-all text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Exportar datos a CSV / Excel"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Submenu 3 Navigation Buttons */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                playClickSound?.();
                setActiveTab('ciclo');
              }}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'ciclo'
                  ? 'bg-[#0f3458] text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <Calendar size={14} className={activeTab === 'ciclo' ? 'text-amber-300' : 'text-slate-400'} />
              <span>Informes Ciclo Escolar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClickSound?.();
                setActiveTab('docentes');
              }}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'docentes'
                  ? 'bg-[#0f3458] text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <GraduationCap size={14} className={activeTab === 'docentes' ? 'text-amber-300' : 'text-slate-400'} />
              <span>Informes Docentes</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClickSound?.();
                setActiveTab('alumnos');
              }}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs transition-all cursor-pointer ${
                activeTab === 'alumnos'
                  ? 'bg-[#0f3458] text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <Users size={14} className={activeTab === 'alumnos' ? 'text-amber-300' : 'text-slate-400'} />
              <span>Informes Alumnos</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-bold flex items-center gap-1.5">
              <Sparkles size={12} className="text-amber-600" />
              <span>Dashboard de Control Ejecutivo</span>
            </span>
          </div>
        </div>

        {/* Scrollable Modal Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-200/60">

          {/* ========================================================================= */}
          {/* TAB 1: INFORMES CICLO ESCOLAR (DESIGN REPLICA OF THE UPLOADED REFERENCE) */}
          {/* ========================================================================= */}
          {activeTab === 'ciclo' && (
            <div className="space-y-3">
              {/* 1. TOP NAVY BANNER WITH LOGO, INSTITUTION NAME & TOP 6 KPIS */}
              <div className="bg-[#0f3458] text-white rounded-xl shadow-md border border-[#0b2844] p-4 lg:p-5 flex flex-col lg:flex-row items-center justify-between gap-4">
                {/* Brand / Logo + Institution Name */}
                <div className="flex items-center gap-3.5 min-w-[240px]">
                  {institutionLogo ? (
                    <img 
                      src={institutionLogo} 
                      alt="Logo Escuela" 
                      className="w-14 h-14 object-contain rounded-lg bg-white p-1 shadow-sm border border-amber-300/40"
                    />
                  ) : (
                    <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-900 shadow-md border border-amber-300/50">
                      <School size={28} className="text-white" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#ffc107] uppercase leading-none drop-shadow-xs font-serif">
                      {institutionName || 'UNIDAD EDUCATIVA'}
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-widest mt-1">
                      Módulo de Control Escolar y Rendimiento
                    </p>
                  </div>
                </div>

                {/* KPI Metrics inside the Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 w-full lg:w-auto text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-600/50">
                  {/* Año Lectivo Selector */}
                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] sm:text-xs font-bold text-[#ffc107] uppercase tracking-wider mb-1">
                      Año Lectivo
                    </span>
                    <div className="relative inline-block">
                      <select
                        value={selectedCycleName}
                        onChange={(e) => setSelectedCycleName(e.target.value)}
                        className="bg-[#0b2844] text-white text-xs font-bold px-2.5 py-1.5 rounded border border-slate-500 focus:outline-none focus:border-amber-400 appearance-none pr-6 cursor-pointer"
                      >
                        {ciclosList.map(c => (
                          <option key={c.id} value={c.nombre} className="bg-slate-900 text-white">
                            {c.nombre}
                          </option>
                        ))}
                        {ciclosList.length === 0 && (
                          <option value="2026-2027">2026-2027</option>
                        )}
                      </select>
                      <ChevronDown size={13} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    </div>
                  </div>

                  {/* Total de Estudiantes */}
                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] sm:text-xs font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Total de Estudiantes
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      {totalStudents}
                    </span>
                  </div>

                  {/* Incremento Estudiantes */}
                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] sm:text-xs font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Incremento Estudiantes
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      5.21%
                    </span>
                  </div>

                  {/* Promedio Est. Por Paralelo */}
                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] sm:text-xs font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Promedio Est. Por Paralelo
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      21
                    </span>
                  </div>

                  {/* Capacidad Infraestructura */}
                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] sm:text-xs font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Capacidad Infraestructura
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      82%
                    </span>
                  </div>

                  {/* Fecha Actual */}
                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] sm:text-xs font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Fecha Actual
                    </span>
                    <span className="text-sm sm:text-base font-bold text-white tracking-tight mt-1 block">
                      {currentDateFormatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. SECONDARY METRIC RIBBON (WHITE CARD WITH EXACT CARDS & ICONS) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-300 p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                {/* Graduados Año Pasado */}
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Graduados Año Pasado
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1">
                    47
                  </span>
                </div>

                {/* Total Actual Docentes */}
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Total Actual Docentes
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs border border-amber-200">
                      👩‍🏫
                    </div>
                    <span className="text-2xl font-bold text-slate-900">
                      {totalTeachers}
                    </span>
                  </div>
                </div>

                {/* Total Días Clases */}
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Total Días Clases
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1">
                    211
                  </span>
                </div>

                {/* Total Días Asistidos */}
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Total Días Asistidos
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs border border-blue-200">
                      📝
                    </div>
                    <span className="text-2xl font-bold text-slate-900">
                      120
                    </span>
                  </div>
                </div>

                {/* Pagos Atrasados Mes */}
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Pagos Atrasados Mes
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1">
                    56
                  </span>
                </div>

                {/* Pagos/Deuda Acumulada */}
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Pagos/Deuda Acumulada
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold text-xs border border-rose-200">
                      🧾
                    </div>
                    <span className="text-2xl font-bold text-slate-900">
                      85
                    </span>
                  </div>
                </div>

                {/* Monto Total Adeudado */}
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Monto Total Adeudado
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1">
                    $19.525
                  </span>
                </div>
              </div>

              {/* 3. MAIN DASHBOARD CONTENT (ASISTENCIAS + GÉNERO + TABLA MATRICIAL DE NIVELES) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Left Column: Asistencias y Ausencias Bar Chart + Donut de Género */}
                <div className="lg:col-span-7 bg-white rounded-xl shadow-xs border border-slate-300 p-4 flex flex-col justify-between">
                  <div>
                    {/* Header with Legend */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <span>Asistencias y Ausencias por Mes</span>
                      </h3>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="flex items-center gap-1 text-[#0f3458]">
                          <span className="w-3 h-3 rounded-xs bg-[#0f3458] inline-block"></span>
                          Asistencias
                        </span>
                        <span className="flex items-center gap-1 text-[#eab308]">
                          <span className="w-3 h-3 rounded-xs bg-[#eab308] inline-block"></span>
                          Ausencias
                        </span>
                      </div>
                    </div>

                    {/* Bar Chart Bars with exact percentages */}
                    <div className="grid grid-cols-6 gap-2 sm:gap-3 items-end h-44 pt-4 px-2">
                      {attendanceMonthly.map((m, idx) => (
                        <div key={idx} className="flex flex-col items-center h-full justify-end group">
                          {/* Percent Pill */}
                          <span className="text-[10px] font-extrabold text-white bg-slate-800 px-1 py-0.5 rounded shadow-xs mb-1 opacity-90 group-hover:opacity-100 transition-opacity">
                            {m.asistencias.toFixed(2)}%
                          </span>
                          
                          {/* Stacked Bar container */}
                          <div className="w-full max-w-[46px] bg-[#0f3458] rounded-t-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 group-hover:brightness-110" style={{ height: `${m.asistencias * 1.3}px` }}>
                            {/* Ausencias Top Cap */}
                            <div 
                              className="w-full bg-[#eab308]" 
                              style={{ height: `${Math.max(4, m.ausencias * 2)}px` }}
                              title={`Ausencias: ${m.ausencias.toFixed(2)}%`}
                            ></div>
                            {/* Inner Value Text */}
                            <div className="text-[9px] font-bold text-white text-center pb-2 tracking-tighter">
                              {m.asistencias.toFixed(2)}%
                            </div>
                          </div>

                          {/* Month Label */}
                          <span className="text-[10px] font-bold text-slate-700 mt-1 uppercase">
                            {m.mes}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Donut Chart Género (MASCULINO vs FEMENINO) */}
                  <div className="border-t border-slate-200 pt-3 mt-4 flex flex-col sm:flex-row items-center justify-around gap-4">
                    <div className="flex items-center gap-4">
                      {/* SVG Donut Chart */}
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                          {/* Masculino segment (50.59%) */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke="#0f3458"
                            strokeWidth="24"
                            strokeDasharray="121 238"
                            strokeDashoffset="0"
                          />
                          {/* Femenino segment (49.41%) */}
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke="#853625"
                            strokeWidth="24"
                            strokeDasharray="117 238"
                            strokeDashoffset="-121"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Género</span>
                          <span className="text-xs font-black text-slate-800">100%</span>
                        </div>
                      </div>

                      {/* Legend and Data details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#0f3458] inline-block"></span>
                          <div>
                            <span className="text-xs font-bold text-slate-800">MASCULINO: </span>
                            <span className="text-xs font-extrabold text-[#0f3458]">388 (50.59%)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#853625] inline-block"></span>
                          <div>
                            <span className="text-xs font-bold text-slate-800">FEMENINO: </span>
                            <span className="text-xs font-extrabold text-[#853625]">379 (49.41%)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center max-w-[200px]">
                      <span className="font-bold text-slate-700 block">Equidad de Género</span>
                      <span>Distribución equilibrada y balanceada de matrícula escolar.</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Distribución por Nivel / Grado Matrix */}
                <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-slate-300 overflow-hidden flex flex-col">
                  <div className="bg-[#0f3458] text-white px-3 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Distribución por Nivel y Cursos</span>
                    <span className="text-amber-300 font-mono">Año 2026-2027</span>
                  </div>

                  <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0b2844] text-white text-[11px] font-semibold sticky top-0 z-10">
                          <th className="py-1.5 px-2.5">Nivel</th>
                          <th className="py-1.5 px-2 text-center">Paralelos</th>
                          <th className="py-1.5 px-2 text-center">Femenino</th>
                          <th className="py-1.5 px-2 text-center">Masculino</th>
                          <th className="py-1.5 px-2.5 text-center font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {levelDistribution.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white hover:bg-blue-50/50' : 'bg-slate-50/70 hover:bg-blue-50/50'}>
                            <td className="py-1.5 px-2.5 font-medium text-slate-800 whitespace-nowrap">
                              {row.nivel}
                            </td>
                            <td className="py-1.5 px-2 text-center text-slate-600 font-mono">
                              {row.paralelos}
                            </td>
                            <td className="py-1.5 px-2 text-center text-[#853625] font-semibold">
                              {row.fem}
                            </td>
                            <td className="py-1.5 px-2 text-center text-[#0f3458] font-semibold">
                              {row.masc}
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-bold text-slate-900 bg-slate-100/60">
                              {row.total}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#0f3458] text-white font-bold text-xs sticky bottom-0">
                          <td className="py-2 px-2.5 uppercase tracking-wider">Total</td>
                          <td className="py-2 px-2 text-center font-mono text-amber-300">{totalParalelos}</td>
                          <td className="py-2 px-2 text-center font-mono text-amber-300">{totalFem}</td>
                          <td className="py-2 px-2 text-center font-mono text-amber-300">{totalMasc}</td>
                          <td className="py-2 px-2.5 text-center font-mono text-[#ffc107] text-sm">{totalSum}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* 4. BOTTOM CHART: PROMEDIO POR CURSO LINE CHART */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-300 p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#0f3458]" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Promedio Por Curso (Rendimiento Académico)
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-slate-500 font-medium">
                      <span className="w-3 h-0.5 bg-slate-400 inline-block border-t border-dashed"></span>
                      Meta Institucional (9.50)
                    </span>
                    <span className="flex items-center gap-1 text-[#0f3458] font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0f3458] inline-block"></span>
                      Promedio Real
                    </span>
                  </div>
                </div>

                {/* SVG Curve Line Chart */}
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[700px] h-48 relative pt-4 pb-8">
                    {/* Benchmark 9.50 line */}
                    <div className="absolute top-[25%] left-0 right-0 border-t border-dashed border-slate-300 flex items-center justify-end pr-2">
                      <span className="text-[10px] font-bold text-slate-400 bg-white px-1 -mt-2.5">9,50</span>
                    </div>

                    {/* SVG Graphic */}
                    <svg viewBox="0 0 800 130" className="w-full h-28 overflow-visible">
                      <polyline
                        fill="none"
                        stroke="#0f3458"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points="
                          20,10 
                          70,10 
                          120,15 
                          170,45 
                          220,50 
                          270,60 
                          320,60 
                          370,55 
                          420,95 
                          470,90 
                          520,95 
                          570,85 
                          620,85 
                          670,80 
                          720,85 
                          770,75
                        "
                      />
                      {/* Dots and Labels */}
                      {[
                        { x: 20, y: 10, val: '9.9' },
                        { x: 70, y: 10, val: '9.9' },
                        { x: 120, y: 15, val: '9.8' },
                        { x: 170, y: 45, val: '9.2' },
                        { x: 220, y: 50, val: '9.1' },
                        { x: 270, y: 60, val: '8.9' },
                        { x: 320, y: 60, val: '8.9' },
                        { x: 370, y: 55, val: '9.0' },
                        { x: 420, y: 95, val: '8.2' },
                        { x: 470, y: 90, val: '8.3' },
                        { x: 520, y: 95, val: '8.2' },
                        { x: 570, y: 85, val: '8.4' },
                        { x: 620, y: 85, val: '8.4' },
                        { x: 670, y: 80, val: '8.5' },
                        { x: 720, y: 85, val: '8.4' },
                        { x: 770, y: 75, val: '8.6' },
                      ].map((pt, idx) => (
                        <g key={idx}>
                          <circle cx={pt.x} cy={pt.y} r="4" fill="#ffc107" stroke="#0f3458" strokeWidth="2" />
                          <text x={pt.x} y={pt.y - 8} textAnchor="middle" fill="#0f3458" fontSize="10" fontWeight="bold">
                            {pt.val}
                          </text>
                        </g>
                      ))}
                    </svg>

                    {/* X-axis Course Labels */}
                    <div className="grid grid-cols-16 gap-1 text-[9px] font-semibold text-slate-600 text-center mt-2">
                      {levelDistribution.map((row, i) => (
                        <div key={i} className="truncate transform -rotate-30 origin-top-left pt-1" title={row.nivel}>
                          {row.nivel.replace(' Básica', 'º').replace(' Bachillerato', 'º Bach')}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: INFORMES DOCENTES (RICH KPI DASHBOARD) */}
          {/* ========================================================================= */}
          {activeTab === 'docentes' && (
            <div className="space-y-3">
              {/* 1. TOP NAVY BANNER */}
              <div className="bg-[#0f3458] text-white rounded-xl shadow-md border border-[#0b2844] p-4 lg:p-5 flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-[240px]">
                  {institutionLogo ? (
                    <img 
                      src={institutionLogo} 
                      alt="Logo Escuela" 
                      className="w-14 h-14 object-contain rounded-lg bg-white p-1 shadow-sm border border-amber-300/40"
                    />
                  ) : (
                    <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-900 shadow-md border border-amber-300/50">
                      <GraduationCap size={28} className="text-white" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#ffc107] uppercase leading-none font-serif">
                      {institutionName || 'UNIDAD EDUCATIVA'}
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-widest mt-1">
                      Panel de Desempeño y Plantilla Docente
                    </p>
                  </div>
                </div>

                {/* Top KPIs Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 w-full lg:w-auto text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-600/50">
                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Total Docentes
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      {totalTeachers}
                    </span>
                  </div>

                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Horas Semanales
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      1,320 h
                    </span>
                  </div>

                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Puntualidad & Asist.
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      98.6%
                    </span>
                  </div>

                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Ratio Estudiante/Prof
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      17:1
                    </span>
                  </div>

                  <div className="px-2 pt-2 sm:pt-0 col-span-2 sm:col-span-1">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Fecha Actual
                    </span>
                    <span className="text-sm sm:text-base font-bold text-white tracking-tight mt-1 block">
                      {currentDateFormatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. SECONDARY METRIC RIBBON */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-300 p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Planeaciones a Tiempo
                  </span>
                  <span className="text-2xl font-bold text-emerald-700 mt-1">
                    97.4%
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Actas de Calificaciones
                  </span>
                  <span className="text-2xl font-bold text-[#0f3458] mt-1">
                    99.1%
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Docentes con Posgrado
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1">
                    28
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Capacitaciones Activas
                  </span>
                  <span className="text-2xl font-bold text-amber-700 mt-1">
                    18
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Evaluación Desempeño
                  </span>
                  <span className="text-2xl font-bold text-emerald-700 mt-1">
                    9.4 / 10
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Materias Cubiertas
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1">
                    {materiasList.length || 32}
                  </span>
                </div>
              </div>

              {/* 3. CHARTS AND BREAKDOWN GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Academic Distribution & Hours */}
                <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-slate-300 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                    <span>Nivel Académico del Claustro Docente</span>
                    <span className="text-emerald-700 font-bold">100% Titulados</span>
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>Maestría / Posgrado (63.6%)</span>
                        <span>28 Docentes</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#0f3458] rounded-full" style={{ width: '63.6%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>Licenciatura Especializada (27.2%)</span>
                        <span>12 Docentes</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: '27.2%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>Doctorado / PhD (9.2%)</span>
                        <span>4 Docentes</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '9.2%' }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                    <span className="font-semibold">Horas Promedio por Profesor:</span>
                    <span className="font-extrabold text-[#0f3458] text-sm">30 hrs / semana</span>
                  </div>
                </div>

                {/* Cumplimiento por Área Académica */}
                <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-slate-300 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                    <span>Cumplimiento por Área Académica</span>
                    <span className="text-blue-700 font-bold">Ciclo Vigente</span>
                  </h3>

                  <div className="space-y-2.5">
                    {[
                      { area: 'Matemáticas y Ciencias Exactas', pct: 98.4, docentes: 10 },
                      { area: 'Lenguaje, Literatura y Humanidades', pct: 99.0, docentes: 12 },
                      { area: 'Ciencias Naturales y Biología', pct: 96.5, docentes: 8 },
                      { area: 'Lenguas Extranjeras (Inglés/Francés)', pct: 97.8, docentes: 9 },
                      { area: 'Artes, Deportes y Desarrollo Humano', pct: 98.9, docentes: 5 },
                    ].map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 hover:bg-blue-50/50 rounded-lg border border-slate-200 transition-colors flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800">{item.area}</div>
                          <div className="text-[10px] text-slate-500">{item.docentes} docentes asignados</div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-extrabold text-emerald-700">{item.pct}%</span>
                          <span className="block text-[9px] text-slate-400 font-semibold uppercase">Efectividad</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: INFORMES ALUMNOS (RICH KPI DASHBOARD) */}
          {/* ========================================================================= */}
          {activeTab === 'alumnos' && (
            <div className="space-y-3">
              {/* 1. TOP NAVY BANNER */}
              <div className="bg-[#0f3458] text-white rounded-xl shadow-md border border-[#0b2844] p-4 lg:p-5 flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-[240px]">
                  {institutionLogo ? (
                    <img 
                      src={institutionLogo} 
                      alt="Logo Escuela" 
                      className="w-14 h-14 object-contain rounded-lg bg-white p-1 shadow-sm border border-amber-300/40"
                    />
                  ) : (
                    <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-900 shadow-md border border-amber-300/50">
                      <Users size={28} className="text-white" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#ffc107] uppercase leading-none font-serif">
                      {institutionName || 'UNIDAD EDUCATIVA'}
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-widest mt-1">
                      Panel de Rendimiento Escolar y Matrícula Estudiantil
                    </p>
                  </div>
                </div>

                {/* Top KPIs Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 w-full lg:w-auto text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-600/50">
                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Matrícula Activa
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      {totalStudents}
                    </span>
                  </div>

                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Promedio Global
                    </span>
                    <span className="text-2xl font-bold text-amber-300 tracking-tight">
                      9.2 / 10
                    </span>
                  </div>

                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Tasa Aprobación
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      98.1%
                    </span>
                  </div>

                  <div className="px-2 pt-2 sm:pt-0">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Asistencia General
                    </span>
                    <span className="text-2xl font-bold text-white tracking-tight">
                      96.8%
                    </span>
                  </div>

                  <div className="px-2 pt-2 sm:pt-0 col-span-2 sm:col-span-1">
                    <span className="block text-[11px] font-bold text-[#ffc107] uppercase tracking-wider mb-0.5">
                      Fecha Actual
                    </span>
                    <span className="text-sm sm:text-base font-bold text-white tracking-tight mt-1 block">
                      {currentDateFormatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. SECONDARY METRIC RIBBON */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-300 p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Cuadro de Honor (9.5-10)
                  </span>
                  <span className="text-2xl font-bold text-amber-600 mt-1">
                    142
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Alumnos Becados
                  </span>
                  <span className="text-2xl font-bold text-[#0f3458] mt-1">
                    68
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    En Riesgo Académico
                  </span>
                  <span className="text-2xl font-bold text-rose-600 mt-1">
                    12
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Nuevos Ingresos
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1">
                    118
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Retención Escolar
                  </span>
                  <span className="text-2xl font-bold text-emerald-700 mt-1">
                    99.2%
                  </span>
                </div>

                <div className="px-2 flex flex-col justify-center items-center">
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    Turno Matutino
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1">
                    100%
                  </span>
                </div>
              </div>

              {/* 3. CHARTS AND DETAILS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Distribución por Rangos de Calificación */}
                <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-slate-300 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                    <span>Distribución de Calificaciones</span>
                    <span className="text-amber-600 font-bold">Excelente Rendimiento</span>
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="text-amber-700">⭐ Excelencia Académica (9.5 - 10.0)</span>
                        <span>38.5% (295 alumnos)</span>
                      </div>
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '38.5%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="text-emerald-700">🟢 Sobresaliente (8.5 - 9.4)</span>
                        <span>44.2% (339 alumnos)</span>
                      </div>
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: '44.2%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="text-blue-700">🔵 Aprobatorio Regular (7.0 - 8.4)</span>
                        <span>15.7% (121 alumnos)</span>
                      </div>
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#0f3458] rounded-full" style={{ width: '15.7%' }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span className="text-rose-700">🔴 En Riesgo (&lt; 7.0)</span>
                        <span>1.6% (12 alumnos)</span>
                      </div>
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: '1.6%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cuadro de Honor / Top Alumnos */}
                <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-slate-300 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Award size={15} className="text-amber-500" />
                      <span>Cuadro de Honor Institucional</span>
                    </span>
                    <span className="text-xs text-amber-700 font-bold">Promedios 10.0</span>
                  </h3>

                  <div className="space-y-2">
                    {[
                      { nombre: 'Camila Valentina Méndez Ruiz', grado: '3ero. Bachillerato A', promedio: '10.0', beca: 'Beca Excelencia' },
                      { nombre: 'Mateo Alejandro Torres Gómez', grado: '2do. Bachillerato B', promedio: '10.0', beca: 'Mérito Académico' },
                      { nombre: 'Sofía Isabella Navarro Cruz', grado: '6to. Básica A', promedio: '9.9', beca: 'Beca Integral' },
                      { nombre: 'Santiago Emilio Delgado Soto', grado: '5to. Básica B', promedio: '9.9', beca: 'Mérito Deportivo' },
                    ].map((st, i) => (
                      <div key={i} className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-900 font-black text-xs flex items-center justify-center shadow-xs">
                            {i + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{st.nombre}</div>
                            <div className="text-[10px] text-slate-500">{st.grado} • {st.beca}</div>
                          </div>
                        </div>
                        <span className="text-xs font-black text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-300 shadow-xs">
                          {st.promedio}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-800">
              {institutionName} • Datos Sincronizados con Google Workspace (Drive & Sheets)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer text-xs uppercase tracking-wider"
            >
              Cerrar Panel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
