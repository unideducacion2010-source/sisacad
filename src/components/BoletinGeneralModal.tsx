import React, { useState, useMemo } from 'react';
import { 
  Users, 
  GraduationCap, 
  ClipboardList, 
  Printer, 
  Download, 
  FolderOpen,
  X, 
  Search, 
  Sparkles, 
  School, 
  Building,
  CheckCircle2,
  Calendar,
  FileText
} from 'lucide-react';
import { resolveDriveFolderLink } from '../driveLinks';
import { DEFAULT_VILLA_MONTESSORI_LOGO } from '../assets/logo';

export interface AlumnoItem {
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
  telefono?: string;
  promedio?: string | number;
  estatus?: string;
  tutor?: string;
  direccion?: string;
  fechaNacimiento?: string;
}

export interface CalificacionItem {
  id: string;
  alumno: string;
  materia: string;
  parcial: string;
  calificacion: number;
  observaciones?: string;
  fecha?: string;
}

export interface MateriaItem {
  id: string;
  clave?: string;
  nombre: string;
  profesor: string;
  creditos: number;
  area?: string;
  grado?: string;
  estatus?: string;
}

export interface CicloEscolarItem {
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

export interface SystemUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  status: 'Activo' | 'Inactivo';
}

interface BoletinGeneralModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutionName: string;
  institutionLogo: string;
  alumnosList: AlumnoItem[];
  calificacionesList: CalificacionItem[];
  materiasList: MateriaItem[];
  ciclosList: CicloEscolarItem[];
  systemUsers?: SystemUser[];
  sheetLink?: string | null;
  folderLink?: string | null;
  workspaceResult?: any;
  playClickSound?: () => void;
  playSuccessSound?: () => void;
}

