import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  Search, 
  Filter, 
  Users, 
  BookOpen, 
  GraduationCap, 
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Building2,
  FolderOpen,
  ExternalLink
} from 'lucide-react';
import { resolveDriveFolderLink } from '../driveLinks';

export type TablePrintType = 'alumnos' | 'maestros' | 'materias' | 'calificaciones';

interface DirectTablePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: TablePrintType;
  institutionName: string;
  institutionLogo?: string;
  alumnosList: any[];
  materiasList: any[];
  systemUsers: any[];
  ciclosList: any[];
  calificacionesList?: any[];
  workspaceResult?: any;
  folderLink?: string | null;
  sheetLink?: string | null;
  playClickSound?: () => void;
  playSuccessSound?: () => void;
}

export const DirectTablePrintModal: React.FC<DirectTablePrintModalProps> = ({
  isOpen,
  onClose,
  type,
  institutionName,
  institutionLogo,
  alumnosList,
  materiasList,
  systemUsers,
  ciclosList,
  calificacionesList = [],
  workspaceResult,
  folderLink,
  sheetLink,
  playClickSound,
  playSuccessSound
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNivel, setFilterNivel] = useState('todos');
  const [filterGrado, setFilterGrado] = useState('todos');
  const [filterEstatus, setFilterEstatus] = useState('todos');

  // Resolved Google Drive Folder Link for the active table
  const activeDriveLink = useMemo(() => {
    return resolveDriveFolderLink(type, workspaceResult, folderLink, sheetLink);
  }, [type, workspaceResult, folderLink, sheetLink]);

  // Active ciclo escolar
  const activeCiclo = useMemo(() => {
    return ciclosList.find(c => c.estatus === 'Activo')?.nombre || 'Ciclo Escolar 2026-2027';
  }, [ciclosList]);

  // Today's formatted date
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }, []);

  // Filtered Alumnos
  const filteredAlumnos = useMemo(() => {
    return alumnosList.filter(a => {
      const matchSearch = `${a.nombres || ''} ${a.apellidos || ''} ${a.matricula || ''} ${a.email || ''} ${a.curp || ''} ${a.grado || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      
      const matchNivel = filterNivel === 'todos' || (a.nivel || 'Primaria').toLowerCase() === filterNivel.toLowerCase();
      const matchGrado = filterGrado === 'todos' || (a.grado || '').toLowerCase() === filterGrado.toLowerCase();
      const matchEstatus = filterEstatus === 'todos' || (a.estatus || 'Activo').toLowerCase() === filterEstatus.toLowerCase();

      return matchSearch && matchNivel && matchGrado && matchEstatus;
    });
  }, [alumnosList, searchQuery, filterNivel, filterGrado, filterEstatus]);

  // Filtered Maestros
  const filteredMaestros = useMemo(() => {
    const teachers = systemUsers.filter(u => u.role === 'Maestros' || u.role === 'Docente' || u.role === 'Directivo');
    return teachers.filter(t => {
      const matchSearch = `${t.name || ''} ${t.username || ''} ${t.email || ''} ${t.role || ''} ${t.id || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchEstatus = filterEstatus === 'todos' || (t.status || 'Activo').toLowerCase() === filterEstatus.toLowerCase();
      return matchSearch && matchEstatus;
    });
  }, [systemUsers, searchQuery, filterEstatus]);

  // Filtered Materias
  const filteredMaterias = useMemo(() => {
    return materiasList.filter(m => {
      const matchSearch = `${m.nombre || ''} ${m.profesor || ''} ${m.clave || ''} ${m.area || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchNivel = filterNivel === 'todos' || (m.area || '').toLowerCase().includes(filterNivel.toLowerCase());
      const matchEstatus = filterEstatus === 'todos' || (m.estatus || 'Activa').toLowerCase() === filterEstatus.toLowerCase();
      return matchSearch && matchNivel && matchEstatus;
    });
  }, [materiasList, searchQuery, filterNivel, filterEstatus]);

  const handlePrint = () => {
    if (playClickSound) playClickSound();
    window.print();
  };

  const exportToCSV = () => {
    if (playSuccessSound) playSuccessSound();
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (type === 'alumnos') {
      filename = `Lista_General_Alumnos_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['ID', 'Matricula', 'Nombres', 'Apellidos', 'Grado / Grupo', 'Carrera / Nivel', 'Correo Electrónico', 'Estatus', 'Fecha de Registro'];
      rows = filteredAlumnos.map((a, idx) => [
        (idx + 1).toString(),
        a.matricula || a.id || `ALU-${idx + 1}`,
        a.nombres || '',
        a.apellidos || `${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''}`.trim(),
        `${a.grado || ''} ${a.grupo ? '• Grupo ' + a.grupo : ''}`.trim(),
        a.nivel || 'Primaria',
        a.email || '',
        a.estatus || 'Activo',
        a.fechaInscripcion || todayStr
      ]);
    } else if (type === 'maestros') {
      filename = `Lista_General_Docentes_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['ID', 'Cédula / Nómina', 'Nombres y Apellidos', 'Usuario', 'Rol / Categoría', 'Correo Electrónico', 'Estatus', 'Fecha de Registro'];
      rows = filteredMaestros.map((t, idx) => [
        (idx + 1).toString(),
        `DOC-${t.id ? t.id.slice(-4) : (idx + 1).toString().padStart(4, '0')}`,
        t.name || '',
        t.username || '',
        t.role || 'Docente',
        t.email || '',
        t.status || 'Activo',
        t.fechaRegistro || todayStr
      ]);
    } else if (type === 'materias') {
      filename = `Plan_General_Materias_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['ID', 'Clave', 'Materia / Asignatura', 'Profesor Asignado', 'Créditos', 'Área / Nivel', 'Estatus', 'Fecha de Registro'];
      rows = filteredMaterias.map((m, idx) => [
        (idx + 1).toString(),
        m.clave || `MAT-${m.id ? m.id.slice(-4) : (idx + 1).toString().padStart(4, '0')}`,
        m.nombre || '',
        m.profesor || 'Sin Asignar',
        `${m.creditos || 0} Créditos`,
        m.area || 'Tronco Común',
        m.estatus || 'Activa',
        m.fechaCreacion || todayStr
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(','), ...rows.map(e => e.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTitle = () => {
    switch (type) {
      case 'alumnos': return 'LISTA GENERAL DE ALUMNOS';
      case 'maestros': return 'LISTA GENERAL DE DOCENTES Y PERSONAL';
      case 'materias': return 'PLAN GENERAL DE MATERIAS Y ASIGNATURAS';
      default: return 'LISTA GENERAL';
    }
  };

  const getSubtitle = () => {
    switch (type) {
      case 'alumnos': return 'Registro Oficial de Matrícula y Expedientes';
      case 'maestros': return 'Plantilla Oficial de Profesores y Personal Académico';
      case 'materias': return 'Estructura Curricular y Asignación Docente';
      default: return 'Reporte General';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] my-auto">
        
        {/* Modal Top Bar (Hidden on Print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-600 text-white rounded-xl shadow-sm">
              {type === 'alumnos' && <Users size={22} />}
              {type === 'maestros' && <GraduationCap size={22} />}
              {type === 'materias' && <BookOpen size={22} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{getTitle()}</h2>
              <p className="text-xs text-slate-500">{getSubtitle()} • {institutionName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={activeDriveLink.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => playClickSound?.()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3.5 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
              title={activeDriveLink.tooltip}
            >
              <FolderOpen size={16} />
              <span>Abrir</span>
            </a>
            <button
              onClick={exportToCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-3.5 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
              title="Descargar datos en formato Excel/CSV"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-md flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
              title="Imprimir formato oficial"
            >
              <Printer size={16} />
              <span>Imprimir Formato</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters and Controls (Hidden on Print) */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar en la tabla..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            {type === 'alumnos' && (
              <>
                <select
                  value={filterNivel}
                  onChange={(e) => setFilterNivel(e.target.value)}
                  className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="todos">Todos los Niveles</option>
                  <option value="Preescolar">Preescolar</option>
                  <option value="Primaria">Primaria</option>
                  <option value="Secundaria">Secundaria</option>
                  <option value="Bachillerato">Bachillerato</option>
                </select>
                <select
                  value={filterEstatus}
                  onChange={(e) => setFilterEstatus(e.target.value)}
                  className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="todos">Todos los Estatus</option>
                  <option value="Activo">Solo Activos</option>
                  <option value="Inactivo">Inactivos</option>
                  <option value="Baja">Baja</option>
                </select>
              </>
            )}

            {type === 'materias' && (
              <select
                value={filterEstatus}
                onChange={(e) => setFilterEstatus(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="todos">Todos los Estatus</option>
                <option value="Activa">Solo Activas</option>
                <option value="Inactiva">Inactivas</option>
              </select>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total en reporte: <span className="font-bold text-slate-800">
              {type === 'alumnos' ? filteredAlumnos.length : type === 'maestros' ? filteredMaestros.length : filteredMaterias.length}
            </span> registros
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/50 print:bg-white print:p-0">
          <div 
            id="table-print-area" 
            className="bg-white mx-auto max-w-[1100px] border border-slate-200 shadow-sm p-6 sm:p-8 rounded-lg print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full"
          >
            {/* Header matching institutional standards */}
            <div className="border-b-2 border-slate-800 pb-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {institutionLogo ? (
                  <img src={institutionLogo} alt="Logo" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-11 h-11 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-lg">
                    {institutionName ? institutionName.charAt(0) : 'E'}
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                    {institutionName || 'SISTEMA EDUCATIVO'}
                  </h1>
                  <p className="text-xs font-bold text-slate-700 tracking-wide">
                    {getTitle()}
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                <div><strong>Ciclo:</strong> {activeCiclo}</div>
                <div><strong>Fecha de emisión:</strong> {todayStr}</div>
                <div><strong>Total Registros:</strong> {
                  type === 'alumnos' ? filteredAlumnos.length : 
                  type === 'maestros' ? filteredMaestros.length : 
                  filteredMaterias.length
                }</div>
              </div>
            </div>

            {/* TABLA PRINCIPAL: Exactly matching the format uploaded by user */}
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-[11px] font-sans text-slate-800 print:text-[10px]" style={{ width: '100%' }}>
                
                {/* 1. Alumnos Table */}
                {type === 'alumnos' && (
                  <>
                    <thead>
                      <tr className="bg-slate-50 text-slate-800 font-bold border border-slate-400">
                        <th className="border border-slate-400 py-1.5 px-2 text-center w-10 font-bold">ID</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold w-24">Matricula</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold">Nombres</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold">Apellidos</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold w-28">Grado / Grupo</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold w-28">Carrera / Nivel</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold">Correo Electróni</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-center font-bold w-16">Estatus</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-center font-bold w-24">Fecha de Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlumnos.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-600 font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 font-mono font-medium text-slate-800">
                            {item.matricula || item.id || `ALU-${(idx + 1).toString().padStart(4, '0')}`}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 font-medium text-slate-900">
                            {item.nombres || ''}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-800">
                            {item.apellidos || `${item.apellidoPaterno || ''} ${item.apellidoMaterno || ''}`.trim() || '—'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-700">
                            {item.grado || '1°'} {item.grupo ? `• Grupo ${item.grupo}` : ''}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-700">
                            {item.nivel || 'Primaria'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-600 font-mono text-[10px]">
                            {item.email || '—'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              (item.estatus || 'Activo').toLowerCase() === 'activo'
                                ? 'bg-emerald-50 text-emerald-700 font-bold'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {item.estatus || 'Activo'}
                            </span>
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-600 text-[10px]">
                            {item.fechaInscripcion || todayStr}
                          </td>
                        </tr>
                      ))}
                      {filteredAlumnos.length === 0 && (
                        <tr>
                          <td colSpan={9} className="border border-slate-300 py-6 text-center text-slate-400">
                            No se encontraron registros de alumnos para los filtros seleccionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </>
                )}

                {/* 2. Maestros Table */}
                {type === 'maestros' && (
                  <>
                    <thead>
                      <tr className="bg-slate-50 text-slate-800 font-bold border border-slate-400">
                        <th className="border border-slate-400 py-1.5 px-2 text-center w-10 font-bold">ID</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold w-28">Cédula / Nómina</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold">Nombre del Docente</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold w-28">Usuario</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold w-32">Rol / Categoría</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold">Correo Electróni</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-center font-bold w-20">Estatus</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-center font-bold w-28">Fecha de Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaestros.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-600 font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 font-mono font-medium text-slate-800">
                            DOC-{item.id ? item.id.slice(-4) : (idx + 1).toString().padStart(4, '0')}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 font-medium text-slate-900">
                            {item.name || '—'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-600 font-mono text-[10px]">
                            @{item.username || 'docente'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-700">
                            {item.role || 'Docente'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-600 font-mono text-[10px]">
                            {item.email || '—'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              {item.status || 'Activo'}
                            </span>
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-600 text-[10px]">
                            {item.fechaRegistro || todayStr}
                          </td>
                        </tr>
                      ))}
                      {filteredMaestros.length === 0 && (
                        <tr>
                          <td colSpan={8} className="border border-slate-300 py-6 text-center text-slate-400">
                            No se encontraron registros de docentes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </>
                )}

                {/* 3. Materias Table */}
                {type === 'materias' && (
                  <>
                    <thead>
                      <tr className="bg-slate-50 text-slate-800 font-bold border border-slate-400">
                        <th className="border border-slate-400 py-1.5 px-2 text-center w-10 font-bold">ID</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold w-24">Clave</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold">Materia / Asignatura</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold">Profesor Asignado</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-center font-bold w-20">Créditos</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-left font-bold w-32">Área / Nivel</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-center font-bold w-16">Estatus</th>
                        <th className="border border-slate-400 py-1.5 px-2 text-center font-bold w-24">Fecha de Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterias.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-600 font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 font-mono font-medium text-slate-800">
                            {item.clave || `MAT-${item.id ? item.id.slice(-4) : (idx + 1).toString().padStart(4, '0')}`}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 font-medium text-slate-900">
                            {item.nombre || '—'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-700">
                            {item.profesor || 'Sin asignar'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center font-semibold text-slate-800">
                            {item.creditos || 0}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-slate-700">
                            {item.area || 'Tronco Común'}
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              {item.estatus || 'Activa'}
                            </span>
                          </td>
                          <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-600 text-[10px]">
                            {item.fechaCreacion || todayStr}
                          </td>
                        </tr>
                      ))}
                      {filteredMaterias.length === 0 && (
                        <tr>
                          <td colSpan={8} className="border border-slate-300 py-6 text-center text-slate-400">
                            No se encontraron materias registradas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </>
                )}

              </table>
            </div>

            {/* Footer and Signatures */}
            <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-6 text-[10px] text-slate-600">
              <div className="text-center">
                <div className="border-b border-slate-400 pb-8 mb-1"></div>
                <p className="font-bold text-slate-800">Control Escolar</p>
                <p className="text-[9px] text-slate-500">Revisión y Elaboración</p>
              </div>
              <div className="text-center">
                <div className="border-b border-slate-400 pb-8 mb-1"></div>
                <p className="font-bold text-slate-800">Dirección Académica</p>
                <p className="text-[9px] text-slate-500">Sello y Firma Oficial</p>
              </div>
              <div className="text-center col-span-2 sm:col-span-1">
                <div className="border-b border-slate-400 pb-8 mb-1"></div>
                <p className="font-bold text-slate-800">Fecha y Hora</p>
                <p className="text-[9px] text-slate-500">{new Date().toLocaleString('es-MX')}</p>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400">
              <span>{institutionName} • Sistema de Gestión Escolar</span>
              <span>Documento Oficial de Registro • didocu</span>
            </div>

          </div>
        </div>

        {/* Modal Bottom Actions (Hidden on Print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-500">
            Vista previa del formato oficial listo para exportar o imprimir en tamaño carta.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>Imprimir Documento</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