export const BoletinGeneralModal: React.FC<BoletinGeneralModalProps> = ({
  isOpen,
  onClose,
  institutionName,
  institutionLogo,
  alumnosList,
  calificacionesList,
  materiasList,
  ciclosList,
  sheetLink,
  folderLink,
  workspaceResult,
  playClickSound,
  playSuccessSound
}) => {
  const effectiveLogo = institutionLogo || DEFAULT_VILLA_MONTESSORI_LOGO;

  // 3 Primary Options
  const [activeTab, setActiveTab] = useState<'alumnos' | 'kardex' | 'asistencia'>('alumnos');

  // Resolved Google Drive Link based on the active tab/window
  const activeDriveLink = useMemo(() => {
    let category: 'alumnos' | 'kardex' | 'asistencia' = 'alumnos';
    if (activeTab === 'kardex') category = 'kardex';
    else if (activeTab === 'asistencia') category = 'asistencia';
    return resolveDriveFolderLink(category, workspaceResult, folderLink, sheetLink);
  }, [activeTab, workspaceResult, folderLink, sheetLink]);

  // Search & Filter state for "Lista de alumnos"
  const [searchAlumno, setSearchAlumno] = useState('');
  const [filterGradoAlumno, setFilterGradoAlumno] = useState('Todos');
  const [filterGrupoAlumno, setFilterGrupoAlumno] = useState('Todos');
  const [filterEstatusAlumno, setFilterEstatusAlumno] = useState('Todos');

  // Search & Filter state for "Kardex de calificaciones"
  const [searchKardex, setSearchKardex] = useState('');
  const [filterMateriaKardex, setFilterMateriaKardex] = useState('Todas');
  const [filterParcialKardex, setFilterParcialKardex] = useState('Todos');
  const [selectedStudentForKardex, setSelectedStudentForKardex] = useState<string>('all');
  const [kardexViewMode, setKardexViewMode] = useState<'table' | 'preview'>('table');
  const [kardexPrintFormat, setKardexPrintFormat] = useState<'montessori' | 'sep'>('montessori');
  const [asesorFeedbackData, setAsesorFeedbackData] = useState<Record<string, Array<{ aspecto: string; estado: string; observaciones: string }>>>({});

  // Configuration for "Lista de asistencia"
  const [asistenciaGrado, setAsistenciaGrado] = useState('Todos');
  const [asistenciaGrupo, setAsistenciaGrupo] = useState('Todos');
  const [asistenciaMes, setAsistenciaMes] = useState('Septiembre');
  const [asistenciaYear, setAsistenciaYear] = useState('2024');
  const [asistenciaDocente, setAsistenciaDocente] = useState('PATRICIA RAMÍREZ');
  const [asistenciaViewMode, setAsistenciaViewMode] = useState<'preview' | 'table'>('preview');

  // Active Cycle
  const activeCycle = useMemo(() => {
    return ciclosList.find(c => c.estatus === 'Activo') || ciclosList[0] || {
      nombre: 'CICLO ESCOLAR 2026-2027',
      periodo: 'Anual'
    };
  }, [ciclosList]);

  // Current Date formatted
  const currentDateFormatted = useMemo(() => {
    const now = new Date();
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    return `${day} de ${month} de ${year}`;
  }, []);

  // Unique Grades and Groups
  const uniqueGrados = useMemo(() => {
    const set = new Set<string>();
    alumnosList.forEach(a => {
      if (a.grado) set.add(a.grado);
    });
    return Array.from(set).sort();
  }, [alumnosList]);

  const uniqueGrupos = useMemo(() => {
    const set = new Set<string>();
    alumnosList.forEach(a => {
      if (a.grupo) set.add(a.grupo);
    });
    return Array.from(set).sort();
  }, [alumnosList]);

  // Helper for student name separation (Primer Apellido, Segundo Apellido, Nombres)
  const parseStudentName = (a: AlumnoItem) => {
    let primerApellido = '';
    let segundoApellido = '';
    let nombres = a.nombres || '';
    
    if (a.apellidos) {
      const parts = a.apellidos.trim().split(/\s+/);
      if (parts.length >= 2) {
        primerApellido = parts[0];
        segundoApellido = parts.slice(1).join(' ');
      } else {
        primerApellido = parts[0] || '';
      }
    } else {
      const parts = nombres.trim().split(/\s+/);
      if (parts.length >= 3) {
        primerApellido = parts[0];
        segundoApellido = parts[1];
        nombres = parts.slice(2).join(' ');
      } else if (parts.length === 2) {
        primerApellido = parts[0];
        nombres = parts[1];
      }
    }
    return {
      primerApellido: primerApellido.toUpperCase() || 'ALFARO',
      segundoApellido: segundoApellido.toUpperCase() || 'HERNANDEZ',
      nombres: nombres.toUpperCase() || 'ALUMNO',
      fullName: a.apellidos ? `${a.apellidos} ${a.nombres}`.toUpperCase() : a.nombres.toUpperCase()
    };
  };

  // Filtered and Alphabetically Sorted Students for "Lista de alumnos"
  const filteredAlumnos = useMemo(() => {
    const filtered = alumnosList.filter(a => {
      const fullName = `${a.apellidos || ''} ${a.nombres || ''}`.toLowerCase();
      const matricula = (a.matricula || a.id).toLowerCase();
      const curp = (a.curp || '').toLowerCase();
      const query = searchAlumno.toLowerCase();

      const matchesQuery = fullName.includes(query) || matricula.includes(query) || curp.includes(query);
      const matchesGrado = filterGradoAlumno === 'Todos' || a.grado === filterGradoAlumno;
      const matchesGrupo = filterGrupoAlumno === 'Todos' || (a.grupo || 'A') === filterGrupoAlumno;
      const matchesEstatus = filterEstatusAlumno === 'Todos' || (a.estatus || 'Activo') === filterEstatusAlumno;

      return matchesQuery && matchesGrado && matchesGrupo && matchesEstatus;
    });

    return filtered.sort((a, b) => {
      const nameA = `${a.apellidos || ''} ${a.nombres || ''}`.trim().toLowerCase();
      const nameB = `${b.apellidos || ''} ${b.nombres || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [alumnosList, searchAlumno, filterGradoAlumno, filterGrupoAlumno, filterEstatusAlumno]);

  // Filtered Calificaciones for "Kardex de calificaciones"
  const filteredCalificaciones = useMemo(() => {
    return calificacionesList.filter(c => {
      const alumnoMatch = selectedStudentForKardex === 'all' || c.alumno.toLowerCase() === selectedStudentForKardex.toLowerCase();
      const materiaMatch = filterMateriaKardex === 'Todas' || c.materia.toLowerCase() === filterMateriaKardex.toLowerCase();
      const parcialMatch = filterParcialKardex === 'Todos' || c.parcial.toLowerCase() === filterParcialKardex.toLowerCase();
      const queryMatch = !searchKardex || 
        c.alumno.toLowerCase().includes(searchKardex.toLowerCase()) || 
        c.materia.toLowerCase().includes(searchKardex.toLowerCase());

      return alumnoMatch && materiaMatch && parcialMatch && queryMatch;
    });
  }, [calificacionesList, selectedStudentForKardex, filterMateriaKardex, filterParcialKardex, searchKardex]);

  // Computed KPIs for Kardex
  const kardexKpis = useMemo(() => {
    const total = filteredCalificaciones.length;
    if (total === 0) return { total: 0, promedio: '0.0', aprobadas: 0, reprobadas: 0, tasaAprobacion: '0.0%' };
    const sum = filteredCalificaciones.reduce((acc, c) => acc + (Number(c.calificacion) || 0), 0);
    const avg = (sum / total).toFixed(1);
    const aprobadas = filteredCalificaciones.filter(c => Number(c.calificacion) >= 6).length;
    const reprobadas = total - aprobadas;
    const tasa = ((aprobadas / total) * 100).toFixed(1) + '%';
    return { total, promedio: avg, aprobadas, reprobadas, tasaAprobacion: tasa };
  }, [filteredCalificaciones]);

  // List of students to render for Kardex printing / preview
  const kardexStudentsToRender = useMemo(() => {
    if (selectedStudentForKardex !== 'all') {
      const found = alumnosList.find(a => {
        const full = `${a.nombres} ${a.apellidos}`.toLowerCase();
        const fullReverse = `${a.apellidos} ${a.nombres}`.toLowerCase();
        const match = selectedStudentForKardex.toLowerCase();
        return full === match || fullReverse === match || a.id === selectedStudentForKardex;
      });
      return found ? [found] : (alumnosList.length > 0 ? [alumnosList[0]] : []);
    }
    return filteredAlumnos.length > 0 ? filteredAlumnos : alumnosList;
  }, [selectedStudentForKardex, alumnosList, filteredAlumnos]);

  // Helper function to extract grade number (1, 2, 3, 4, 5, 6) from any grade string
  const normalizeGradoNumber = (gradoStr?: string): string => {
    if (!gradoStr) return '';
    const str = gradoStr.toString().toLowerCase().trim();
    if (str.includes('1') || str.includes('primer') || str.includes('1er') || str.includes('1ro')) return '1';
    if (str.includes('2') || str.includes('segundo') || str.includes('2do') || str.includes('2da')) return '2';
    if (str.includes('3') || str.includes('tercer') || str.includes('3ro') || str.includes('3ra') || str.includes('3er')) return '3';
    if (str.includes('4') || str.includes('cuarto') || str.includes('4to') || str.includes('4ta')) return '4';
    if (str.includes('5') || str.includes('quinto') || str.includes('5to') || str.includes('5ta')) return '5';
    if (str.includes('6') || str.includes('sexto') || str.includes('6to') || str.includes('6ta')) return '6';
    return str;
  };

  const matchesMateriaGrado = (materiaGrado?: string, alumnoGrado?: string): boolean => {
    if (!materiaGrado || materiaGrado === 'Todos' || materiaGrado === 'Todos los grados') return true;
    if (!alumnoGrado) return true;
    const numMat = normalizeGradoNumber(materiaGrado);
    const numAlum = normalizeGradoNumber(alumnoGrado);
    if (numMat && numAlum) {
      return numMat === numAlum;
    }
    return materiaGrado.toLowerCase().trim() === alumnoGrado.toLowerCase().trim();
  };

  // Function to get grades row for a student strictly corresponding to their grade level
  const getStudentSubjectGrades = (student: AlumnoItem) => {
    const studentName1 = `${student.nombres} ${student.apellidos}`.toLowerCase();
    const studentName2 = `${student.apellidos} ${student.nombres}`.toLowerCase();

    // 1. Determine subject list strictly for student's grade
    let subjectNamesForStudent: string[] = [];
    const gradeNumber = normalizeGradoNumber(student.grado);

    // Custom materias matching grade
    const customMatching = (materiasList || []).filter(m => matchesMateriaGrado(m.grado, student.grado));

    if (customMatching.length > 0) {
      subjectNamesForStudent = customMatching.map(m => m.nombre.toUpperCase());
    } else {
      // Standard grade subject defaults
      if (gradeNumber === '2') {
        subjectNamesForStudent = [
          'ESPAÑOL II',
          'MATEMATICAS II',
          'CIENCIAS II (ENFASIS EN FISICA)',
          'HISTORIA I',
          'LENGUA EXTRANJERA II',
          'FORMACION CIVICA Y ETICA I',
          'EDUCACION FISICA II',
          'TECNOLOGIA II',
          'ARTES II',
          'ORIENTACION Y TUTORIA'
        ];
      } else if (gradeNumber === '3') {
        subjectNamesForStudent = [
          'ESPAÑOL III',
          'MATEMATICAS III',
          'CIENCIAS III (ENFASIS EN QUIMICA)',
          'HISTORIA II',
          'LENGUA EXTRANJERA III',
          'FORMACION CIVICA Y ETICA II',
          'EDUCACION FISICA III',
          'TECNOLOGIA III',
          'ARTES III',
          'ORIENTACION Y TUTORIA'
        ];
      } else if (gradeNumber === '4' || gradeNumber === '5' || gradeNumber === '6') {
        subjectNamesForStudent = [
          'ESPAÑOL',
          'MATEMATICAS',
          'CIENCIAS NATURALES',
          'GEOGRAFIA',
          'HISTORIA',
          'FORMACION CIVICA Y ETICA',
          'EDUCACION ARTISTICA',
          'EDUCACION FISICA'
        ];
      } else {
        // Default / 1st grade
        subjectNamesForStudent = [
          'ESPAÑOL I',
          'MATEMATICAS I',
          'CIENCIAS I (ENFASIS EN BIOLOGIA)',
          'GEOGRAFIA DE MEXICO Y DEL MUNDO',
          'LENGUA EXTRANJERA I',
          'EDUCACION FISICA I',
          'TECNOLOGIA I',
          'ARTES I',
          'ASIGNATURA ESTATAL',
          'ORIENTACION Y TUTORIA'
        ];
      }
    }

    // Also include any specific materias registered in calificacionesList for this student
    const studentCalifs = calificacionesList.filter(c => {
      const cAlum = (c.alumno || '').toLowerCase();
      return cAlum === studentName1 || cAlum === studentName2 || cAlum.includes(student.nombres.toLowerCase());
    });

    studentCalifs.forEach(c => {
      const matUpper = c.materia.toUpperCase();
      if (!subjectNamesForStudent.some(s => s === matUpper || s.includes(matUpper) || matUpper.includes(s))) {
        subjectNamesForStudent.push(matUpper);
      }
    });

    return subjectNamesForStudent.map(subj => {
      // Find matching calificaciones for this student and subject
      const matches = studentCalifs.filter(c => {
        const cMat = (c.materia || '').toLowerCase();
        const sMat = subj.toLowerCase();
        return cMat.includes(sMat.slice(0, 5)) || sMat.includes(cMat.slice(0, 5));
      });

      // Map partials/trimestres to 3 Trimestres
      const t1 = matches.find(m => {
        const p = m.parcial.toLowerCase();
        return p.includes('1') || p.includes('1er') || p.includes('tri 1') || p.includes('trimestre 1') || p.includes('sep') || p.includes('oct') || p.includes('nov');
      })?.calificacion;

      const t2 = matches.find(m => {
        const p = m.parcial.toLowerCase();
        return p.includes('2') || p.includes('2do') || p.includes('tri 2') || p.includes('trimestre 2') || p.includes('dic') || p.includes('ene') || p.includes('feb') || p.includes('mar');
      })?.calificacion;

      const t3 = matches.find(m => {
        const p = m.parcial.toLowerCase();
        return p.includes('3') || p.includes('3er') || p.includes('tri 3') || p.includes('trimestre 3') || p.includes('abr') || p.includes('may') || p.includes('jun') || p.includes('jul');
      })?.calificacion;
      
      const registered = [t1, t2, t3].filter(v => v !== undefined && v !== null) as number[];
      let finalAvg: string | number = '';
      if (registered.length > 0) {
        finalAvg = (registered.reduce((a, b) => a + Number(b), 0) / registered.length).toFixed(1);
      } else if (matches.length > 0) {
        finalAvg = Number(matches[0].calificacion).toFixed(1);
      }

      const formattedT1 = t1 !== undefined ? Number(t1).toFixed(1) : '';
      const formattedT2 = t2 !== undefined ? Number(t2).toFixed(1) : '';
      const formattedT3 = t3 !== undefined ? Number(t3).toFixed(1) : '';

      return {
        materia: subj,
        t1: formattedT1,
        t2: formattedT2,
        t3: formattedT3,
        // Keep b1, b2, b3 aliases for backwards compatibility
        b1: formattedT1,
        b2: formattedT2,
        b3: formattedT3,
        b4: '',
        b5: '',
        final: finalAvg,
        inasistencias: {
          t1: '',
          t2: '',
          t3: '',
          total: ''
        },
        regularizacion: {
          tipo: '',
          fecha: '',
          calificacion: ''
        }
      };
    });
  };

  // Helper to determine gender for student
  const getStudentGender = (a: AlumnoItem): 'H' | 'M' => {
    if (a.genero) {
      const g = a.genero.toLowerCase().trim();
      if (g.startsWith('f') || g.includes('muj')) return 'M';
      if (g.startsWith('m') && !g.includes('asc')) return 'M'; // if 'mujer'
      if (g.startsWith('h') || g.includes('masc')) return 'H';
    }
    if (a.curp && a.curp.length >= 11) {
      const curpGen = a.curp.charAt(10).toUpperCase();
      if (curpGen === 'H') return 'H';
      if (curpGen === 'M') return 'M';
    }
    const firstName = (a.nombres || '').trim().split(/\s+/)[0].toLowerCase();
    const femaleNames = ['maria', 'ana', 'patricia', 'laura', 'sofia', 'valeria', 'camila', 'daniela', 'mariana', 'andrea', 'paola', 'maricruz', 'araceli', 'fernanda', 'rosa', 'guadalupe', 'carmen', 'diana', 'lucia', 'elena', 'gabriela', 'karla', 'vanessa', 'jessica', 'monica', 'veronica', 'adriana', 'claudia', 'susana'];
    if (femaleNames.includes(firstName) || (firstName.endsWith('a') && !['joshua'].includes(firstName))) {
      return 'M';
    }
    return 'H';
  };

  // Filtered Students for "Lista de Asistencia"
  const asistenciaAlumnos = useMemo(() => {
    const list = alumnosList.filter(a => {
      const matchGrado = asistenciaGrado === 'Todos' || matchesMateriaGrado(a.grado, asistenciaGrado) || a.grado === asistenciaGrado;
      const matchGrupo = asistenciaGrupo === 'Todos' || (a.grupo || 'A').toUpperCase() === asistenciaGrupo.toUpperCase();
      return matchGrado && matchGrupo;
    });
    return list.sort((a, b) => {
      const nameA = `${a.apellidos || ''} ${a.nombres || ''}`.trim().toLowerCase();
      const nameB = `${b.apellidos || ''} ${b.nombres || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [alumnosList, asistenciaGrado, asistenciaGrupo]);

  // Processed Attendance Data (Blank Official Roll-Call Format for Chosen Group)
  const attendanceProcessedData = useMemo(() => {
    const daysCount = 20;
    const rows = asistenciaAlumnos.map((a, idx) => {
      const gender = getStudentGender(a);
      const nombreFormateado = a.apellidos 
        ? `${a.apellidos} ${a.nombres}`.trim() 
        : a.nombres.trim();

      // Blank marks array for empty printable sheet / manual check-in
      const marks: string[] = Array.from({ length: 20 }, () => '');
      const porcentaje = '';

      return {
        idx: idx + 1,
        student: a,
        nombre: nombreFormateado,
        genero: gender,
        marks,
        porcentaje
      };
    });

    const conteoH = rows.filter(r => r.genero === 'H').length;
    const conteoM = rows.filter(r => r.genero === 'M').length;
    const totalAlumnos = rows.length;

    // Daily totals for 20 days (blank)
    const dailyTotals: string[] = Array.from({ length: daysCount }, () => '');
    const averagePorcentaje = '';

    return {
      rows,
      conteoH,
      conteoM,
      totalAlumnos,
      dailyTotals,
      averagePorcentaje
    };
  }, [asistenciaAlumnos]);

  const attendanceDays = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => i + 1);
  }, []);

  // Export functions
  const exportAlumnosToCSV = () => {
    let csv = '\uFEFF';
    const sanitize = (t: any) => `"${String(t || '').replace(/"/g, '""')}"`;
    csv += `LISTA DE ALUMNOS - ${institutionName.toUpperCase()}\n`;
    csv += `Ciclo Escolar: ${activeCycle.nombre} | Fecha: ${currentDateFormatted}\n\n`;
    csv += 'No.,Nombre del Alumno,Matrícula,Grado,Grupo,CURP,Correo Electrónico,Estatus\n';
    
    filteredAlumnos.forEach((a, index) => {
      const nombreCompleto = a.apellidos ? `${a.apellidos} ${a.nombres}`.toUpperCase() : a.nombres.toUpperCase();
      csv += [
        index + 1,
        sanitize(nombreCompleto),
        sanitize(a.matricula || a.id),
        sanitize(a.grado),
        sanitize(a.grupo || 'A'),
        sanitize(a.curp || 'S/C'),
        sanitize(a.email),
        sanitize(a.estatus || 'Activo')
      ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lista_alumnos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccessSound?.();
  };

  const exportKardexToCSV = () => {
    let csv = '\uFEFF';
    const sanitize = (t: any) => `"${String(t || '').replace(/"/g, '""')}"`;
    csv += `KARDEX GENERAL DE CALIFICACIONES - ${institutionName.toUpperCase()}\n`;
    csv += `Ciclo Escolar: ${activeCycle.nombre} | Fecha: ${currentDateFormatted}\n\n`;
    csv += 'No.,Alumno,Materia,Evaluación / Parcial,Calificación,Estatus,Observaciones\n';
    
    filteredCalificaciones.forEach((c, index) => {
      const aprobado = Number(c.calificacion) >= 6 ? 'Aprobado' : 'Reprobado';
      csv += [
        index + 1,
        sanitize(c.alumno),
        sanitize(c.materia),
        sanitize(c.parcial),
        sanitize(c.calificacion),
        sanitize(aprobado),
        sanitize(c.observaciones || 'Ordinario')
      ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kardex_calificaciones_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccessSound?.();
  };

  const exportAsistenciaToCSV = () => {
    let csv = '\uFEFF';
    const sanitize = (t: any) => `"${String(t || '').replace(/"/g, '""')}"`;
    csv += `LISTA DE ASISTENCIA OFICIAL - ${institutionName.toUpperCase()}\n`;
    csv += `Ciclo Escolar: ${activeCycle.nombre} | Mes: ${asistenciaMes} ${asistenciaYear} | Docente: ${asistenciaDocente}\n`;
    csv += `Grado: ${asistenciaGrado} | Grupo: ${asistenciaGrupo}\n\n`;
    
    // Header for 4 weeks
    const daysHeader = [
      'Sem1_L','Sem1_M','Sem1_M','Sem1_J','Sem1_V',
      'Sem2_L','Sem2_M','Sem2_M','Sem2_J','Sem2_V',
      'Sem3_L','Sem3_M','Sem3_M','Sem3_J','Sem3_V',
      'Sem4_L','Sem4_M','Sem4_M','Sem4_J','Sem4_V'
    ].join(',');
    csv += `No.,NOMBRE DEL ALUMNO,G,${daysHeader},% de Asistencia\n`;
    
    attendanceProcessedData.rows.forEach((r) => {
      const marksCells = r.marks.join(',');
      csv += [
        r.idx,
        sanitize(r.nombre),
        r.genero,
        marksCells,
        `${r.porcentaje}%`
      ].join(',') + '\n';
    });

    csv += `\nCONTEO TOTAL DE ALUMNOS,H,M\n`;
    csv += `HOMBRES y MUJERES,${attendanceProcessedData.conteoH},${attendanceProcessedData.conteoM}\n`;
    csv += `TOTAL DE ALUMNOS,${attendanceProcessedData.totalAlumnos}\n`;
    csv += `PROMEDIO TOTAL,${attendanceProcessedData.averagePorcentaje}%\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lista_asistencia_${asistenciaMes.toLowerCase()}_${asistenciaYear}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccessSound?.();
  };

  const handlePrint = () => {
    playClickSound?.();
    window.print();
  };

  if (!isOpen) return null;

  // Grade & Group text formatting for print header
  const printGradoText = filterGradoAlumno !== 'Todos' ? filterGradoAlumno : (uniqueGrados[0] || '1°');
  const printGrupoText = filterGrupoAlumno !== 'Todos' ? filterGrupoAlumno : (uniqueGrupos[0] || 'A');
  const cicloTextClean = activeCycle.nombre ? (
    activeCycle.nombre.toUpperCase().startsWith('CICLO') ? activeCycle.nombre.toUpperCase() : `CICLO ESCOLAR ${activeCycle.nombre.toUpperCase()}`
  ) : 'CICLO ESCOLAR 2026-2027';

  // Helper for grade description in words (e.g. PRIMER GRADO)
  const getGradoText = (gradoStr: string) => {
    if (gradoStr.includes('1') || gradoStr.toLowerCase().includes('primer')) return 'PRIMER GRADO';
    if (gradoStr.includes('2') || gradoStr.toLowerCase().includes('segundo')) return 'SEGUNDO GRADO';
    if (gradoStr.includes('3') || gradoStr.toLowerCase().includes('tercer')) return 'TERCER GRADO';
    return `${gradoStr.toUpperCase()} GRADO`;
  };

  // Helper to render official SEP header matching Michoacán format
  const renderSepHeader = () => (
    <div className="flex items-center justify-between border-b-2 border-black pb-2.5 mb-3">
      {/* Left side: EDUCACIÓN & Michoacán Logos */}
      <div className="flex items-center gap-3">
        {/* EDUCACIÓN / SEP Logo */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full text-[#9E804E] fill-current">
              <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="4" />
              <path d="M50 15 C45 25, 35 30, 35 45 C35 58, 45 68, 50 68 C55 68, 65 58, 65 45 C65 30, 55 25, 50 15 Z" />
              <path d="M40 70 L60 70 L55 85 L45 85 Z" />
              <path d="M30 45 C25 40, 20 42, 25 50 C30 55, 35 50, 35 45 Z" />
              <path d="M70 45 C75 40, 80 42, 75 50 C70 55, 65 50, 65 45 Z" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif font-extrabold text-xl text-[#691C32] tracking-tight">EDUCACIÓN</span>
            <span className="text-[6px] font-bold tracking-tighter uppercase text-[#9E804E] mt-0.5">
              SECRETARÍA DE EDUCACIÓN PÚBLICA
            </span>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="h-8 w-[1.5px] bg-[#9E804E]/60" />

        {/* Michoacán Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-9 shrink-0">
            <svg viewBox="0 0 100 120" className="w-full h-full fill-current text-[#5C234A]">
              <path d="M10 10 H90 V70 C90 95, 50 115, 50 115 C50 115, 10 95, 10 70 Z" fill="none" stroke="currentColor" strokeWidth="6" />
              <line x1="50" y1="10" x2="50" y2="110" stroke="currentColor" strokeWidth="4" />
              <line x1="10" y1="60" x2="90" y2="60" stroke="currentColor" strokeWidth="4" />
              <path d="M25 10 L35 0 L50 7 L65 0 L75 10 Z" />
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif font-extrabold text-[11px] text-[#5C234A]">Secretaría</span>
            <span className="font-serif font-extrabold text-[11px] text-[#5C234A] -mt-1">de Educación</span>
            <span className="text-[5.5px] font-bold uppercase tracking-widest text-[#5C234A]/80 mt-0.5">
              GOBIERNO DE MICHOACÁN
            </span>
          </div>
        </div>
      </div>

      {/* Right side Text */}
      <div className="text-right leading-tight">
        <h2 className="font-sans font-black text-[12.5px] uppercase text-black tracking-wide">
          SISTEMA EDUCATIVO NACIONAL
        </h2>
        <h3 className="font-sans font-black text-[12.5px] uppercase text-black tracking-wide">
          MICHOACÁN DE OCAMPO
        </h3>
        <h1 className="font-sans font-black text-[11.5px] uppercase text-black tracking-widest mt-0.5">
          BOLETA DE EVALUACIÓN
        </h1>
      </div>
    </div>
  );

  // Helper to render Villa Montessori Report Card format (Evaluación Temporal)
  const renderMontessoriCard = (std: any, idx: number, isPrint = false) => {
    const names = parseStudentName(std);
    const grades = getStudentSubjectGrades(std);

    let sumT1 = 0, countT1 = 0;
    let sumT2 = 0, countT2 = 0;
    let sumT3 = 0, countT3 = 0;
    let sumFinal = 0, countFinal = 0;

    grades.forEach(g => {
      const v1 = parseFloat(g.t1 || g.b1);
      if (!isNaN(v1) && v1 > 0) { sumT1 += v1; countT1++; }

      const v2 = parseFloat(g.t2 || g.b2);
      if (!isNaN(v2) && v2 > 0) { sumT2 += v2; countT2++; }

      const v3 = parseFloat(g.t3 || g.b3);
      if (!isNaN(v3) && v3 > 0) { sumT3 += v3; countT3++; }

      const vf = parseFloat(g.final);
      if (!isNaN(vf) && vf > 0) { sumFinal += vf; countFinal++; }
    });

    const period1Avg = countT1 > 0 ? (sumT1 / countT1).toFixed(2) : '0.00';
    const period2Avg = countT2 > 0 ? (sumT2 / countT2).toFixed(2) : '0.00';
    const period3Avg = countT3 > 0 ? (sumT3 / countT3).toFixed(2) : '0.00';
    const overallAvg = countFinal > 0 ? (sumFinal / countFinal).toFixed(2) : '0.00';

    const stdKey = std.id || std.curp || `${names.fullName}-${idx}`;
    const asesorItems = asesorFeedbackData[stdKey] || [
      {
        aspecto: 'Cumplimiento de trabajo',
        estado: 'Intermedio',
        observaciones: 'En ocasiones necesita apoyo del adulto para entregar en tiempo y forma'
      },
      {
        aspecto: 'Colaboración/ Ayuda a la comunidad',
        estado: 'Alto',
        observaciones: 'Es muy colaborativo'
      },
      {
        aspecto: 'Estar donde tiene que estar (Autocontrol)',
        estado: 'Alto',
        observaciones: 'Siempre está donde debe de estar'
      },
      {
        aspecto: 'Relación con los demás',
        estado: 'Alto',
        observaciones: 'Es un chico educado, disciplinado y con mucho autocontrol'
      }
    ];

    const updateAsesorItem = (itemIdx: number, field: 'estado' | 'observaciones', val: string) => {
      const updated = [...asesorItems];
      updated[itemIdx] = { ...updated[itemIdx], [field]: val };
      setAsesorFeedbackData(prev => ({ ...prev, [stdKey]: updated }));
    };

    return (
      <div key={stdKey} className={`bg-white p-6 rounded-lg shadow-md border-2 border-[#ca9a2c] max-w-[850px] mx-auto text-black text-xs space-y-4 font-sans ${isPrint ? 'page-break-after-always pb-4' : ''}`}>
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-[#ca9a2c] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-amber-50 border-2 border-[#ca9a2c] flex items-center justify-center p-1 text-[#ca9a2c] shrink-0">
              <img src={effectiveLogo} alt="Logo" className="w-full h-full object-contain rounded-full" />
            </div>
            <div>
              <h1 className="font-serif font-black text-2xl tracking-wide text-slate-900 leading-none">Villa Montessori</h1>
              <p className="font-semibold text-xs text-amber-900 tracking-wider">Comunidad Educativa</p>
              <p className="font-extrabold text-sm text-slate-900 uppercase tracking-wide mt-1">Reporte de Calificaciones</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-amber-100/80 border border-amber-400 px-3.5 py-1.5 rounded-md text-center">
              <span className="font-extrabold text-xs text-amber-950 uppercase block tracking-wider">
                NIVEL {std.grado ? (std.grado.toUpperCase().includes('CHICOS') ? std.grado.toUpperCase() : `${std.grado.toUpperCase()}`) : 'CHICOS'}
              </span>
              <span className="text-[10px] font-bold text-amber-900 block">
                Ciclo {activeCycle.nombre.replace('CICLO ESCOLAR', '').trim()}
              </span>
            </div>
          </div>
        </div>

        {/* Student Info Bar */}
        <div className="bg-[#fff9db] border border-amber-300 rounded-md p-2.5 flex items-center justify-between text-xs font-bold text-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-amber-950 font-extrabold uppercase">ESTUDIANTE:</span>
            <span className="uppercase text-sm font-mono tracking-tight font-extrabold text-black">
              {names.fullName || `${std.apellidos || ''}, ${std.nombres || ''}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-950 font-extrabold uppercase">ASESOR:</span>
            <span className="uppercase font-bold text-slate-900">{std.tutor || 'Adi'}</span>
          </div>
        </div>

        {/* Subject Grades Grid */}
        <div className="space-y-2">
          <table className="w-full border-collapse border border-black text-xs text-center">
            <thead>
              <tr>
                <th rowSpan={2} className="border border-black bg-[#ca9a2c] text-black font-extrabold text-left px-3 py-1.5 uppercase text-xs w-[45%]">
                  ASIGNATURAS / ÁREAS
                </th>
                <th colSpan={3} className="border border-black bg-[#ca9a2c] text-black font-extrabold uppercase py-1 text-xs">
                  PERIODO DE EVALUACIÓN TRIMESTRAL
                </th>
                <th rowSpan={2} className="border border-black bg-[#ca9a2c] text-black font-extrabold uppercase py-1 text-xs w-[16%]">
                  PROMEDIO
                </th>
              </tr>
              <tr className="bg-[#d4af37] text-black font-bold text-[10px]">
                <th className="border border-black px-1 py-1 w-[13%]">PRIMER</th>
                <th className="border border-black px-1 py-1 w-[13%]">SEGUNDO</th>
                <th className="border border-black px-1 py-1 w-[13%]">TERCER</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-black text-xs">
                  <td className="border border-black px-3 py-1 text-left font-bold uppercase text-slate-900 bg-amber-50/40">
                    {row.materia}
                  </td>
                  <td className="border border-black px-1 py-1 font-mono font-bold text-slate-900 bg-[#fff9db]">
                    {row.t1 || row.b1 || '0'}
                  </td>
                  <td className="border border-black px-1 py-1 font-mono font-bold text-slate-900 bg-[#fff9db]">
                    {row.t2 || row.b2 || '0'}
                  </td>
                  <td className="border border-black px-1 py-1 font-mono font-bold text-slate-900 bg-[#fff9db]">
                    {row.t3 || row.b3 || '0'}
                  </td>
                  <td className="border border-black px-1 py-1 font-mono font-extrabold text-slate-900 bg-[#fce8a6]">
                    {row.final || '0.00'}
                  </td>
                </tr>
              ))}
              {/* Summary Row */}
              <tr className="border-t-2 border-black font-bold text-xs bg-amber-100/90">
                <td className="border border-black px-3 py-1 text-right uppercase text-slate-950 font-extrabold">
                  PROMEDIO PERÍODO
                </td>
                <td className="border border-black px-1 py-1 font-mono font-extrabold text-slate-950 bg-amber-200/90">
                  {period1Avg}
                </td>
                <td className="border border-black px-1 py-1 font-mono font-extrabold text-slate-950 bg-amber-200/90">
                  {period2Avg}
                </td>
                <td className="border border-black px-1 py-1 font-mono font-extrabold text-slate-950 bg-amber-200/90">
                  {period3Avg}
                </td>
                <td className="border border-black px-1 py-1 font-mono font-extrabold text-slate-950 bg-[#fce8a6]">
                  —
                </td>
              </tr>
            </tbody>
          </table>

          {/* Promedio Final Box */}
          <div className="flex justify-end pt-1">
            <div className="flex items-center border-2 border-black rounded-sm overflow-hidden text-xs">
              <span className="bg-[#ca9a2c] text-slate-950 font-extrabold uppercase px-4 py-1.5 border-r border-black tracking-wider">
                PROMEDIO FINAL
              </span>
              <span className="bg-[#fff9db] font-mono font-black text-sm px-6 py-1 text-slate-950">
                {overallAvg}
              </span>
            </div>
          </div>
        </div>

        {/* Parameters Legend */}
        <div className="border border-black rounded-sm overflow-hidden text-xs">
          <div className="bg-[#ca9a2c] text-slate-950 font-extrabold text-center py-1 uppercase tracking-wider text-xs border-b border-black">
            PARÁMETROS DE EVALUACIÓN
          </div>
          <div className="p-2 bg-amber-50/40 text-[10.5px] space-y-1">
            <div className="flex items-start gap-2">
              <span className="font-extrabold text-slate-950 w-24 text-right">Alto:</span>
              <span className="text-slate-900">Fluye de manera positiva</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-extrabold text-slate-950 w-24 text-right">Intermedio:</span>
              <span className="text-slate-900">Aspectos positivos y aspectos que necesitan atención / Dificultad en general</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-extrabold text-slate-950 w-24 text-right">Bajo:</span>
              <span className="text-slate-900">Necesita apoyo continuo / Dificultad constante</span>
            </div>
          </div>
        </div>

        {/* Seguimiento con Asesores */}
        <div className="space-y-1">
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-[#ca9a2c] text-slate-950 font-extrabold text-left text-xs uppercase">
                <th className="border border-black px-3 py-1.5 w-[38%]">SEGUIMIENTO CON ASESORES</th>
                <th className="border border-black px-2 py-1.5 text-center w-[18%]">ESTADO</th>
                <th className="border border-black px-3 py-1.5 w-[44%]">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black text-[11px]">
              {asesorItems.map((item, idx) => (
                <tr key={idx} className="border-b border-black">
                  <td className="border border-black px-3 py-1.5 font-semibold text-slate-900 bg-amber-50/30">
                    {item.aspecto}
                  </td>
                  <td className="border border-black px-2 py-1.5 text-center font-bold text-slate-900 bg-[#fff9db]">
                    {!isPrint ? (
                      <select
                        value={item.estado}
                        onChange={(e) => updateAsesorItem(idx, 'estado', e.target.value)}
                        className="bg-transparent border-none text-center font-bold cursor-pointer focus:outline-none"
                      >
                        <option value="Alto">Alto</option>
                        <option value="Intermedio">Intermedio</option>
                        <option value="Bajo">Bajo</option>
                      </select>
                    ) : (
                      item.estado
                    )}
                  </td>
                  <td className="border border-black px-3 py-1.5 text-slate-800 bg-white italic">
                    {!isPrint ? (
                      <input
                        type="text"
                        value={item.observaciones}
                        onChange={(e) => updateAsesorItem(idx, 'observaciones', e.target.value)}
                        className="w-full bg-transparent border-none italic text-xs focus:outline-none focus:bg-amber-50 px-1 rounded"
                      />
                    ) : (
                      item.observaciones
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Page Number */}
        <div className="text-center pt-2 text-[10px] font-bold text-slate-500">
          1 DE 1
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-[1300px] max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Top Header Bar without redundant Print and Excel buttons */}
        <div className="px-5 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
            <span className="text-xs font-semibold tracking-wide text-slate-200 uppercase">
              Boletín General y Expedientes Académicos Oficiales
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
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 3 Primary Navigation Options */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200/80">
            {/* Opción 1: Lista de alumnos */}
            <button
              type="button"
              onClick={() => {
                playClickSound?.();
                setActiveTab('alumnos');
              }}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm transition-all cursor-pointer ${
                activeTab === 'alumnos'
                  ? 'bg-[#0f3458] text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <Users size={16} className={activeTab === 'alumnos' ? 'text-amber-300' : 'text-slate-400'} />
              <span>Lista de alumnos</span>
            </button>

            {/* Opción 2: Kardex de calificaciones */}
            <button
              type="button"
              onClick={() => {
                playClickSound?.();
                setActiveTab('kardex');
              }}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm transition-all cursor-pointer ${
                activeTab === 'kardex'
                  ? 'bg-[#0f3458] text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <GraduationCap size={16} className={activeTab === 'kardex' ? 'text-amber-300' : 'text-slate-400'} />
              <span>Kardex de calificaciones</span>
            </button>

            {/* Opción 3: Lista de asistencia */}
            <button
              type="button"
              onClick={() => {
                playClickSound?.();
                setActiveTab('asistencia');
              }}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm transition-all cursor-pointer ${
                activeTab === 'asistencia'
                  ? 'bg-[#0f3458] text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <ClipboardList size={16} className={activeTab === 'asistencia' ? 'text-amber-300' : 'text-slate-400'} />
              <span>Lista de asistencia</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg font-bold flex items-center gap-1.5">
              <Sparkles size={13} className="text-blue-600" />
              <span>{activeCycle.nombre}</span>
            </span>
          </div>
        </div>

        {/* Scrollable Modal Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-200/60">

          {/* ========================================================================= */}
          {/* TAB 1: LISTA DE ALUMNOS */}
          {/* ========================================================================= */}
          {activeTab === 'alumnos' && (
            <div className="space-y-4">
              {/* Institution Header Banner */}
              <div className="bg-[#0f3458] text-white rounded-xl shadow-md border border-[#0b2844] p-4 lg:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img 
                    src={effectiveLogo} 
                    alt="Logo Escuela" 
                    className="w-13 h-13 object-contain rounded-lg bg-white p-1 shadow-sm border border-amber-300/40 shrink-0"
                  />
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold tracking-wide uppercase text-white">
                      {institutionName || 'ESCUELA SECUNDARIA GENERAL Nº3'}
                    </h2>
                    <p className="text-xs text-blue-200 font-medium flex items-center gap-2">
                      <span>Lista Oficial de Alumnos por Grupo</span>
                      <span>•</span>
                      <span className="text-amber-300 font-semibold">{currentDateFormatted}</span>
                    </p>
                  </div>
                </div>

                {/* Quick Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-blue-200 font-semibold tracking-wider">Total Alumnos</p>
                    <p className="text-base font-extrabold text-white">{alumnosList.length}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-emerald-200 font-semibold tracking-wider">Activos</p>
                    <p className="text-base font-extrabold text-emerald-300">
                      {alumnosList.filter(a => (a.estatus || 'Activo') === 'Activo').length}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-amber-200 font-semibold tracking-wider">En Lista</p>
                    <p className="text-base font-extrabold text-amber-300">{filteredAlumnos.length}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-purple-200 font-semibold tracking-wider">Grados</p>
                    <p className="text-base font-extrabold text-purple-300">{uniqueGrados.length || 1}</p>
                  </div>
                </div>
              </div>

              {/* Filters & Actions Bar */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar por nombre, matrícula o CURP..."
                      value={searchAlumno}
                      onChange={(e) => setSearchAlumno(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Grado Filter */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Grado:</label>
                    <select 
                      value={filterGradoAlumno} 
                      onChange={(e) => setFilterGradoAlumno(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Todos">Todos los grados</option>
                      {uniqueGrados.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Grupo Filter */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Grupo:</label>
                    <select 
                      value={filterGrupoAlumno} 
                      onChange={(e) => setFilterGrupoAlumno(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Todos">Todos</option>
                      {uniqueGrupos.map(g => (
                        <option key={g} value={g}>{g.replace(/^grupo\s+/i, '')}</option>
                      ))}
                    </select>
                  </div>

                  {/* Estatus Filter */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Estatus:</label>
                    <select 
                      value={filterEstatusAlumno} 
                      onChange={(e) => setFilterEstatusAlumno(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Todos">Todos</option>
                      <option value="Activo">Activos</option>
                      <option value="Inactivo">Inactivos</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Imprimir formato oficial exactamente como la plantilla de grupo"
                  >
                    <Printer size={14} />
                    <span>Imprimir Lista</span>
                  </button>
                  <button
                    onClick={exportAlumnosToCSV}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Exportar archivo de Excel"
                  >
                    <Download size={14} />
                    <span>Exportar Excel</span>
                  </button>
                </div>
              </div>

              {/* Students Screen Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0f3458] text-white uppercase text-[11px] font-bold">
                      <tr>
                        <th className="py-3 px-3.5 text-center w-14">No.</th>
                        <th className="py-3 px-3.5">NOMBRE DEL ALUMNO</th>
                        <th className="py-3 px-3.5">Matrícula</th>
                        <th className="py-3 px-3.5">Grado & Grupo</th>
                        <th className="py-3 px-3.5">CURP</th>
                        <th className="py-3 px-3.5">Correo Institucional</th>
                        <th className="py-3 px-3.5 text-center">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAlumnos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500">
                            <Users size={32} className="mx-auto text-slate-300 mb-2" />
                            <p className="font-semibold text-slate-600">No se encontraron alumnos con los filtros seleccionados.</p>
                            <p className="text-slate-400 text-xs mt-1">Asegúrese de registrar alumnos en el módulo de Control Escolar.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredAlumnos.map((a, idx) => {
                          const nombreCompleto = a.apellidos ? `${a.apellidos} ${a.nombres}`.toUpperCase() : a.nombres.toUpperCase();
                          return (
                            <tr key={a.id || idx} className="hover:bg-blue-50/50 transition-colors">
                              <td className="py-3 px-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="py-3 px-3.5 font-bold text-slate-800 tracking-wide">
                                {nombreCompleto}
                              </td>
                              <td className="py-3 px-3.5 font-mono text-blue-700 font-semibold">{a.matricula || a.id.slice(0, 8)}</td>
                              <td className="py-3 px-3.5 text-slate-700">
                                <span className="font-bold">{a.grado}</span>
                                <span className="text-slate-400 ml-1">"{a.grupo || 'A'}"</span>
                              </td>
                              <td className="py-3 px-3.5 font-mono text-slate-600">{a.curp || 'S/C'}</td>
                              <td className="py-3 px-3.5 text-slate-600">{a.email || 'Sin correo'}</td>
                              <td className="py-3 px-3.5 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  (a.estatus || 'Activo') === 'Activo'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {a.estatus || 'Activo'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Summary */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span>Mostrando <strong>{filteredAlumnos.length}</strong> alumnos en la lista</span>
                  <div className="flex items-center gap-4">
                    <span>Grado: <strong>{filterGradoAlumno}</strong></span>
                    <span>Grupo: <strong>{filterGrupoAlumno}</strong></span>
                    <span>Ciclo: <strong>{activeCycle.nombre}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: KARDEX DE CALIFICACIONES (OFFICIAL SEP FORMAT) */}
          {/* ========================================================================= */}
          {activeTab === 'kardex' && (
            <div className="space-y-4">
              {/* Institution Header Banner */}
              <div className="bg-[#0f3458] text-white rounded-xl shadow-md border border-[#0b2844] p-4 lg:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img 
                    src={effectiveLogo} 
                    alt="Logo Escuela" 
                    className="w-13 h-13 object-contain rounded-lg bg-white p-1 shadow-sm border border-amber-300/40 shrink-0"
                  />
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold tracking-wide uppercase text-white">
                      {institutionName || 'ESCUELA SECUNDARIA GENERAL Nº3'}
                    </h2>
                    <p className="text-xs text-blue-200 font-medium flex items-center gap-2">
                      <span>Kardex Oficial SEP - Boleta de Evaluación Secundaria</span>
                      <span>•</span>
                      <span className="text-amber-300 font-semibold">{currentDateFormatted}</span>
                    </p>
                  </div>
                </div>

                {/* 4 Quick KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-blue-200 font-semibold tracking-wider">Evaluaciones</p>
                    <p className="text-base font-extrabold text-white">{kardexKpis.total}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-emerald-200 font-semibold tracking-wider">Promedio Gral</p>
                    <p className="text-base font-extrabold text-emerald-300">{kardexKpis.promedio}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-amber-200 font-semibold tracking-wider">Aprobación</p>
                    <p className="text-base font-extrabold text-amber-300">{kardexKpis.tasaAprobacion}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-rose-200 font-semibold tracking-wider">Reprobadas</p>
                    <p className="text-base font-extrabold text-rose-300">{kardexKpis.reprobadas}</p>
                  </div>
                </div>
              </div>

              {/* Filters & Actions Bar */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                  {/* Student Selector */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Alumno:</label>
                    <select 
                      value={selectedStudentForKardex} 
                      onChange={(e) => setSelectedStudentForKardex(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[240px]"
                    >
                      <option value="all">Sábana General (Todos los alumnos)</option>
                      {alumnosList.map(a => {
                        const name = `${a.nombres} ${a.apellidos}`;
                        return (
                          <option key={a.id} value={name}>{name} ({a.grado} "{a.grupo || 'A'}")</option>
                        );
                      })}
                    </select>
                  </div>

                  {/* View Switcher: Table vs Reporte Villa Montessori vs Boleta SEP Preview */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setKardexViewMode('table')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        kardexViewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Vista Tabla
                    </button>
                    <button
                      onClick={() => { setKardexViewMode('preview'); setKardexPrintFormat('montessori'); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                        kardexViewMode === 'preview' && kardexPrintFormat === 'montessori' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>📋</span> Reporte Villa Montessori (Temporal)
                    </button>
                    <button
                      onClick={() => { setKardexViewMode('preview'); setKardexPrintFormat('sep'); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                        kardexViewMode === 'preview' && kardexPrintFormat === 'sep' ? 'bg-blue-900 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🎓</span> Boleta SEP (Final de Ciclo)
                    </button>
                  </div>

                  {kardexViewMode === 'table' && (
                    <>
                      {/* Search Input */}
                      <div className="relative flex-1 min-w-[160px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar materia o alumno..."
                          value={searchKardex}
                          onChange={(e) => setSearchKardex(e.target.value)}
                          className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      {/* Materia Filter */}
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-semibold text-slate-600">Materia:</label>
                        <select 
                          value={filterMateriaKardex} 
                          onChange={(e) => setFilterMateriaKardex(e.target.value)}
                          className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[160px]"
                        >
                          <option value="Todas">Todas</option>
                          {materiasList.map(m => (
                            <option key={m.id} value={m.nombre}>{m.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Imprimir Boleta / Kardex en el formato oficial de la SEP"
                  >
                    <Printer size={14} />
                    <span>Imprimir Kardex</span>
                  </button>
                  <button
                    onClick={exportKardexToCSV}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Exportar archivo de Excel"
                  >
                    <Download size={14} />
                    <span>Exportar Excel</span>
                  </button>
                </div>
              </div>

              {/* View 1: Screen Table View */}
              {kardexViewMode === 'table' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0f3458] text-white uppercase text-[11px] font-bold">
                        <tr>
                          <th className="py-3 px-3.5 text-center w-12">#</th>
                          <th className="py-3 px-3.5">Estudiante</th>
                          <th className="py-3 px-3.5">Asignatura / Materia</th>
                          <th className="py-3 px-3.5">Período / Parcial</th>
                          <th className="py-3 px-3.5 text-center">Calificación</th>
                          <th className="py-3 px-3.5 text-center">Estatus</th>
                          <th className="py-3 px-3.5">Fecha</th>
                          <th className="py-3 px-3.5">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCalificaciones.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-500">
                              <GraduationCap size={32} className="mx-auto text-slate-300 mb-2" />
                              <p className="font-semibold text-slate-600">No hay calificaciones registradas para esta selección.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredCalificaciones.map((c, idx) => {
                            const num = Number(c.calificacion) || 0;
                            const isAprobado = num >= 6;
                            return (
                              <tr key={c.id || idx} className="hover:bg-blue-50/50 transition-colors">
                                <td className="py-3 px-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                <td className="py-3 px-3.5 font-bold text-slate-800">{c.alumno}</td>
                                <td className="py-3 px-3.5 font-medium text-slate-700">{c.materia}</td>
                                <td className="py-3 px-3.5 text-slate-600">
                                  <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium border border-slate-200">
                                    {c.parcial}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  <span className={`inline-block font-extrabold text-sm px-2.5 py-0.5 rounded-lg border ${
                                    num >= 8 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                    num >= 6 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                    'bg-rose-50 text-rose-800 border-rose-200'
                                  }`}>
                                    {num.toFixed(1)}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    isAprobado ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {isAprobado ? 'Aprobado' : 'Reprobado'}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">{c.fecha || currentDateFormatted}</td>
                                <td className="py-3 px-3.5 text-slate-600 italic">{c.observaciones || 'Ordinario regular'}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer Summary */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>Total evaluaciones listadas: <strong>{filteredCalificaciones.length}</strong></span>
                    <div className="flex items-center gap-4">
                      <span>Aprobadas: <strong className="text-emerald-700">{kardexKpis.aprobadas}</strong></span>
                      <span>Reprobadas: <strong className="text-rose-700">{kardexKpis.reprobadas}</strong></span>
                      <span>Promedio General: <strong className="text-blue-900">{kardexKpis.promedio}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* View 2: Screen Boleta Preview (Montessori vs SEP) */}
              {kardexViewMode === 'preview' && (
                <div className="bg-slate-300 p-4 rounded-xl overflow-x-auto space-y-4">
                  {/* Format Switcher Header */}
                  <div className="max-w-[850px] mx-auto bg-slate-900 text-white p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-amber-400 uppercase">Formato Activo:</span>
                      <span className="font-semibold text-slate-200">
                        {kardexPrintFormat === 'montessori' ? '📋 Reporte de Calificaciones (Villa Montessori / Temporal)' : '🎓 Boleta Oficial de Evaluación (SEP)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setKardexPrintFormat('montessori')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          kardexPrintFormat === 'montessori' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        📋 Formato Temporal (Montessori)
                      </button>
                      <button
                        onClick={() => setKardexPrintFormat('sep')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          kardexPrintFormat === 'sep' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        🎓 Formato SEP (Final)
                      </button>
                    </div>
                  </div>

                  {kardexPrintFormat === 'montessori' ? (
                    kardexStudentsToRender.slice(0, 1).map((std, i) => renderMontessoriCard(std, i, false))
                  ) : (
                    <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-300 max-w-[900px] mx-auto text-black text-xs space-y-3 font-sans">
                    {kardexStudentsToRender.slice(0, 1).map((std, i) => {
                      const names = parseStudentName(std);
                      const grades = getStudentSubjectGrades(std);
                      const validFinals = grades.map(g => Number(g.final)).filter(v => !isNaN(v) && v > 0);
                      const gAvg = validFinals.length > 0 ? (validFinals.reduce((a, b) => a + b, 0) / validFinals.length).toFixed(1) : (std.promedio || '9.0');

                      return (
                        <div key={std.id || i} className="space-y-3">
                          {/* Official SEP Header matching Michoacán format */}
                          {renderSepHeader()}

                          {/* School Info Box */}
                          <div className="border border-black rounded-lg p-2 text-[10px] space-y-1">
                            <div className="flex justify-between items-end border-b border-dotted border-slate-300 pb-1">
                              <div>
                                <p className="font-bold uppercase text-black">{institutionName || 'ESCUELA SECUNDARIA GENERAL Nº3'}</p>
                                <p className="text-[8px] text-slate-600 uppercase">NOMBRE OFICIAL DE LA ESCUELA SEGÚN CATALOGO DE CENTRO DE TRABAJO</p>
                              </div>
                              <div className="text-right">
                                <p className="font-mono font-bold uppercase text-black">07ETV1188Q</p>
                                <p className="text-[8px] text-slate-600 uppercase">CLAVE SEGÚN CCT</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-end text-[9px] pt-0.5">
                              <div>
                                <span className="font-bold uppercase">COLONIA O LOCALIDAD: </span>
                                <span className="uppercase text-slate-800">DR. MANUEL VELASCO SUAREZ</span>
                              </div>
                              <div>
                                <span className="font-bold uppercase">MUNICIPIO: </span>
                                <span className="uppercase text-slate-800">TZIMOL</span>
                              </div>
                            </div>
                          </div>

                          {/* Student Info Box */}
                          <div className="border border-black rounded-lg p-2 text-[10px] space-y-2">
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold uppercase text-[10px]">ALUMNO:</span>
                              <div className="grid grid-cols-3 gap-3 flex-1 text-center">
                                <div className="border-b border-black pb-0.5">
                                  <p className="font-bold uppercase">{names.primerApellido}</p>
                                  <p className="text-[7.5px] uppercase text-slate-600">PRIMER APELLIDO</p>
                                </div>
                                <div className="border-b border-black pb-0.5">
                                  <p className="font-bold uppercase">{names.segundoApellido}</p>
                                  <p className="text-[7.5px] uppercase text-slate-600">SEGUNDO APELLIDO</p>
                                </div>
                                <div className="border-b border-black pb-0.5">
                                  <p className="font-bold uppercase">{names.nombres}</p>
                                  <p className="text-[7.5px] uppercase text-slate-600">NOMBRE (S)</p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-5 gap-2 items-center text-center text-[9px]">
                              <div className="col-span-2 flex items-center justify-center gap-1">
                                <span className="font-bold text-[8px] uppercase">FECHA NAC:</span>
                                <span className="border border-black px-1.5 py-0.5 font-mono font-bold">03</span>
                                <span className="border border-black px-1.5 py-0.5 font-bold uppercase">MAYO</span>
                                <span className="border border-black px-1.5 py-0.5 font-mono font-bold">98</span>
                              </div>
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-bold text-[8px] uppercase">SEXO:</span>
                                <span className="border border-black px-2 py-0.5 font-bold uppercase">
                                  {std.genero?.toUpperCase().startsWith('F') ? 'F' : 'M'}
                                </span>
                              </div>
                              <div className="border-b border-black">
                                <p className="font-bold uppercase">{std.turno || 'MATUTINO'}</p>
                                <p className="text-[7px] uppercase text-slate-600">TURNO</p>
                              </div>
                              <div className="border-b border-black">
                                <p className="font-bold uppercase">{std.grupo || 'A'}</p>
                                <p className="text-[7px] uppercase text-slate-600">GRUPO</p>
                              </div>
                            </div>

                            <div className="text-[9px] border-t border-slate-200 pt-1">
                              <span className="font-bold uppercase">DOMICILIO: </span>
                              <span className="text-slate-800 uppercase">{std.direccion || 'CALLE CENTRAL NORTE S/N, COLONIA CENTRO'}</span>
                            </div>

                            <div className="text-[9px]">
                              <span className="font-bold uppercase">NOMBRE DEL PADRE DE FAMILIA O TUTOR: </span>
                              <span className="border-b border-black px-2 font-bold uppercase">{std.tutor || 'MARTHA ARACELI HERNANDEZ VELASCO'}</span>
                            </div>
                          </div>

                          {/* Grade Title */}
                          <div className="text-center py-1">
                            <h3 className="font-extrabold text-sm uppercase tracking-widest text-black">
                              {getGradoText(std.grado || '1°')}
                            </h3>
                          </div>

                          {/* Grades Table */}
                          <table className="w-full border-collapse border border-black text-[9px] text-center">
                            <thead>
                              <tr className="bg-slate-100 border-b border-black">
                                <th rowSpan={2} className="border border-black px-2 py-1 text-left uppercase w-52 font-bold">
                                  PERIODO ESCOLAR {cicloTextClean.replace('CICLO ESCOLAR', '')} / ASIGNATURAS
                                </th>
                                <th colSpan={4} className="border border-black px-1 py-0.5 uppercase font-bold">
                                  CALIFICACIONES (TRIMESTRES)
                                </th>
                                <th colSpan={4} className="border border-black px-1 py-0.5 uppercase font-bold">
                                  INASISTENCIAS
                                </th>
                                <th colSpan={3} className="border border-black px-1 py-0.5 uppercase font-bold">
                                  EXAMEN DE REGULARIZACION
                                </th>
                              </tr>
                              <tr className="border-b border-black text-[7.5px] font-bold">
                                <th className="border border-black px-1 py-1 w-16">
                                  1er TRIMESTRE
                                  <span className="block text-[6.5px] font-normal text-slate-600 uppercase">SEP - NOV</span>
                                </th>
                                <th className="border border-black px-1 py-1 w-16">
                                  2do TRIMESTRE
                                  <span className="block text-[6.5px] font-normal text-slate-600 uppercase">DIC - MAR</span>
                                </th>
                                <th className="border border-black px-1 py-1 w-16">
                                  3er TRIMESTRE
                                  <span className="block text-[6.5px] font-normal text-slate-600 uppercase">ABR - JUN</span>
                                </th>
                                <th className="border border-black px-1 py-1 w-12 bg-slate-200">FINAL</th>
                                <th className="border border-black px-0.5 py-1 w-7">1TR<span className="block text-[6px] font-normal text-slate-500">SEP-NOV</span></th>
                                <th className="border border-black px-0.5 py-1 w-7">2TR<span className="block text-[6px] font-normal text-slate-500">DIC-MAR</span></th>
                                <th className="border border-black px-0.5 py-1 w-7">3TR<span className="block text-[6px] font-normal text-slate-500">ABR-JUN</span></th>
                                <th className="border border-black px-0.5 py-1 w-7 bg-slate-200">TOT</th>
                                <th className="border border-black px-1 py-1 w-14">TIPO</th>
                                <th className="border border-black px-1 py-1 w-12">FECHA</th>
                                <th className="border border-black px-1 py-1 w-10">CALIF</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grades.map((row, rIdx) => (
                                <tr key={rIdx} className="border-b border-black">
                                  <td className="border border-black px-2 py-0.5 text-left font-bold uppercase whitespace-nowrap">
                                    {row.materia}
                                  </td>
                                  <td className="border border-black px-1 py-0.5 font-mono">{row.t1 || row.b1 || '—'}</td>
                                  <td className="border border-black px-1 py-0.5 font-mono">{row.t2 || row.b2 || '—'}</td>
                                  <td className="border border-black px-1 py-0.5 font-mono">{row.t3 || row.b3 || '—'}</td>
                                  <td className="border border-black px-1 py-0.5 font-mono font-bold bg-slate-100">{row.final || '—'}</td>
                                  <td className="border border-black px-0.5 py-0.5">0</td>
                                  <td className="border border-black px-0.5 py-0.5">0</td>
                                  <td className="border border-black px-0.5 py-0.5">0</td>
                                  <td className="border border-black px-0.5 py-0.5 font-bold bg-slate-100">0</td>
                                  <td className="border border-black px-1 py-0.5 text-[8px]">—</td>
                                  <td className="border border-black px-1 py-0.5 text-[8px]">—</td>
                                  <td className="border border-black px-1 py-0.5 text-[8px]">—</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Footer Info */}
                          <div className="pt-2 text-[9px] space-y-1.5">
                            <div className="flex justify-between">
                              <div>
                                <span className="font-bold uppercase">LENGUA EXTRANJERA: </span>
                                <span className="border-b border-black font-semibold">INGLES</span>
                              </div>
                              <div>
                                <span className="font-bold uppercase">CLAVE DE LA LENGUA EXTRANJERA: </span>
                                <span className="border-b border-black font-semibold px-4">I</span>
                              </div>
                            </div>
                            <div className="flex justify-between">
                              <div>
                                <span className="font-bold uppercase">TECNOLOGIA: </span>
                                <span className="border-b border-black font-semibold">OFIMATICA / INFORMATICA</span>
                              </div>
                              <div>
                                <span className="font-bold uppercase">CLAVE DE LA TECNOLOGIA: </span>
                                <span className="border-b border-black font-semibold px-4">TE01</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-black pt-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold uppercase text-[8px]">GRUPO: {std.grupo || 'A'}</span>
                                <span>•</span>
                                <span className="font-bold uppercase text-[8px]">{names.fullName}</span>
                                <span>•</span>
                                <span className="font-mono text-[8px]">{std.curp || 'AAHM980503MCSLRR'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold uppercase text-xs">PROMEDIO GENERAL ANUAL:</span>
                                <span className="font-extrabold text-sm px-2 py-0.5 border border-black bg-slate-100 font-mono">
                                  {gAvg}
                                </span>
                              </div>
                            </div>

                            {/* SIGNATURES */}
                            <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-black/20 mt-2 text-[8px] text-black">
                              <div>
                                <div className="border-t border-black w-4/5 mx-auto pt-0.5 font-bold uppercase">FIRMA DEL MAESTRO(A)</div>
                              </div>
                              <div>
                                <div className="border-t border-black w-4/5 mx-auto pt-0.5 font-bold uppercase">FIRMA DEL DIRECTOR(A)</div>
                              </div>
                              <div>
                                <div className="border-t border-black w-4/5 mx-auto pt-0.5 font-bold uppercase">FIRMA PADRE / TUTOR</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: LISTA DE ASISTENCIA */}
          {/* ========================================================================= */}
          {activeTab === 'asistencia' && (
            <div className="space-y-4">
              {/* Institution Header Banner */}
              <div className="bg-[#0f3458] text-white rounded-xl shadow-md border border-[#0b2844] p-4 lg:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img 
                    src={effectiveLogo} 
                    alt="Logo Escuela" 
                    className="w-13 h-13 object-contain rounded-lg bg-white p-1 shadow-sm border border-amber-300/40 shrink-0"
                  />
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold tracking-wide uppercase text-white">
                      {institutionName || 'ESCUELA SOR JUANA'}
                    </h2>
                    <p className="text-xs text-blue-200 font-medium flex items-center gap-2">
                      <span>Lista Oficial de Asistencia y Control de Grupo</span>
                      <span>•</span>
                      <span className="text-amber-300 font-semibold">{asistenciaMes.toUpperCase()} {asistenciaYear}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-blue-200 font-semibold tracking-wider">Alumnos Roster</p>
                    <p className="text-base font-extrabold text-white">{attendanceProcessedData.totalAlumnos}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-emerald-200 font-semibold tracking-wider">% Asistencia</p>
                    <p className="text-base font-extrabold text-emerald-300">Formato Vacío</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-amber-200 font-semibold tracking-wider">Hombres / Mujeres</p>
                    <p className="text-base font-extrabold text-amber-300">{attendanceProcessedData.conteoH} / {attendanceProcessedData.conteoM}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-lg border border-white/15 text-center">
                    <p className="text-[10px] uppercase text-purple-200 font-semibold tracking-wider">Días Hábiles</p>
                    <p className="text-base font-extrabold text-purple-300">20</p>
                  </div>
                </div>
              </div>

              {/* Attendance Configuration Bar */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Grado Selector */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Grado:</label>
                    <select 
                      value={asistenciaGrado} 
                      onChange={(e) => setAsistenciaGrado(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Todos">Todos los grados</option>
                      {uniqueGrados.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Grupo Selector */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Grupo:</label>
                    <select 
                      value={asistenciaGrupo} 
                      onChange={(e) => setAsistenciaGrupo(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Todos">Todos</option>
                      {uniqueGrupos.map(g => (
                        <option key={g} value={g}>{g.replace(/^grupo\s+/i, '')}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mes Selector */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Mes:</label>
                    <select 
                      value={asistenciaMes} 
                      onChange={(e) => setAsistenciaMes(e.target.value)}
                      className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {['Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Año Selector */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Año:</label>
                    <input 
                      type="text"
                      value={asistenciaYear}
                      onChange={(e) => setAsistenciaYear(e.target.value)}
                      className="w-16 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Docente Input */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Docente:</label>
                    <input 
                      type="text"
                      value={asistenciaDocente}
                      onChange={(e) => setAsistenciaDocente(e.target.value)}
                      placeholder="Nombre del Docente"
                      className="w-44 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 uppercase"
                    />
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setAsistenciaViewMode('preview')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        asistenciaViewMode === 'preview'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Vista Formato Oficial
                    </button>
                    <button
                      onClick={() => setAsistenciaViewMode('table')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        asistenciaViewMode === 'table'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Vista Tabla
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Printer size={14} />
                    <span>Imprimir Asistencia</span>
                  </button>
                  <button
                    onClick={exportAsistenciaToCSV}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Download size={14} />
                    <span>Exportar Excel</span>
                  </button>
                </div>
              </div>

              {/* View 1: Screen WYSIWYG Preview of Official didocu Format */}
              {asistenciaViewMode === 'preview' ? (
                <div className="bg-slate-100 p-4 sm:p-6 rounded-2xl border border-slate-300 shadow-inner flex justify-center overflow-x-auto">
                  <div className="bg-white text-black font-sans p-6 rounded-lg shadow-xl border border-slate-300 w-full max-w-[950px] min-w-[780px]">
                    {/* TITLE */}
                    <div className="text-center mb-3">
                      <h1 className="text-xl sm:text-2xl font-black tracking-wide uppercase text-black">
                        LISTA DE ASISTENCIA
                      </h1>
                      <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-black -mt-0.5">
                        {asistenciaMes.toUpperCase()} {asistenciaYear}
                      </h2>
                    </div>

                    {/* TOP INFO BOX */}
                    <div className="w-full mb-3">
                      <table className="w-full border border-black border-collapse text-xs">
                        <tbody>
                          <tr className="border-b border-black">
                            <td className="border-r border-black px-2.5 py-1 font-bold w-48 text-black uppercase bg-slate-50">
                              NOMBRE DE LA ESCUELA:
                            </td>
                            <td colSpan={3} className="px-2.5 py-1 font-bold text-black uppercase">
                              {institutionName || 'ESCUELA SOR JUANA'}
                            </td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="border-r border-black px-2.5 py-1 font-bold text-black uppercase bg-slate-50">
                              GRUPO: <span className="font-normal text-black ml-2">{asistenciaGrupo !== 'Todos' ? asistenciaGrupo : 'TODOS'}</span>
                            </td>
                            <td className="px-2.5 py-1 font-bold text-black uppercase">
                              GRADO: <span className="font-normal text-black ml-2">{asistenciaGrado !== 'Todos' ? asistenciaGrado : 'TODOS'}</span>
                            </td>
                          </tr>
                          <tr>
                            <td className="border-r border-black px-2.5 py-1 font-bold text-black uppercase bg-slate-50">
                              NOMBRE DEL DOCENTE:
                            </td>
                            <td colSpan={3} className="px-2.5 py-1 font-bold text-black uppercase">
                              {asistenciaDocente || 'PATRICIA RAMÍREZ'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* MAIN ATTENDANCE GRID */}
                    <table className="w-full border-2 border-black border-collapse text-[9px] text-black">
                      <thead>
                        {/* ROW 1: SEMANAS */}
                        <tr className="border-b border-black">
                          <th colSpan={3} className="border-r border-black bg-white"></th>
                          <th colSpan={5} className="border-r border-black text-center font-bold bg-[#bfdbfe] py-0.5 text-[10px] text-black">
                            SEMANA 1
                          </th>
                          <th colSpan={5} className="border-r border-black text-center font-bold bg-[#bfdbfe] py-0.5 text-[10px] text-black">
                            SEMANA 2
                          </th>
                          <th colSpan={5} className="border-r border-black text-center font-bold bg-[#bfdbfe] py-0.5 text-[10px] text-black">
                            SEMANA 3
                          </th>
                          <th colSpan={5} className="border-r border-black text-center font-bold bg-[#bfdbfe] py-0.5 text-[10px] text-black">
                            SEMANA 4
                          </th>
                          <th rowSpan={2} className="border-l border-black text-center font-bold bg-[#dcfce7] px-1 py-0.5 text-[8px] leading-tight w-14 text-black">
                            % de Asistencia
                          </th>
                        </tr>
                        {/* ROW 2: DAYS & STUDENT INFO */}
                        <tr className="border-b border-black text-center font-bold text-[9px]">
                          <th className="border-r border-black w-6 py-0.5 bg-white text-black">#</th>
                          <th className="border-r border-black py-0.5 bg-[#2563eb] text-white uppercase text-left px-2 min-w-[170px]">
                            NOMBRE
                          </th>
                          <th className="border-r border-black w-6 py-0.5 bg-[#93c5fd] text-black font-bold">G</th>
                          
                          {/* SEMANA 1 */}
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">L</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">J</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">V</th>

                          {/* SEMANA 2 */}
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">L</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">J</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">V</th>

                          {/* SEMANA 3 */}
                          <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">L</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">M</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">M</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">J</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">V</th>

                          {/* SEMANA 4 */}
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">L</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">J</th>
                          <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">V</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 45 }, (_, rowIdx) => {
                          const studentData = attendanceProcessedData.rows[rowIdx];
                          if (studentData) {
                            return (
                              <tr key={rowIdx} className="border-b border-black text-center h-[18px] hover:bg-amber-50/60">
                                <td className="border-r border-black font-semibold text-black py-0.5">{rowIdx + 1}</td>
                                <td className="border-r border-black text-left px-2 font-medium text-black py-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                  {studentData.nombre}
                                </td>
                                <td className="border-r border-black font-semibold text-black py-0.5">{studentData.genero}</td>
                                {studentData.marks.map((m, dIdx) => {
                                  let colorClass = 'text-black';
                                  if (m === 'A') colorClass = 'text-emerald-700 font-bold';
                                  if (m === 'R') colorClass = 'text-amber-600 font-bold';
                                  if (m === 'F') colorClass = 'text-rose-600 font-bold';
                                  return (
                                    <td key={dIdx} className={`border-r border-black py-0.5 ${colorClass}`}>
                                      {m}
                                    </td>
                                  );
                                })}
                                <td className="border-black font-bold text-emerald-800 py-0.5">
                                  {studentData.porcentaje}
                                </td>
                              </tr>
                            );
                          } else {
                            return (
                              <tr key={rowIdx} className="border-b border-black text-center h-[18px]">
                                <td className="border-r border-black font-semibold text-black py-0.5">{rowIdx + 1}</td>
                                <td className="border-r border-black text-left px-2 py-0.5"></td>
                                <td className="border-r border-black py-0.5"></td>
                                {Array.from({ length: 20 }, (_, dIdx) => (
                                  <td key={dIdx} className="border-r border-black py-0.5"></td>
                                ))}
                                <td className="border-black py-0.5"></td>
                              </tr>
                            );
                          }
                        })}

                        {/* BOTTOM ROW: ASISTENCIAS DEL DÍA */}
                        <tr className="border-b-2 border-black font-bold text-center">
                          <td colSpan={3} className="border-r border-black text-right px-2 py-1 text-[10px] uppercase font-black">
                            ASISTENCIAS DEL DÍA
                          </td>
                          {attendanceProcessedData.dailyTotals.map((tot, dIdx) => (
                            <td key={dIdx} className="border-r border-black py-1 bg-[#86efac] text-black font-bold text-[9px]">
                              {tot > 0 ? tot : ''}
                            </td>
                          ))}
                          <td className="border-black py-1 bg-[#86efac] text-black font-black text-[9px]">
                            {attendanceProcessedData.totalAlumnos > 0 ? attendanceProcessedData.totalAlumnos : ''}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* BOTTOM SUMMARY & SIGNATURES */}
                    <div className="mt-3 flex flex-col sm:flex-row items-start justify-between gap-6">
                      {/* LEFT: CONTEO TOTAL DE ALUMNOS */}
                      <div className="w-full sm:w-64">
                        <table className="w-full border border-black border-collapse text-[10px]">
                          <tbody>
                            <tr className="border-b border-black bg-slate-100 font-bold">
                              <td colSpan={2} className="border-r border-black px-2 py-1 text-black uppercase">
                                CONTEO TOTAL DE ALUMNOS
                              </td>
                              <td className="border-r border-black px-2 py-1 text-center font-bold text-black w-10">H</td>
                              <td className="px-2 py-1 text-center font-bold text-black w-10">M</td>
                            </tr>
                            <tr className="border-b border-black font-medium">
                              <td colSpan={2} className="border-r border-black px-2 py-1 text-black">
                                HOMBRES y MUJERES
                              </td>
                              <td className="border-r border-black px-2 py-1 text-center font-bold text-black">
                                {attendanceProcessedData.conteoH}
                              </td>
                              <td className="px-2 py-1 text-center font-bold text-black">
                                {attendanceProcessedData.conteoM}
                              </td>
                            </tr>
                            <tr className="font-bold">
                              <td colSpan={2} className="border-r border-black px-2 py-1 text-black uppercase">
                                TOTAL DE ALUMNOS
                              </td>
                              <td colSpan={2} className="px-2 py-1 text-center font-black text-black">
                                {attendanceProcessedData.totalAlumnos}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* RIGHT: PROMEDIO TOTAL & SIGNATURES */}
                      <div className="w-full sm:w-auto flex-1 flex flex-col items-end">
                        <div className="mb-4">
                          <table className="border border-black border-collapse text-[10px]">
                            <tbody>
                              <tr>
                                <td className="border-r border-black px-3 py-1 font-bold bg-slate-100 text-black uppercase">
                                  PROMEDIO TOTAL:
                                </td>
                                <td className="px-4 py-1 font-black text-black">
                                  {attendanceProcessedData.averagePorcentaje}%
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* SIGNATURES */}
                        <div className="w-full grid grid-cols-2 gap-8 text-center pt-4">
                          <div>
                            <div className="border-t border-black w-4/5 mx-auto pt-1">
                              <p className="text-[9px] font-bold uppercase text-black">NOMBRE Y FIRMA DEL PROFESOR</p>
                            </div>
                          </div>
                          <div>
                            <div className="border-t border-black w-4/5 mx-auto pt-1">
                              <p className="text-[9px] font-bold uppercase text-black">NOMBRE Y FIRMA DEL DIRECTOR(A)</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* WATERMARK FOOTER */}
                    <div className="text-center mt-3 text-[9px] text-slate-500 font-sans">
                      didocu.com
                    </div>
                  </div>
                </div>
              ) : (
                /* View 2: Data Table */
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0f3458] text-white uppercase text-[10px] font-bold">
                        <tr>
                          <th className="py-2.5 px-2 text-center w-10">No.</th>
                          <th className="py-2.5 px-3 min-w-[200px]">NOMBRE DEL ALUMNO</th>
                          <th className="py-2.5 px-2 text-center w-10">GEN</th>
                          {attendanceDays.map(d => (
                            <th key={d} className="py-2.5 px-1 text-center w-6 text-[9px] font-mono border-l border-blue-900/30">
                              D{d}
                            </th>
                          ))}
                          <th className="py-2.5 px-2 text-center w-14 bg-blue-950 font-bold border-l border-blue-900">% Asist.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendanceProcessedData.rows.length === 0 ? (
                          <tr>
                            <td colSpan={24} className="py-12 text-center text-slate-500">
                              <ClipboardList size={32} className="mx-auto text-slate-300 mb-2" />
                              <p className="font-semibold text-slate-600">No hay alumnos para este grado y grupo.</p>
                            </td>
                          </tr>
                        ) : (
                          attendanceProcessedData.rows.map((r, idx) => {
                            return (
                              <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                                <td className="py-2 px-2 text-center font-bold text-slate-400 text-[11px]">{r.idx}</td>
                                <td className="py-2 px-3 font-bold text-slate-800 tracking-wide uppercase whitespace-nowrap text-[11px]">
                                  {r.nombre}
                                </td>
                                <td className="py-2 px-2 text-center font-semibold text-slate-600 text-[11px]">
                                  {r.genero}
                                </td>
                                {r.marks.map((m, dIdx) => (
                                  <td key={dIdx} className="py-2 px-1 text-center text-[10px] font-mono border-l border-slate-100">
                                    {m === 'A' && <span className="font-bold text-emerald-600">A</span>}
                                    {m === 'R' && <span className="font-bold text-amber-600">R</span>}
                                    {m === 'F' && <span className="font-bold text-rose-600">F</span>}
                                  </td>
                                ))}
                                <td className="py-2 px-2 text-center font-bold text-emerald-700 bg-emerald-50/60 border-l border-slate-200">
                                  {r.porcentaje}%
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>Total alumnos en control de asistencia: <strong>{attendanceProcessedData.totalAlumnos}</strong> (Hombres: {attendanceProcessedData.conteoH}, Mujeres: {attendanceProcessedData.conteoM})</span>
                    <span className="text-emerald-700 font-bold">Asistencia global del período: {attendanceProcessedData.averagePorcentaje}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Building size={14} className="text-slate-400" />
            <span>{institutionName || 'Sistema Académico'}</span>
            <span>•</span>
            <span>Boletín Oficial Académico</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT-ONLY AREA: EXACT TEMPLATES MATCHING USER IMAGES */}
      {/* ========================================================================= */}
      <div id="boletin-print-area" className="hidden print:block text-black bg-white">
        
        {/* ========================================================================= */}
        {/* 1. PRINT LISTA DE ALUMNOS (Exact template from lista por grupo.png) */}
        {/* ========================================================================= */}
        {activeTab === 'alumnos' && (
          <div>
            <div className="flex items-center justify-center gap-4 mb-5 pt-1 border-b border-black/20 pb-3">
              <img 
                src={effectiveLogo} 
                alt="Logo" 
                className="w-14 h-14 object-contain shrink-0" 
              />
              <div className="text-center">
                <h1 className="font-bold text-base uppercase tracking-wider text-black leading-tight">
                  {institutionName ? institutionName.toUpperCase() : 'CENTRO EDUCATIVO VILLA MONTESSORI'}
                </h1>
                <p className="font-bold text-sm uppercase text-black mt-1 leading-tight">
                  {cicloTextClean}
                </p>
                <p className="font-bold text-sm uppercase text-black mt-0.5 leading-tight">
                  GRADO {printGradoText} GRUPO {printGrupoText.replace(/^grupo\s+/i, '')}
                </p>
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-xs text-black">
              <thead>
                <tr className="border-b border-black">
                  <th className="border border-black px-3 py-1.5 text-center font-bold w-16 text-black">
                    No.
                  </th>
                  <th className="border border-black px-4 py-1.5 text-center font-bold text-black uppercase tracking-wider">
                    NOMBRE DEL ALUMNO
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAlumnos.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="border border-black py-4 text-center font-bold">
                      NO HAY ALUMNOS REGISTRADOS EN ESTE GRADO Y GRUPO
                    </td>
                  </tr>
                ) : (
                  filteredAlumnos.map((a, idx) => {
                    const nombreFormateado = a.apellidos 
                      ? `${a.apellidos} ${a.nombres}`.toUpperCase() 
                      : a.nombres.toUpperCase();
                    return (
                      <tr key={a.id || idx} className="border-b border-black">
                        <td className="border border-black px-3 py-1 text-center font-normal text-black">
                          {idx + 1}
                        </td>
                        <td className="border border-black px-4 py-1 text-left font-normal uppercase text-black">
                          {nombreFormateado}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. PRINT KARDEX / BOLETA DE EVALUACION (Montessori vs SEP) */}
        {/* ========================================================================= */}
        {activeTab === 'kardex' && (
          <div>
            {kardexPrintFormat === 'montessori' ? (
              kardexStudentsToRender.map((std, idx) => renderMontessoriCard(std, idx, true))
            ) : (
              kardexStudentsToRender.map((std, idx) => {
                const names = parseStudentName(std);
              const grades = getStudentSubjectGrades(std);
              const validFinals = grades.map(g => Number(g.final)).filter(v => !isNaN(v) && v > 0);
              const gAvg = validFinals.length > 0 ? (validFinals.reduce((a, b) => a + b, 0) / validFinals.length).toFixed(1) : (std.promedio || '9.0');
              const isLast = idx === kardexStudentsToRender.length - 1;

              return (
                <div key={std.id || idx} className={`space-y-3 pb-6 ${!isLast ? 'page-break-after-always' : ''}`}>
                  {/* Official SEP Header matching Michoacán format */}
                  {renderSepHeader()}

                  {/* School Information Box */}
                  <div className="border border-black rounded-lg p-2 text-[9.5px] space-y-1">
                    <div className="flex justify-between items-end border-b border-dotted border-black pb-1">
                      <div>
                        <p className="font-bold uppercase text-black">
                          {institutionName || 'ESCUELA TELESECUNDARIA 1154 VICENTE SUAREZ FERRER'}
                        </p>
                        <p className="text-[7.5px] text-black uppercase">
                          NOMBRE OFICIAL DE LA ESCUELA SEGÚN CATALOGO DE CENTRO DE TRABAJO
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold uppercase text-black">07ETV1188Q</p>
                        <p className="text-[7.5px] text-black uppercase">CLAVE SEGÚN CCT</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-end text-[9px] pt-0.5">
                      <div>
                        <span className="font-bold uppercase">COLONIA O LOCALIDAD: </span>
                        <span className="uppercase text-black">DR. MANUEL VELASCO SUAREZ</span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">MUNICIPIO O DELEGACION POLITICA: </span>
                        <span className="uppercase text-black">TZIMOL</span>
                      </div>
                    </div>
                  </div>

                  {/* Student Information Box */}
                  <div className="border border-black rounded-lg p-2 text-[9.5px] space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold uppercase text-[9.5px]">ALUMNO</span>
                      <div className="grid grid-cols-3 gap-4 flex-1 text-center">
                        <div className="border-b border-black pb-0.5">
                          <p className="font-bold uppercase text-black">{names.primerApellido}</p>
                          <p className="text-[7.5px] uppercase text-black">PRIMER APELLIDO</p>
                        </div>
                        <div className="border-b border-black pb-0.5">
                          <p className="font-bold uppercase text-black">{names.segundoApellido}</p>
                          <p className="text-[7.5px] uppercase text-black">SEGUNDO APELLIDO</p>
                        </div>
                        <div className="border-b border-black pb-0.5">
                          <p className="font-bold uppercase text-black">{names.nombres}</p>
                          <p className="text-[7.5px] uppercase text-black">NOMBRE (S)</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 items-center text-center text-[9px]">
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        <span className="font-bold text-[7.5px] uppercase">FECHA DE NACIMIENTO</span>
                        <span className="border border-black px-1.5 py-0.5 font-mono font-bold">03</span>
                        <span className="border border-black px-1.5 py-0.5 font-bold uppercase">MAYO</span>
                        <span className="border border-black px-1.5 py-0.5 font-mono font-bold">98</span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-bold text-[7.5px] uppercase">SEXO</span>
                        <span className="border border-black px-2 py-0.5 font-bold uppercase">
                          {std.genero?.toUpperCase().startsWith('F') ? 'F' : 'M'}
                        </span>
                      </div>
                      <div className="border-b border-black">
                        <p className="font-bold uppercase text-black">{std.turno || 'MATUTINO'}</p>
                        <p className="text-[7px] uppercase text-black">TURNO</p>
                      </div>
                      <div className="border-b border-black">
                        <p className="font-bold uppercase text-black">{std.grupo || 'A'}</p>
                        <p className="text-[7px] uppercase text-black">GRUPO</p>
                      </div>
                    </div>

                    <div className="text-[8.5px] border-t border-black/30 pt-1 flex justify-between">
                      <div>
                        <span className="font-bold uppercase">DOMICILIO: </span>
                        <span className="text-black uppercase">{std.direccion || 'CALLE CENTRAL NORTE S/N, COLONIA CENTRO'}</span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">TELEFONO: </span>
                        <span className="text-black uppercase font-mono">{std.telefono || '9631234567'}</span>
                      </div>
                    </div>

                    <div className="text-[8.5px]">
                      <span className="font-bold uppercase">NOMBRE DEL PADRE DE FAMILIA O TUTOR: </span>
                      <span className="border-b border-black px-2 font-bold uppercase text-black">
                        {std.tutor || 'MARTHA ARACELI HERNANDEZ VELASCO'}
                      </span>
                    </div>

                    <div className="text-[8px] text-black">
                      <span className="font-bold uppercase">OBSERVACIONES: </span>
                      <span className="border-b border-black inline-block w-[80%]"></span>
                    </div>
                  </div>

                  {/* Grade Title */}
                  <div className="text-center py-1">
                    <h3 className="font-extrabold text-sm uppercase tracking-widest text-black">
                      {getGradoText(std.grado || '1°')}
                    </h3>
                  </div>

                  {/* Official Grades SEP Grid */}
                  <table className="w-full border-collapse border border-black text-[8.5px] text-center">
                    <thead>
                      <tr className="border-b border-black">
                        <th rowSpan={2} className="border border-black px-2 py-1 text-left uppercase w-52 font-bold text-black">
                          PERIODO ESCOLAR {cicloTextClean.replace('CICLO ESCOLAR', '')} <br /> ASIGNATURAS
                        </th>
                        <th colSpan={4} className="border border-black px-1 py-0.5 uppercase font-bold text-black">
                          TRIMESTRES DE EVALUACIÓN
                        </th>
                        <th colSpan={4} className="border border-black px-1 py-0.5 uppercase font-bold text-black">
                          INASISTENCIAS
                        </th>
                        <th colSpan={3} className="border border-black px-1 py-0.5 uppercase font-bold text-black">
                          EXAMEN DE REGULARIZACION
                        </th>
                      </tr>
                      <tr className="border-b border-black text-[7px] font-bold text-black">
                        <th className="border border-black px-0.5 py-1 w-14">
                          1ER TRIMESTRE
                          <span className="block text-[6px] font-normal leading-tight">SEP - NOV</span>
                        </th>
                        <th className="border border-black px-0.5 py-1 w-14">
                          2DO TRIMESTRE
                          <span className="block text-[6px] font-normal leading-tight">DIC - MAR</span>
                        </th>
                        <th className="border border-black px-0.5 py-1 w-14">
                          3ER TRIMESTRE
                          <span className="block text-[6px] font-normal leading-tight">ABR - JUN</span>
                        </th>
                        <th className="border border-black px-0.5 py-1 w-11 bg-slate-100">CALIFICACION<br/>FINAL</th>
                        <th className="border border-black px-0.5 py-1 w-6">1ER TRIM<br/><span className="text-[5.5px] font-normal">(SEP-NOV)</span></th>
                        <th className="border border-black px-0.5 py-1 w-6">2DO TRIM<br/><span className="text-[5.5px] font-normal">(DIC-MAR)</span></th>
                        <th className="border border-black px-0.5 py-1 w-6">3ER TRIM<br/><span className="text-[5.5px] font-normal">(ABR-JUN)</span></th>
                        <th className="border border-black px-0.5 py-1 w-6 bg-slate-100">TOTAL</th>
                        <th className="border border-black px-1 py-1 w-12">TIPO DE<br/>EXAMEN</th>
                        <th className="border border-black px-1 py-1 w-10">FECHA</th>
                        <th className="border border-black px-1 py-1 w-9">CALIFI-<br/>CACION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-black">
                          <td className="border border-black px-2 py-0.5 text-left font-bold uppercase whitespace-nowrap text-black">
                            {row.materia}
                          </td>
                          <td className="border border-black px-0.5 py-0.5 font-mono text-black">{row.t1 || row.b1}</td>
                          <td className="border border-black px-0.5 py-0.5 font-mono text-black">{row.t2 || row.b2}</td>
                          <td className="border border-black px-0.5 py-0.5 font-mono text-black">{row.t3 || row.b3}</td>
                          <td className="border border-black px-0.5 py-0.5 font-mono font-bold bg-slate-100 text-black">{row.final}</td>
                          <td className="border border-black px-0.5 py-0.5"></td>
                          <td className="border border-black px-0.5 py-0.5"></td>
                          <td className="border border-black px-0.5 py-0.5"></td>
                          <td className="border border-black px-0.5 py-0.5 font-bold bg-slate-100"></td>
                          <td className="border border-black px-0.5 py-0.5 text-[7px]"></td>
                          <td className="border border-black px-0.5 py-0.5 text-[7px]"></td>
                          <td className="border border-black px-0.5 py-0.5 text-[7px]"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Footer Information from Image */}
                  <div className="pt-2 text-[8.5px] space-y-1 text-black">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-bold uppercase">LENGUA EXTRANJERA: </span>
                        <span className="border-b border-black font-semibold px-4">INGLES</span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">CLAVE DE LA LENGUA EXTRANJERA: </span>
                        <span className="border-b border-black font-semibold px-6">I</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <div>
                        <span className="font-bold uppercase">TECNOLOGIA: </span>
                        <span className="border-b border-black font-semibold px-4">OFIMATICA</span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">CLAVE DE LA TECNOLOGIA: </span>
                        <span className="border-b border-black font-semibold px-6">TE01</span>
                      </div>
                    </div>
                    
                    {/* Bottom Underlined Summary */}
                    <div className="grid grid-cols-5 gap-2 text-center pt-2 text-[7.5px]">
                      <div className="border-b border-black pb-0.5">
                        <p className="font-bold text-[9px] uppercase text-black">{std.grupo || 'A'}</p>
                        <p className="uppercase text-black">GRUPO</p>
                      </div>
                      <div className="border-b border-black pb-0.5">
                        <p className="font-bold text-[9px] uppercase text-black">{names.primerApellido}</p>
                        <p className="uppercase text-black">PRIMER APELLIDO</p>
                      </div>
                      <div className="border-b border-black pb-0.5">
                        <p className="font-bold text-[9px] uppercase text-black">{names.segundoApellido}</p>
                        <p className="uppercase text-black">SEGUNDO APELLIDO</p>
                      </div>
                      <div className="border-b border-black pb-0.5">
                        <p className="font-bold text-[9px] uppercase text-black">{names.nombres}</p>
                        <p className="uppercase text-black">NOMBRE (S)</p>
                      </div>
                      <div className="border-b border-black pb-0.5">
                        <p className="font-bold text-[8.5px] font-mono uppercase text-black">{std.curp || 'AAHM980503MCSLRR'}</p>
                        <p className="uppercase text-black">CURP</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <div className="text-[8px]">
                        <span>FOLIO DE BOLETA DE EVALUACION DE {getGradoText(std.grado || '1°')}: </span>
                        <span className="border-b border-black inline-block w-40"></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase text-[9px]">PROMEDIO GENERAL ANUAL:</span>
                        <span className="font-extrabold text-sm px-3 py-0.5 border border-black font-mono">
                          {gAvg}
                        </span>
                      </div>
                    </div>

                    {/* SIGNATURES */}
                    <div className="grid grid-cols-3 gap-4 text-center pt-3 border-t border-black/20 mt-2 text-[7.5px] text-black">
                      <div>
                        <div className="border-t border-black w-4/5 mx-auto pt-0.5 font-bold uppercase">FIRMA DEL MAESTRO(A)</div>
                      </div>
                      <div>
                        <div className="border-t border-black w-4/5 mx-auto pt-0.5 font-bold uppercase">FIRMA DEL DIRECTOR(A)</div>
                      </div>
                      <div>
                        <div className="border-t border-black w-4/5 mx-auto pt-0.5 font-bold uppercase">FIRMA PADRE / TUTOR</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. PRINT LISTA DE ASISTENCIA (EXACT MATCH OF didocu TEMPLATE) */}
        {/* ========================================================================= */}
        {activeTab === 'asistencia' && (
          <div className="w-full text-black bg-white font-sans text-xs">
            {/* TITLE */}
            <div className="flex items-center justify-between mb-3 border-b border-black pb-2">
              <div className="flex items-center gap-3">
                <img 
                  src={effectiveLogo} 
                  alt="Logo" 
                  className="w-12 h-12 object-contain shrink-0" 
                />
                <div>
                  <h1 className="text-xl font-black tracking-wide uppercase text-black leading-tight">
                    LISTA DE ASISTENCIA — {institutionName ? institutionName.toUpperCase() : 'CENTRO EDUCATIVO VILLA MONTESSORI'}
                  </h1>
                  <h2 className="text-sm font-bold tracking-wide uppercase text-black leading-tight">
                    {asistenciaMes.toUpperCase()} {asistenciaYear}
                  </h2>
                </div>
              </div>
            </div>

            {/* TOP INFO BOX */}
            <div className="w-full mb-2">
              <table className="w-full border border-black border-collapse text-[11px]">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="border-r border-black px-2 py-0.5 font-bold w-48 text-black uppercase bg-slate-100">
                      NOMBRE DE LA ESCUELA:
                    </td>
                    <td colSpan={3} className="px-2 py-0.5 font-bold text-black uppercase">
                      {institutionName || 'ESCUELA SOR JUANA'}
                    </td>
                  </tr>
                  <tr className="border-b border-black">
                    <td className="border-r border-black px-2 py-0.5 font-bold text-black uppercase bg-slate-100">
                      GRUPO: <span className="font-normal text-black ml-2">{asistenciaGrupo !== 'Todos' ? asistenciaGrupo : 'TODOS'}</span>
                    </td>
                    <td className="px-2 py-0.5 font-bold text-black uppercase">
                      GRADO: <span className="font-normal text-black ml-2">{asistenciaGrado !== 'Todos' ? asistenciaGrado : 'TODOS'}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border-r border-black px-2 py-0.5 font-bold text-black uppercase bg-slate-100">
                      NOMBRE DEL DOCENTE:
                    </td>
                    <td colSpan={3} className="px-2 py-0.5 font-bold text-black uppercase">
                      {asistenciaDocente || 'PATRICIA RAMÍREZ'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* MAIN ATTENDANCE TABLE (45 ROWS) */}
            <table className="w-full border border-black border-collapse text-[8.5px] text-black">
              <thead>
                {/* ROW 1: SEMANAS */}
                <tr className="border-b border-black">
                  <th colSpan={3} className="border-r border-black bg-white"></th>
                  <th colSpan={5} className="border-r border-black text-center font-bold bg-[#bfdbfe] py-0.5 text-[9.5px] text-black">
                    SEMANA 1
                  </th>
                  <th colSpan={5} className="border-r border-black text-center font-bold bg-[#bfdbfe] py-0.5 text-[9.5px] text-black">
                    SEMANA 2
                  </th>
                  <th colSpan={5} className="border-r border-black text-center font-bold bg-[#bfdbfe] py-0.5 text-[9.5px] text-black">
                    SEMANA 3
                  </th>
                  <th colSpan={5} className="border-r border-black text-center font-bold bg-[#bfdbfe] py-0.5 text-[9.5px] text-black">
                    SEMANA 4
                  </th>
                  <th rowSpan={2} className="border-l border-black text-center font-bold bg-[#dcfce7] px-0.5 py-0.5 text-[7.5px] leading-tight w-12 text-black">
                    % de Asistencia
                  </th>
                </tr>
                {/* ROW 2: DAYS & STUDENT INFO */}
                <tr className="border-b border-black text-center font-bold text-[8.5px]">
                  <th className="border-r border-black w-6 py-0.5 bg-white text-black">#</th>
                  <th className="border-r border-black py-0.5 bg-[#2563eb] text-white uppercase text-left px-2 min-w-[160px]">
                    NOMBRE
                  </th>
                  <th className="border-r border-black w-6 py-0.5 bg-[#93c5fd] text-black font-bold">G</th>
                  
                  {/* SEMANA 1 */}
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">L</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">J</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">V</th>

                  {/* SEMANA 2 */}
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">L</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">J</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">V</th>

                  {/* SEMANA 3 */}
                  <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">L</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">M</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">M</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">J</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#fed7aa] text-black font-bold">V</th>

                  {/* SEMANA 4 */}
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">L</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">M</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">J</th>
                  <th className="border-r border-black w-5 py-0.5 bg-[#86efac] text-black font-bold">V</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 45 }, (_, rowIdx) => {
                  const studentData = attendanceProcessedData.rows[rowIdx];
                  if (studentData) {
                    return (
                      <tr key={rowIdx} className="border-b border-black text-center h-[16px]">
                        <td className="border-r border-black font-semibold text-black py-0.5">{rowIdx + 1}</td>
                        <td className="border-r border-black text-left px-2 font-medium text-black py-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                          {studentData.nombre}
                        </td>
                        <td className="border-r border-black font-semibold text-black py-0.5">{studentData.genero}</td>
                        {studentData.marks.map((m, dIdx) => {
                          let colorClass = 'text-black';
                          if (m === 'A') colorClass = 'text-emerald-700 font-bold';
                          if (m === 'R') colorClass = 'text-amber-600 font-bold';
                          if (m === 'F') colorClass = 'text-rose-600 font-bold';
                          return (
                            <td key={dIdx} className={`border-r border-black py-0.5 ${colorClass}`}>
                              {m}
                            </td>
                          );
                        })}
                        <td className="border-black font-bold text-emerald-800 py-0.5">
                          {studentData.porcentaje}
                        </td>
                      </tr>
                    );
                  } else {
                    return (
                      <tr key={rowIdx} className="border-b border-black text-center h-[16px]">
                        <td className="border-r border-black font-semibold text-black py-0.5">{rowIdx + 1}</td>
                        <td className="border-r border-black text-left px-2 py-0.5"></td>
                        <td className="border-r border-black py-0.5"></td>
                        {Array.from({ length: 20 }, (_, dIdx) => (
                          <td key={dIdx} className="border-r border-black py-0.5"></td>
                        ))}
                        <td className="border-black py-0.5"></td>
                      </tr>
                    );
                  }
                })}

                {/* BOTTOM ROW: ASISTENCIAS DEL DÍA */}
                <tr className="border-b-2 border-black font-bold text-center">
                  <td colSpan={3} className="border-r border-black text-right px-2 py-0.5 text-[9px] uppercase font-black">
                    ASISTENCIAS DEL DÍA
                  </td>
                  {attendanceProcessedData.dailyTotals.map((tot, dIdx) => (
                    <td key={dIdx} className="border-r border-black py-0.5 bg-[#86efac] text-black font-bold text-[8.5px]">
                      {tot > 0 ? tot : ''}
                    </td>
                  ))}
                  <td className="border-black py-0.5 bg-[#86efac] text-black font-black text-[8.5px]">
                    {attendanceProcessedData.totalAlumnos > 0 ? attendanceProcessedData.totalAlumnos : ''}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* BOTTOM SUMMARY & SIGNATURES */}
            <div className="mt-2.5 flex items-start justify-between gap-6">
              {/* LEFT: CONTEO TOTAL DE ALUMNOS */}
              <div className="w-56">
                <table className="w-full border border-black border-collapse text-[9px]">
                  <tbody>
                    <tr className="border-b border-black bg-slate-100 font-bold">
                      <td colSpan={2} className="border-r border-black px-1.5 py-0.5 text-black uppercase">
                        CONTEO TOTAL DE ALUMNOS
                      </td>
                      <td className="border-r border-black px-1.5 py-0.5 text-center font-bold text-black w-8">H</td>
                      <td className="px-1.5 py-0.5 text-center font-bold text-black w-8">M</td>
                    </tr>
                    <tr className="border-b border-black font-medium">
                      <td colSpan={2} className="border-r border-black px-1.5 py-0.5 text-black">
                        HOMBRES y MUJERES
                      </td>
                      <td className="border-r border-black px-1.5 py-0.5 text-center font-bold text-black">
                        {attendanceProcessedData.conteoH}
                      </td>
                      <td className="px-1.5 py-0.5 text-center font-bold text-black">
                        {attendanceProcessedData.conteoM}
                      </td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={2} className="border-r border-black px-1.5 py-0.5 text-black uppercase">
                        TOTAL DE ALUMNOS
                      </td>
                      <td colSpan={2} className="px-1.5 py-0.5 text-center font-black text-black">
                        {attendanceProcessedData.totalAlumnos}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* RIGHT: PROMEDIO TOTAL & SIGNATURES */}
              <div className="flex-1 flex flex-col items-end">
                <div className="mb-3">
                  <table className="border border-black border-collapse text-[9px]">
                    <tbody>
                      <tr>
                        <td className="border-r border-black px-2.5 py-0.5 font-bold bg-slate-100 text-black uppercase">
                          PROMEDIO TOTAL:
                        </td>
                        <td className="px-3 py-0.5 font-black text-black">
                          {attendanceProcessedData.averagePorcentaje}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* SIGNATURES */}
                <div className="w-full grid grid-cols-2 gap-6 text-center pt-3">
                  <div>
                    <div className="border-t border-black w-4/5 mx-auto pt-1">
                      <p className="text-[8.5px] font-bold uppercase text-black">NOMBRE Y FIRMA DEL PROFESOR</p>
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-black w-4/5 mx-auto pt-1">
                      <p className="text-[8.5px] font-bold uppercase text-black">NOMBRE Y FIRMA DEL DIRECTOR(A)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* WATERMARK FOOTER */}
            <div className="text-center mt-2 text-[8px] text-slate-500 font-sans">
              didocu.com
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
