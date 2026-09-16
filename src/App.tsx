import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Database, Folder, ShieldAlert, GraduationCap, CheckCircle2, CheckCircle, XCircle, Send, HelpCircle, ExternalLink, Loader2, Menu, PanelLeftClose, Users, BookOpen, FileSpreadsheet, FileText, Settings, LogOut, UserCircle, ShieldCheck, UserCog, Shield, Plus, Trash2, Edit3, Search, UserCheck, UserX, Mail, ClipboardList, GraduationCap as TeacherIcon, ChevronDown, ChevronRight, Lock, Unlock, RefreshCw, AlertTriangle, Volume2, VolumeX, Sparkles, School, Printer, Download, X, Bell, Calendar, Award, CheckSquare, FileCheck, Eye, EyeOff, KeyRound, UploadCloud, Smartphone, QrCode, Share2, Copy, Check, LogIn, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { setupSysAcadWorkspace, syncAllDataToSheets, createDriveFolder, createSpreadsheet, moveFileToFolder, writeAllMasterHeaders, WorkspaceSetupResult, syncUsersToSheet, fetchUsersFromSheets, loadFullDataFromSheets, setupSpecificCycleInDrive, searchDriveFiles } from './google-api';
import { googleSignIn, initAuth, logout, getEffectiveClientId, setCustomClientId, validateGoogleToken, clearInvalidToken } from './auth';
import { playClickSound, playNavigateSound, playLoginSuccessSound, playLogoutSound, playSuccessSound, playErrorSound, playDeleteSound, isSoundMuted, toggleSoundMute } from './soundEffects';
import { StudentEnrollmentModal, StudentFormData } from './components/StudentEnrollmentModal';
import { InformesGeneralModal } from './components/InformesGeneralModal';
import { BoletinGeneralModal } from './components/BoletinGeneralModal';
import { CalificacionesModal } from './components/CalificacionesModal';
import { DirectTablePrintModal, TablePrintType } from './components/DirectTablePrintModal';
import { PasswordStrengthMeter, evaluatePasswordStrength } from './components/PasswordStrengthMeter';
import { CentroEscolarView, CentroEscolarData, DEFAULT_CENTRO_ESCOLAR } from './components/CentroEscolarView';
import { User } from 'firebase/auth';
import { encodeSyncPayload, decodeSyncPayload, generateMobileSyncUrl, extractSyncPayloadFromUrl } from './syncBridge';
import { DEFAULT_VILLA_MONTESSORI_LOGO } from './assets/logo';

import { subscribeToFirebaseStore, saveToFirebaseStore, loadFromFirebaseStore } from './firebase';

export interface AppUser {
  username: string;
  email: string;
  role: 'Administrador' | 'Control Escolar' | 'Maestros' | 'Directivo' | 'Alumno';
}

export interface SystemUser {
  id: string;
  username: string;
  password?: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Control Escolar' | 'Maestros' | 'Directivo' | 'Alumno';
  status: 'Activo' | 'Inactivo';
  fechaRegistro?: string;
  lastAccess: string;
  mustChangePassword?: boolean;
  firstLogin?: boolean;
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentView, setCurrentView] = useState(() => {
    const activeSessionFlag = sessionStorage.getItem('sysacad_active_session_flag');
    if (!activeSessionFlag) {
      localStorage.removeItem('sysacad_session_user');
      return 'administrador';
    }
    const saved = localStorage.getItem('sysacad_session_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u.role === 'Control Escolar' || u.role === 'Directivo') return 'alumnos';
        if (u.role === 'Maestros') return 'calificaciones';
        if (u.role === 'Alumno') return 'kardex-alumnos';
      } catch (e) {}
    }
    return 'administrador';
  });
  const [adminTab, setAdminTab] = useState<'config' | 'usuarios' | 'seguridad' | 'respaldos' | 'parametros' | 'centro-escolar'>('config');
  const [isControlEscolarSubOpen, setIsControlEscolarSubOpen] = useState(true);
  const [isMaestrosSubOpen, setIsMaestrosSubOpen] = useState(true);
  const [muted, setMuted] = useState<boolean>(() => isSoundMuted());

  interface DuplicateWarningState {
    isOpen: boolean;
    title?: string;
    message: string;
    detail?: string;
    existingRecordSummary?: string;
    onModify?: () => void;
  }

  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarningState | null>(null);

  const handleToggleSound = () => {
    const isNowMuted = toggleSoundMute();
    setMuted(isNowMuted);
  };

  const CLOUD_BRIDGE_BASE = 'https://ais-pre-ogx2s2n5vd2t3usuxsxljy-64544171970.us-west1.run.app';

  const fetchWithBridgeFallback = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
    try {
      const res = await fetch(endpoint, options);
      const cType = res.headers.get('content-type') || '';
      if (res.ok && cType.includes('application/json')) {
        return res;
      }
    } catch(e) {}
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return fetch(`${CLOUD_BRIDGE_BASE}${cleanPath}`, options);
  };

  // Helper sync functions for persistent multi-device shared data
  const syncUsersToServer = async (usersList: SystemUser[]) => {
    try {
      const payload = JSON.stringify({ users: usersList });
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      }).catch(() => {});
      fetch(`${CLOUD_BRIDGE_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      }).catch(() => {});
    } catch (err) {
      console.warn('Could not sync users to server store:', err);
    }
  };

  const syncSystemStoreToServer = async (data: Record<string, any>) => {
    try {
      const payload = JSON.stringify(data);
      fetch('/api/system-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      }).catch(() => {});
      fetch(`${CLOUD_BRIDGE_BASE}/api/system-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      }).catch(() => {});
      saveToFirebaseStore(data).catch(() => {});
    } catch (err) {
      console.warn('Could not sync system store to server:', err);
    }
  };

  // Unified System Users State (Guarantees Administrator account is always present)
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(() => {
    const adminUser: SystemUser = { 
      id: '1', 
      username: 'admin', 
      password: 'admin123', 
      name: 'Administrador Principal', 
      email: 'admin@sysacad.edu', 
      role: 'Administrador', 
      status: 'Activo', 
      fechaRegistro: new Date().toISOString().split('T')[0], 
      lastAccess: 'Reciente',
      mustChangePassword: false,
      firstLogin: false
    };

    const saved = localStorage.getItem('sysacad_system_users_v2') || 
                  localStorage.getItem('sysacad_system_users') || 
                  localStorage.getItem('sysacad_users');
    let parsed: any[] = [];
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch (e) {
        parsed = [];
      }
    }

    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      parsed = parsed.map(u => {
        const isAdm = (u.username || '').toLowerCase() === 'admin' || (u.username || '').toLowerCase() === 'administrador' || u.role === 'Administrador';
        let mappedRole = u.role as string;
        if (mappedRole === 'Docente') mappedRole = 'Maestros';
        if (mappedRole === 'Secretaría' || mappedRole === 'Secretaria') mappedRole = 'Control Escolar';
        return {
          ...u,
          role: mappedRole,
          lastAccess: isAdm ? (u.lastAccess || 'Reciente') : 'Nunca',
          mustChangePassword: isAdm ? false : true,
          firstLogin: isAdm ? false : true
        };
      });
      const hasAdmin = parsed.some(u => u.username?.toLowerCase() === 'admin' || u.role === 'Administrador');
      if (!hasAdmin) {
        const fullList = [adminUser, ...parsed];
        localStorage.setItem('sysacad_system_users_v2', JSON.stringify(fullList));
        return fullList;
      }
      localStorage.setItem('sysacad_system_users_v2', JSON.stringify(parsed));
      return parsed;
    }
    
    localStorage.setItem('sysacad_system_users_v2', JSON.stringify([adminUser]));
    return [adminUser];
  });

  const [incomingSyncToast, setIncomingSyncToast] = useState<string | null>(null);

  // 1. Process instant URL payload synchronization when opening via QR or shared link (#sync=...)
  useEffect(() => {
    const payload = extractSyncPayloadFromUrl();
    if (payload && Array.isArray(payload.users) && payload.users.length > 0) {
      const incoming = payload.users;
      setSystemUsers(prev => {
        const map = new Map<string, SystemUser>();
        prev.forEach(u => map.set((u.username || u.id).toLowerCase(), u));
        incoming.forEach((u: SystemUser) => map.set((u.username || u.id).toLowerCase(), u));
        const merged = Array.from(map.values());
        localStorage.setItem('sysacad_system_users_v2', JSON.stringify(merged));
        syncUsersToServer(merged);
        syncSystemStoreToServer({ systemUsers: merged });
        return merged;
      });

      if (payload.institutionName) {
        setInstitutionName(payload.institutionName);
        localStorage.setItem('sysacad_institution_name', payload.institutionName);
      }

      playSuccessSound();
      setIncomingSyncToast(`🎉 ¡Sincronización Exitosa! Se importaron ${incoming.length} cuentas de usuario desde la PC (Admin, Docentes y Control Escolar). Ya puedes iniciar sesión.`);
      setTimeout(() => setIncomingSyncToast(null), 9000);

      // Clean the URL so the hash doesn't stay visible in the address bar
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  // 2. Load and synchronize shared server store across all devices (PC, Laptop, Cellphone)
  useEffect(() => {
    let isMounted = true;

    const applyServerData = (data: any) => {
      if (!isMounted || !data) return;

      const { 
        systemUsers: serverUsers, 
        institutionName: serverName, 
        institutionLogo: serverLogo,
        alumnosList: serverAlumnos,
        materiasList: serverMaterias,
        calificacionesList: serverCalifs,
        avisosList: serverAvisos,
        ciclosList: serverCiclos,
        workspaceResult: serverWorkspace,
        folderLink: serverFolderLink,
        reportsFolderLink: serverReportsFolderLink,
        sheetLink: serverSheetLink,
        adminEmail: serverAdminEmail,
        customClientId: serverClientId
      } = data;

      if (Array.isArray(serverUsers)) {
        const normalizedServerUsers = serverUsers.map((u: SystemUser) => ((u.role as string) === 'Docente' ? { ...u, role: 'Maestros' as const } : u));
        const hasAdmin = normalizedServerUsers.some(u => (u.username || '').toLowerCase() === 'admin' || u.role === 'Administrador');
        const finalUsers = hasAdmin ? normalizedServerUsers : [{
          id: '1',
          username: 'admin',
          password: 'admin123',
          name: 'Administrador Principal',
          email: 'admin@sysacad.edu',
          role: 'Administrador' as const,
          status: 'Activo' as const,
          fechaRegistro: new Date().toISOString().split('T')[0],
          lastAccess: 'Reciente',
          mustChangePassword: false,
          firstLogin: false
        }, ...normalizedServerUsers];
        setSystemUsers(finalUsers);
        localStorage.setItem('sysacad_system_users_v2', JSON.stringify(finalUsers));
      }

      if (serverName) {
        setInstitutionName(serverName);
        localStorage.setItem('sysacad_institution_name', serverName);
      }

      if (serverLogo) {
        setInstitutionLogo(serverLogo);
        localStorage.setItem('sysacad_institution_logo', serverLogo);
      }

      const serverCentroEscolar = data.centroEscolar;
      if (serverCentroEscolar && typeof serverCentroEscolar === 'object' && serverCentroEscolar.nombre) {
        setCentroEscolar(prev => ({ ...prev, ...serverCentroEscolar }));
        localStorage.setItem('sysacad_centro_escolar', JSON.stringify(serverCentroEscolar));
      }

      if (serverWorkspace) {
        setWorkspaceResult(serverWorkspace);
        localStorage.setItem('sysacad_workspace_result', JSON.stringify(serverWorkspace));
      }

      if (serverFolderLink) {
        setFolderLink(serverFolderLink);
        localStorage.setItem('sysacad_folder_link', serverFolderLink);
      }

      if (serverReportsFolderLink) {
        setReportsFolderLink(serverReportsFolderLink);
        localStorage.setItem('sysacad_reports_folder_link', serverReportsFolderLink);
      }

      if (serverSheetLink) {
        setSheetLink(serverSheetLink);
        localStorage.setItem('sysacad_sheet_link', serverSheetLink);
      }

      if (serverAdminEmail) {
        setAdminEmail(serverAdminEmail);
        localStorage.setItem('sysacad_admin_email', serverAdminEmail);
      }

      if (Array.isArray(serverAlumnos) && serverAlumnos.length > 0) {
        setAlumnosList(prev => {
          const merged = mergeAlumnos(prev, serverAlumnos);
          localStorage.setItem('sysacad_alumnos_list', JSON.stringify(merged));
          return merged;
        });
      }
      if (Array.isArray(serverMaterias) && serverMaterias.length > 0) {
        setMateriasList(serverMaterias);
        localStorage.setItem('sysacad_materias_list', JSON.stringify(serverMaterias));
      }
      if (Array.isArray(serverCalifs) && serverCalifs.length > 0) {
        setCalificacionesList(serverCalifs);
        localStorage.setItem('sysacad_calificaciones_list', JSON.stringify(serverCalifs));
      }
      if (Array.isArray(serverAvisos) && serverAvisos.length > 0) {
        setAvisosList(serverAvisos);
        localStorage.setItem('sysacad_avisos_list', JSON.stringify(serverAvisos));
      }
      if (Array.isArray(serverCiclos) && serverCiclos.length > 0) {
        setCiclosList(serverCiclos);
        localStorage.setItem('sysacad_ciclos_list', JSON.stringify(serverCiclos));
      }

      if (serverClientId && serverClientId.trim()) {
        setCustomClientId(serverClientId.trim());
        setCustomClientIdInput(serverClientId.trim());
      }
    };

    // Initial load from Firebase Firestore
    loadFromFirebaseStore().then(data => {
      if (data) applyServerData(data);
    });

    // Real-time listener for Firebase Firestore changes across all connected devices (PC, Mobile)
    const unsubscribeFirebase = subscribeToFirebaseStore(data => {
      if (data) applyServerData(data);
    });

    const fetchSharedServerStore = async () => {
      try {
        const res = await fetchWithBridgeFallback('/api/system-store');
        if (!res.ok) return;
        const json = await res.json();
        if (!isMounted || !json.success || !json.data) return;
        applyServerData(json.data);
      } catch (err) {
        console.warn('Network sync with server store skipped/offline:', err);
      }
    };

    fetchSharedServerStore();
    const intervalId = setInterval(fetchSharedServerStore, 6000);
    const onWindowFocus = () => {
      fetchSharedServerStore();
    };
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchSharedServerStore();
    });

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', onWindowFocus);
      unsubscribeFirebase();
    };
  }, []);

  // Interfaces
  interface CalificacionItem {
    id: string;
    alumno: string;
    materia: string;
    parcial: string;
    calificacion: number;
    fecha: string;
    modificacionesCount?: number;
    solicitudPendiente?: {
      id: string;
      maestroNombre: string;
      calificacionAnterior: number;
      calificacionPropuesta: number;
      motivo: string;
      fechaSolicitud: string;
      estado: 'pendiente' | 'aprobada' | 'rechazada';
    };
  }

  interface SolicitudCambioCalif {
    id: string;
    calificacionId: string;
    alumno: string;
    materia: string;
    parcial: string;
    calificacionAnterior: number;
    calificacionPropuesta: number;
    motivo: string;
    fechaSolicitud: string;
    maestroNombre: string;
    maestroUsername?: string;
    estado: 'pendiente' | 'aprobada' | 'rechazada';
    respuestaFecha?: string;
    respuestaPor?: string;
  }

  interface AlumnoItem {
    id: string;
    matricula?: string;
    clave?: string;
    nombres: string;
    apellidos: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    genero?: string;
    fechaNacimiento?: string;
    lugarNacimiento?: string;
    nacionalidad?: string;
    curp?: string;
    calleNumero?: string;
    colonia?: string;
    codigoPostal?: string;
    entreCalles?: string;
    municipio?: string;
    estado?: string;
    nivel?: string;
    grado: string;
    grupo?: string;
    turno?: string;
    email: string;
    celular?: string;
    telefonoCasa?: string;
    nombrePadreTutor?: string;
    nombreMadre?: string;
    parentescoTutor?: string;
    ocupacionTutor?: string;
    telefonoEmergencia?: string;
    emailTutor?: string;
    escuelaProcedencia?: string;
    promedioAnterior?: string;
    razonSocial?: string;
    rfc?: string;
    regimenFiscal?: string;
    usoCfdi?: string;
    emailFacturacion?: string;
    cuotaInscripcion?: string;
    colegiaturaMensual?: string;
    porcentajeBeca?: string;
    diaLimitePago?: string;
    docActaNacimiento?: boolean;
    docCurp?: boolean;
    docCertificadoMedico?: boolean;
    docCartaConducta?: boolean;
    docComprobanteDomicilio?: boolean;
    docFotos?: boolean;
    docComprobantePago?: boolean;
    fotoUrl?: string;
    estatus?: string;
    fechaInscripcion: string;
  }

  interface MateriaItem {
    id: string;
    clave?: string;
    nombre: string;
    profesor: string;
    creditos: number;
    area?: string;
    grado?: string;
    estatus?: string;
  }

  interface CicloEscolarItem {
    id: string;
    clave: string;
    nombre: string;
    periodo: string;
    fechaInicio?: string;
    fechaFin?: string;
    estatus: 'Activo' | 'Próximo' | 'Concluido';
    folderId?: string;
    folderUrl?: string;
    spreadsheetId?: string;
    spreadsheetUrl?: string;
    subfolders?: { name: string; id: string; url: string }[];
    totalAlumnos?: number;
    observaciones?: string;
    fechaCreacion?: string;
  }

  interface AvisoItem {
    id: string;
    type: 'personal' | 'publico' | 'tarea';
    senderId: string;
    senderName: string;
    targetId?: string;
    targetName?: string;
    message: string;
    date?: string;
    timestamp: string;
  }

  // Initial Empty Datasets (Clean system)
  const initialDefaultAlumnos: AlumnoItem[] = [];
  const initialDefaultMaterias: MateriaItem[] = [];
  const initialDefaultCalificaciones: CalificacionItem[] = [];
  const initialDefaultAvisos: AvisoItem[] = [];

  // Calificaciones State
  const [calificacionesList, setCalificacionesList] = useState<CalificacionItem[]>(() => {
    const saved = localStorage.getItem('sysacad_calificaciones_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    localStorage.setItem('sysacad_calificaciones_list', JSON.stringify(initialDefaultCalificaciones));
    return initialDefaultCalificaciones;
  });
  // Solicitudes de Cambio de Calificación State
  const [solicitudesCambioList, setSolicitudesCambioList] = useState<SolicitudCambioCalif[]>(() => {
    const saved = localStorage.getItem('sysacad_solicitudes_cambio_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const updateSolicitudesCambio = (newList: SolicitudCambioCalif[]) => {
    setSolicitudesCambioList(newList);
    localStorage.setItem('sysacad_solicitudes_cambio_list', JSON.stringify(newList));
    syncSystemStoreToServer({ solicitudesCambioList: newList });
  };

  // State for Solicitud de Cambio Modal (Teacher side)
  const [isSolicitudModalOpen, setIsSolicitudModalOpen] = useState(false);
  const [solicitudCalifTarget, setSolicitudCalifTarget] = useState<CalificacionItem | null>(null);
  const [solicitudNuevaVal, setSolicitudNuevaVal] = useState('9.0');
  const [solicitudMotivo, setSolicitudMotivo] = useState('');

  const [califSearchQuery, setCalifSearchQuery] = useState('');
  const [isCalifModalOpen, setIsCalifModalOpen] = useState(false);
  const [califModalInitialTab, setCalifModalInitialTab] = useState<'manual' | 'rapida'>('manual');
  const [califModalInitialQuickMode, setCalifModalInitialQuickMode] = useState<'excel' | 'imagen'>('excel');
  const [editingCalif, setEditingCalif] = useState<CalificacionItem | null>(null);
  const [formCalifAlumno, setFormCalifAlumno] = useState('');
  const [formCalifMateria, setFormCalifMateria] = useState('');
  const [formCalifParcial, setFormCalifParcial] = useState('Primer Parcial');
  const [formCalifVal, setFormCalifVal] = useState('9.0');

  const updateCalificaciones = (newList: CalificacionItem[]) => {
    setCalificacionesList(newList);
    localStorage.setItem('sysacad_calificaciones_list', JSON.stringify(newList));
    syncSystemStoreToServer({ calificacionesList: newList });
  };

  const handleOpenCreateCalif = () => {
    setEditingCalif(null);
    setCalifModalInitialTab('manual');
    setCalifModalInitialQuickMode('excel');
    setFormCalifAlumno(alumnosList[0] ? `${alumnosList[0].nombres} ${alumnosList[0].apellidos}` : '');
    setFormCalifMateria(materiasList[0] ? materiasList[0].nombre : '');
    setFormCalifParcial('Primer Parcial');
    setFormCalifVal('9.0');
    setIsCalifModalOpen(true);
  };

  const handleOpenQuickCapture = (mode: 'excel' | 'imagen') => {
    setEditingCalif(null);
    setCalifModalInitialTab('rapida');
    setCalifModalInitialQuickMode(mode);
    setIsCalifModalOpen(true);
  };

  const handleOpenEditCalif = (item: CalificacionItem) => {
    // Rule: Maestros/Docentes get 1 direct edit after upload (modificacionesCount === 0 or undefined).
    // After 1 edit (modificacionesCount >= 1), pencil is locked and opens Solicitud de Cambio modal.
    const isTeacher = sessionUser?.role === 'Maestros' || sessionUser?.role === 'Docente';
    const editCount = item.modificacionesCount || 0;

    if (isTeacher && editCount >= 1) {
      playClickSound();
      setSolicitudCalifTarget(item);
      setSolicitudNuevaVal(item.calificacion.toString());
      setSolicitudMotivo('');
      setIsSolicitudModalOpen(true);
      return;
    }

    setEditingCalif(item);
    setCalifModalInitialTab('manual');
    setFormCalifAlumno(item.alumno);
    setFormCalifMateria(item.materia);
    setFormCalifParcial(item.parcial);
    setFormCalifVal(item.calificacion.toString());
    setIsCalifModalOpen(true);
  };

  const handleSendSolicitudCambio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitudCalifTarget) return;

    if (!solicitudMotivo.trim()) {
      playErrorSound();
      alert('Por favor exponga detalladamente el motivo del cambio de calificación.');
      return;
    }

    const nuevaVal = parseFloat(solicitudNuevaVal);
    if (isNaN(nuevaVal) || nuevaVal < 0 || nuevaVal > 10) {
      playErrorSound();
      alert('La calificación propuesta debe ser un número entre 0 y 10.');
      return;
    }

    const newSolicitud: SolicitudCambioCalif = {
      id: Date.now().toString(),
      calificacionId: solicitudCalifTarget.id,
      alumno: solicitudCalifTarget.alumno,
      materia: solicitudCalifTarget.materia,
      parcial: solicitudCalifTarget.parcial,
      calificacionAnterior: solicitudCalifTarget.calificacion,
      calificacionPropuesta: nuevaVal,
      motivo: solicitudMotivo.trim(),
      fechaSolicitud: new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
      maestroNombre: sessionUser?.nombreCompleto || sessionUser?.username || 'Maestro',
      maestroUsername: sessionUser?.username,
      estado: 'pendiente'
    };

    const updatedSolicitudes = [newSolicitud, ...solicitudesCambioList];
    updateSolicitudesCambio(updatedSolicitudes);

    // Attach pending request status to the grade item
    const updatedCalifs = calificacionesList.map(c => c.id === solicitudCalifTarget.id ? {
      ...c,
      solicitudPendiente: {
        id: newSolicitud.id,
        maestroNombre: newSolicitud.maestroNombre,
        calificacionAnterior: newSolicitud.calificacionAnterior,
        calificacionPropuesta: newSolicitud.calificacionPropuesta,
        motivo: newSolicitud.motivo,
        fechaSolicitud: newSolicitud.fechaSolicitud,
        estado: 'pendiente' as const
      }
    } : c);
    updateCalificaciones(updatedCalifs);

    // Create system notification for Control Escolar
    const newAviso: AvisoItem = {
      id: Date.now().toString(),
      type: 'publico',
      senderId: sessionUser?.username || 'maestro',
      senderName: sessionUser?.nombreCompleto || 'Maestro',
      targetName: 'Control Escolar',
      message: `📩 SOLICITUD DE CAMBIO DE CALIFICACIÓN: El profesor ${sessionUser?.nombreCompleto || 'Maestro'} solicita modificar la calificación del alumno "${solicitudCalifTarget.alumno}" (${solicitudCalifTarget.materia} - ${solicitudCalifTarget.parcial}) de ${solicitudCalifTarget.calificacion.toFixed(1)} a ${nuevaVal.toFixed(1)}. Motivo: ${solicitudMotivo.trim()}`,
      date: new Date().toLocaleDateString('es-MX'),
      timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    };
    updateAvisos([newAviso, ...avisosList]);

    playSuccessSound();
    setIsSolicitudModalOpen(false);
    setSolicitudCalifTarget(null);
    alert('¡Solicitud enviada a Control Escolar con éxito! Se ha notificado a Control Escolar para que apruebe o rechace el cambio.');
  };

  const handleAprobarSolicitud = (solicitudId: string) => {
    const sol = solicitudesCambioList.find(s => s.id === solicitudId);
    if (!sol) return;

    // 1. Update grade item in calificacionesList with the proposed new grade
    const updatedCalifs = calificacionesList.map(c => c.id === sol.calificacionId ? {
      ...c,
      calificacion: sol.calificacionPropuesta,
      modificacionesCount: (c.modificacionesCount || 0) + 1,
      solicitudPendiente: {
        id: sol.id,
        maestroNombre: sol.maestroNombre,
        calificacionAnterior: sol.calificacionAnterior,
        calificacionPropuesta: sol.calificacionPropuesta,
        motivo: sol.motivo,
        fechaSolicitud: sol.fechaSolicitud,
        estado: 'aprobada' as const
      }
    } : c);
    updateCalificaciones(updatedCalifs);

    // 2. Mark request as approved
    const updatedSolicitudes = solicitudesCambioList.map(s => s.id === solicitudId ? {
      ...s,
      estado: 'aprobada' as const,
      respuestaFecha: new Date().toLocaleString('es-MX'),
      respuestaPor: sessionUser?.nombreCompleto || sessionUser?.username || 'Control Escolar'
    } : s);
    updateSolicitudesCambio(updatedSolicitudes);

    // 3. Send notification to the teacher
    const newAviso: AvisoItem = {
      id: Date.now().toString(),
      type: 'personal',
      senderId: sessionUser?.username || 'control_escolar',
      senderName: sessionUser?.nombreCompleto || 'Control Escolar',
      targetId: sol.maestroUsername,
      targetName: sol.maestroNombre,
      message: `✅ Control Escolar APROBÓ tu solicitud de cambio de calificación para el alumno "${sol.alumno}" (${sol.materia} - ${sol.parcial}). La calificación ha sido actualizada a ${sol.calificacionPropuesta.toFixed(1)}.`,
      date: new Date().toLocaleDateString('es-MX'),
      timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    };
    updateAvisos([newAviso, ...avisosList]);

    playSuccessSound();
  };

  const handleRechazarSolicitud = (solicitudId: string) => {
    const sol = solicitudesCambioList.find(s => s.id === solicitudId);
    if (!sol) return;

    const motivoRechazo = prompt('Escribe el motivo del rechazo para informar al maestro (opcional):', 'Calificación registrada y validada previamente.');
    
    // 1. Mark request as rejected on grade item
    const updatedCalifs = calificacionesList.map(c => c.id === sol.calificacionId ? {
      ...c,
      solicitudPendiente: {
        id: sol.id,
        maestroNombre: sol.maestroNombre,
        calificacionAnterior: sol.calificacionAnterior,
        calificacionPropuesta: sol.calificacionPropuesta,
        motivo: sol.motivo,
        fechaSolicitud: sol.fechaSolicitud,
        estado: 'rechazada' as const
      }
    } : c);
    updateCalificaciones(updatedCalifs);

    // 2. Update status in solicitudesCambioList
    const updatedSolicitudes = solicitudesCambioList.map(s => s.id === solicitudId ? {
      ...s,
      estado: 'rechazada' as const,
      respuestaFecha: new Date().toLocaleString('es-MX'),
      respuestaPor: sessionUser?.nombreCompleto || sessionUser?.username || 'Control Escolar'
    } : s);
    updateSolicitudesCambio(updatedSolicitudes);

    // 3. Send notification to the teacher
    const newAviso: AvisoItem = {
      id: Date.now().toString(),
      type: 'personal',
      senderId: sessionUser?.username || 'control_escolar',
      senderName: sessionUser?.nombreCompleto || 'Control Escolar',
      targetId: sol.maestroUsername,
      targetName: sol.maestroNombre,
      message: `❌ Control Escolar RECHAZÓ tu solicitud de cambio de calificación para el alumno "${sol.alumno}" (${sol.materia} - ${sol.parcial}). Motivo: ${motivoRechazo || 'Sin especificación.'}`,
      date: new Date().toLocaleDateString('es-MX'),
      timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    };
    updateAvisos([newAviso, ...avisosList]);

    playSuccessSound();
  };

  const handleSaveManualCalif = (calif: {
    alumno: string;
    materia: string;
    parcial: string;
    calificacion: number;
  }) => {
    const trimmedAlumno = calif.alumno.trim();
    const trimmedMateria = calif.materia.trim();
    const trimmedParcial = calif.parcial.trim();
    if (!trimmedAlumno || !trimmedMateria) return;

    const duplicateCalif = calificacionesList.find(c => {
      if (editingCalif && c.id === editingCalif.id) return false;
      return c.alumno.trim().toLowerCase() === trimmedAlumno.toLowerCase() &&
             c.materia.trim().toLowerCase() === trimmedMateria.toLowerCase() &&
             c.parcial.trim().toLowerCase() === trimmedParcial.toLowerCase();
    });

    if (duplicateCalif) {
      playErrorSound();
      setDuplicateWarning({
        isOpen: true,
        title: '¡Calificación ya capturada!',
        message: '¡El registro ya existe, tienes la opción de mejor modificarlo!',
        detail: `Ya existe una calificación registrada para el alumno "${duplicateCalif.alumno}" en la materia "${duplicateCalif.materia}" para el período "${duplicateCalif.parcial}".`,
        existingRecordSummary: `Alumno: ${duplicateCalif.alumno} • Materia: ${duplicateCalif.materia} • ${duplicateCalif.parcial}: ${duplicateCalif.calificacion.toFixed(1)} (Fecha: ${duplicateCalif.fecha})`,
        onModify: () => {
          setDuplicateWarning(null);
          handleOpenEditCalif(duplicateCalif);
        }
      });
      return;
    }

    if (editingCalif) {
      const currentCount = editingCalif.modificacionesCount || 0;
      updateCalificaciones(calificacionesList.map(c => c.id === editingCalif.id ? {
        ...c,
        alumno: trimmedAlumno,
        materia: trimmedMateria,
        parcial: trimmedParcial,
        calificacion: calif.calificacion,
        modificacionesCount: currentCount + 1,
      } : c));
    } else {
      const newItem: CalificacionItem = {
        id: Date.now().toString(),
        alumno: trimmedAlumno,
        materia: trimmedMateria,
        parcial: trimmedParcial,
        calificacion: calif.calificacion,
        fecha: new Date().toISOString().split('T')[0],
        modificacionesCount: 0,
      };
      updateCalificaciones([newItem, ...calificacionesList]);
    }
    playSuccessSound();
    setIsCalifModalOpen(false);
  };

  const handleSaveBatchCalif = (batch: Omit<CalificacionItem, 'id' | 'fecha'>[]) => {
    const today = new Date().toISOString().split('T')[0];
    const newItems: CalificacionItem[] = batch.map((item, idx) => ({
      ...item,
      id: `${Date.now()}_${idx}`,
      fecha: today,
      modificacionesCount: 0,
    }));

    updateCalificaciones([...newItems, ...calificacionesList]);
    playSuccessSound();
  };

  const handleDeleteCalif = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este registro de calificación?')) {
      updateCalificaciones(calificacionesList.filter(c => c.id !== id));
    }
  };

  // Alumnos State
  const [alumnosList, setAlumnosList] = useState<AlumnoItem[]>(() => {
    const saved = localStorage.getItem('sysacad_alumnos_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    localStorage.setItem('sysacad_alumnos_list', JSON.stringify(initialDefaultAlumnos));
    return initialDefaultAlumnos;
  });

  const mergeAlumnos = (listA: AlumnoItem[], listB: AlumnoItem[]): AlumnoItem[] => {
    const map = new Map<string, AlumnoItem>();
    listA.forEach(a => {
      const key = a.id || a.matricula || `${a.nombres}-${a.apellidos}`.toLowerCase();
      map.set(key, a);
    });
    listB.forEach(a => {
      const key = a.id || a.matricula || `${a.nombres}-${a.apellidos}`.toLowerCase();
      if (!map.has(key)) {
        map.set(key, a);
      } else {
        const existing = map.get(key)!;
        map.set(key, { ...a, ...existing });
      }
    });
    return Array.from(map.values());
  };

  const updateAlumnos = (newList: AlumnoItem[]) => {
    setAlumnosList(newList);
    localStorage.setItem('sysacad_alumnos_list', JSON.stringify(newList));
    syncSystemStoreToServer({ alumnosList: newList });
  };

  const [selectedAlumnoName, setSelectedAlumnoName] = useState('');
  const [selectedKardexTab, setSelectedKardexTab] = useState<'parcial' | 'final' | null>(null);
  const [kardexGrado, setKardexGrado] = useState('');
  const [kardexGrupo, setKardexGrupo] = useState('');
  const [kardexMaestro, setKardexMaestro] = useState('');
  const [alumnoSearchQuery, setAlumnoSearchQuery] = useState('');
  const [isAlumnoModalOpen, setIsAlumnoModalOpen] = useState(false);
  const [editingAlumnoData, setEditingAlumnoData] = useState<StudentFormData | null>(null);

  const handleOpenCreateAlumno = () => {
    setEditingAlumnoData(null);
    setIsAlumnoModalOpen(true);
  };

  const handleOpenEditAlumno = (item: AlumnoItem) => {
    const formData: StudentFormData = {
      id: item.id,
      matricula: item.matricula || item.id,
      clave: item.clave || `ALU-${item.matricula || item.id}`,
      nombres: item.nombres,
      apellidoPaterno: item.apellidoPaterno || item.apellidos.split(' ')[0] || '',
      apellidoMaterno: item.apellidoMaterno || item.apellidos.split(' ').slice(1).join(' ') || '',
      genero: item.genero || 'Masculino',
      fechaNacimiento: item.fechaNacimiento || '2018-05-14',
      lugarNacimiento: item.lugarNacimiento || 'Morelia, Michoacán',
      nacionalidad: item.nacionalidad || 'Mexicana',
      curp: item.curp || '',
      calleNumero: item.calleNumero || '',
      colonia: item.colonia || '',
      codigoPostal: item.codigoPostal || '',
      entreCalles: item.entreCalles || '',
      municipio: item.municipio || 'Morelia',
      estado: item.estado || 'Michoacán',
      email: item.email,
      celular: item.celular || '',
      telefonoCasa: item.telefonoCasa || '',
      nombrePadreTutor: item.nombrePadreTutor || '',
      nombreMadre: item.nombreMadre || '',
      parentescoTutor: item.parentescoTutor || 'Padre',
      ocupacionTutor: item.ocupacionTutor || '',
      telefonoEmergencia: item.telefonoEmergencia || '',
      emailTutor: item.emailTutor || '',
      nivel: item.nivel || 'Primaria',
      grado: item.grado,
      grupo: item.grupo ? item.grupo.replace(/^grupo\s+/i, '') : 'A',
      turno: item.turno || 'Matutino',
      escuelaProcedencia: item.escuelaProcedencia || '',
      promedioAnterior: item.promedioAnterior || '9.0',
      razonSocial: item.razonSocial || '',
      rfc: item.rfc || '',
      regimenFiscal: item.regimenFiscal || '605 - Sueldos y Salarios',
      usoCfdi: item.usoCfdi || 'D10 - Pagos por servicios educativos (colegiaturas)',
      emailFacturacion: item.emailFacturacion || '',
      cuotaInscripcion: item.cuotaInscripcion || '3500',
      colegiaturaMensual: item.colegiaturaMensual || '4200',
      porcentajeBeca: item.porcentajeBeca || '0',
      diaLimitePago: item.diaLimitePago || '10',
      docActaNacimiento: item.docActaNacimiento ?? true,
      docCurp: item.docCurp ?? true,
      docCertificadoMedico: item.docCertificadoMedico ?? false,
      docCartaConducta: item.docCartaConducta ?? false,
      docComprobanteDomicilio: item.docComprobanteDomicilio ?? true,
      docFotos: item.docFotos ?? false,
      docComprobantePago: item.docComprobantePago ?? true,
      fotoUrl: item.fotoUrl || '',
      estatus: item.estatus || 'Activo',
      fechaInscripcion: item.fechaInscripcion || new Date().toISOString().split('T')[0]
    };
    setEditingAlumnoData(formData);
    setIsAlumnoModalOpen(true);
  };

  const handleSaveStudent = (data: StudentFormData): boolean => {
    const fullApellidos = `${data.apellidoPaterno.trim()} ${data.apellidoMaterno.trim()}`.trim();
    const normalizedNewName = data.nombres.trim().toLowerCase();
    const normalizedNewApellidos = fullApellidos.toLowerCase();
    const normalizedCurp = data.curp ? data.curp.trim().toUpperCase() : '';
    const normalizedMatricula = data.matricula ? data.matricula.trim().toUpperCase() : '';

    const duplicateAlumno = alumnosList.find(a => {
      if (data.id && a.id === data.id) return false;
      
      // Match CURP if provided and valid length
      if (normalizedCurp && normalizedCurp.length >= 4 && a.curp && a.curp.trim().toUpperCase() === normalizedCurp) {
        return true;
      }
      // Match Matricula if provided
      if (normalizedMatricula && a.matricula && a.matricula.trim().toUpperCase() === normalizedMatricula) {
        return true;
      }
      // Match exact full name
      const existingFullName = `${a.nombres.trim()} ${a.apellidos.trim()}`.toLowerCase();
      const candidateFullName = `${normalizedNewName} ${normalizedNewApellidos}`;
      if (existingFullName === candidateFullName && candidateFullName.length > 2) {
        return true;
      }
      return false;
    });

    if (duplicateAlumno) {
      playErrorSound();
      setDuplicateWarning({
        isOpen: true,
        title: '¡El Alumno ya se encuentra registrado!',
        message: '¡El registro ya existe, tienes la opción de mejor modificarlo!',
        detail: `Ya existe un expediente registrado con los mismos datos en el sistema escolar.`,
        existingRecordSummary: `${duplicateAlumno.nombres} ${duplicateAlumno.apellidos} • ${duplicateAlumno.grado} • Matrícula: ${duplicateAlumno.matricula || duplicateAlumno.id}${duplicateAlumno.curp ? ` • CURP: ${duplicateAlumno.curp}` : ''}`,
        onModify: () => {
          setDuplicateWarning(null);
          setIsAlumnoModalOpen(false);
          setTimeout(() => {
            handleOpenEditAlumno(duplicateAlumno);
          }, 100);
        }
      });
      return false;
    }
    
    if (data.id) {
      updateAlumnos(alumnosList.map(a => a.id === data.id ? {
        ...a,
        ...data,
        id: data.id!,
        nombres: data.nombres,
        apellidos: fullApellidos || a.apellidos,
        grado: data.grado,
        email: data.email || `${data.nombres.toLowerCase().replace(/\s+/g, '.')}.${data.apellidoPaterno.toLowerCase()}@sysacad.edu.mx`,
        fechaInscripcion: data.fechaInscripcion || a.fechaInscripcion
      } : a));
    } else {
      const newId = Date.now().toString();
      const newStudent: AlumnoItem = {
        ...data,
        id: newId,
        matricula: data.matricula || String(Math.floor(100 + Math.random() * 900)),
        clave: data.clave || `ALU-${data.matricula || newId.slice(-3)}`,
        nombres: data.nombres,
        apellidos: fullApellidos,
        grado: data.grado,
        email: data.email || `${data.nombres.toLowerCase().replace(/\s+/g, '.')}.${data.apellidoPaterno.toLowerCase()}@sysacad.edu.mx`,
        fechaInscripcion: data.fechaInscripcion || new Date().toISOString().split('T')[0],
        estatus: 'Activo'
      };
      updateAlumnos([newStudent, ...alumnosList]);
    }
    return true;
  };

  const handleDeleteAlumno = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este alumno del sistema y de la hoja de Google Sheets?')) {
      updateAlumnos(alumnosList.filter(a => a.id !== id));
    }
  };

  const exportAlumnosToCSV = () => {
    const headers = ['ID', 'Nombres', 'Apellidos', 'Grado', 'Correo Institucional', 'Fecha Inscripción'];
    const csvRows = [headers.join(',')];
    
    alumnosList.forEach(alumno => {
      const row = [
        `"${alumno.id}"`,
        `"${alumno.nombres.replace(/"/g, '""')}"`,
        `"${alumno.apellidos.replace(/"/g, '""')}"`,
        `"${alumno.grado.replace(/"/g, '""')}"`,
        `"${alumno.email.replace(/"/g, '""')}"`,
        `"${alumno.fechaInscripcion.replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `alumnos_matricula_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Materias State
  const [materiasList, setMateriasList] = useState<MateriaItem[]>(() => {
    const saved = localStorage.getItem('sysacad_materias_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    localStorage.setItem('sysacad_materias_list', JSON.stringify(initialDefaultMaterias));
    return initialDefaultMaterias;
  });

  const updateMaterias = (newList: MateriaItem[]) => {
    setMateriasList(newList);
    localStorage.setItem('sysacad_materias_list', JSON.stringify(newList));
    syncSystemStoreToServer({ materiasList: newList });
  };
  
  // Avisos State
  const [avisosList, setAvisosList] = useState<AvisoItem[]>(() => {
    const saved = localStorage.getItem('sysacad_avisos_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    localStorage.setItem('sysacad_avisos_list', JSON.stringify(initialDefaultAvisos));
    return initialDefaultAvisos;
  });

  const updateAvisos = (newList: AvisoItem[]) => {
    setAvisosList(newList);
    localStorage.setItem('sysacad_avisos_list', JSON.stringify(newList));
    syncSystemStoreToServer({ avisosList: newList });
  };

  const [isAvisoModalOpen, setIsAvisoModalOpen] = useState(false);
  const [editingAviso, setEditingAviso] = useState<AvisoItem | null>(null);
  const [avisoFormType, setAvisoFormType] = useState<'personal' | 'publico' | 'tarea'>('personal');
  const [avisoFormTarget, setAvisoFormTarget] = useState('');
  const [avisoFormMessage, setAvisoFormMessage] = useState('');
  const [avisoFormDate, setAvisoFormDate] = useState('');

  const handleOpenCreateAviso = (type: 'personal' | 'publico' | 'tarea') => {
    setEditingAviso(null);
    setAvisoFormType(type);
    setAvisoFormTarget('');
    setAvisoFormMessage('');
    setAvisoFormDate('');
    setIsAvisoModalOpen(true);
  };

  const handleOpenEditAviso = (aviso: AvisoItem) => {
    setEditingAviso(aviso);
    setAvisoFormType(aviso.type);
    setAvisoFormTarget(aviso.targetId || '');
    setAvisoFormMessage(aviso.message);
    setAvisoFormDate(aviso.date || '');
    setIsAvisoModalOpen(true);
  };

  const handleDeleteAviso = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este aviso/tarea?')) {
      updateAvisos(avisosList.filter(a => a.id !== id));
    }
  };

  const handleSaveAviso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!avisoFormMessage.trim()) return;

    const duplicateAviso = avisosList.find(a => {
      if (editingAviso && a.id === editingAviso.id) return false;
      return a.type === avisoFormType &&
             a.message.trim().toLowerCase() === avisoFormMessage.trim().toLowerCase() &&
             (a.targetId || '') === (avisoFormTarget || '');
    });

    if (duplicateAviso) {
      playErrorSound();
      setDuplicateWarning({
        isOpen: true,
        title: '¡El Aviso o Tarea ya existe!',
        message: '¡El registro ya existe, tienes la opción de mejor modificarlo!',
        detail: `Ya se encuentra publicado un aviso con el mismo contenido y destinatario.`,
        existingRecordSummary: `${duplicateAviso.type.toUpperCase()}: ${duplicateAviso.message.slice(0, 60)}... (${duplicateAviso.timestamp})`,
        onModify: () => {
          setDuplicateWarning(null);
          handleOpenEditAviso(duplicateAviso);
        }
      });
      return;
    }
    
    if (editingAviso) {
      updateAvisos(avisosList.map(a => a.id === editingAviso.id ? {
        ...a,
        type: avisoFormType,
        targetId: avisoFormTarget || undefined,
        targetName: avisoFormTarget ? systemUsers.find(u => u.id === avisoFormTarget)?.name : undefined,
        message: avisoFormMessage,
        date: avisoFormType === 'tarea' ? avisoFormDate : undefined,
      } : a));
    } else {
      const newAviso: AvisoItem = {
        id: Date.now().toString(),
        type: avisoFormType,
        senderId: sessionUser?.id || '',
        senderName: sessionUser?.name || 'Sistema',
        targetId: avisoFormTarget || undefined,
        targetName: avisoFormTarget ? systemUsers.find(u => u.id === avisoFormTarget)?.name : undefined,
        message: avisoFormMessage,
        date: avisoFormType === 'tarea' ? avisoFormDate : undefined,
        timestamp: new Date().toLocaleString()
      };
      updateAvisos([newAviso, ...avisosList]);
    }
    
    setIsAvisoModalOpen(false);
  };

  const [materiaSearchQuery, setMateriaSearchQuery] = useState('');
  const [isMateriaModalOpen, setIsMateriaModalOpen] = useState(false);
  const [editingMateria, setEditingMateria] = useState<MateriaItem | null>(null);
  const [formIdMateria, setFormIdMateria] = useState('');
  const [formClaveMateria, setFormClaveMateria] = useState('');
  const [formNombreMateria, setFormNombreMateria] = useState('');
  const [formProfesor, setFormProfesor] = useState('');
  const [formCreditos, setFormCreditos] = useState('6');
  const [formAreaMateria, setFormAreaMateria] = useState('Ciencias Exactas');
  const [formGradoMateria, setFormGradoMateria] = useState('Todos');

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

  const handleOpenCreateMateria = () => {
    setEditingMateria(null);
    const generatedClave = `MAT-${Math.floor(100 + Math.random() * 900)}`;
    setFormIdMateria(generatedClave);
    setFormClaveMateria(generatedClave);
    setFormNombreMateria('');
    setFormProfesor('');
    setFormCreditos('6');
    setFormAreaMateria('Ciencias Exactas');
    setFormGradoMateria('Todos');
    setIsMateriaModalOpen(true);
  };

  const handleOpenEditMateria = (item: MateriaItem) => {
    setEditingMateria(item);
    setFormIdMateria(item.id);
    setFormClaveMateria(item.clave || `MAT-${item.id.slice(-3)}`);
    setFormNombreMateria(item.nombre);
    setFormProfesor(item.profesor);
    setFormCreditos(item.creditos.toString());
    setFormAreaMateria(item.area || 'Ciencias Exactas');
    setFormGradoMateria(item.grado || 'Todos');
    setIsMateriaModalOpen(true);
  };

  const handleSaveMateria = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMateriaName = formNombreMateria.trim();
    if (!trimmedMateriaName) return;

    const duplicateMateria = materiasList.find(m => {
      if (editingMateria && m.id === editingMateria.id) return false;
      return m.nombre.trim().toLowerCase() === trimmedMateriaName.toLowerCase();
    });

    if (duplicateMateria) {
      playErrorSound();
      setDuplicateWarning({
        isOpen: true,
        title: '¡La Materia ya se encuentra registrada!',
        message: '¡El registro ya existe, tienes la opción de mejor modificarlo!',
        detail: `La materia "${duplicateMateria.nombre}" ya existe en el plan de estudios académico.`,
        existingRecordSummary: `${duplicateMateria.nombre} • Profesor: ${duplicateMateria.profesor || 'No asignado'} • ${duplicateMateria.creditos} Créditos`,
        onModify: () => {
          setDuplicateWarning(null);
          handleOpenEditMateria(duplicateMateria);
        }
      });
      return;
    }

    const credNum = parseInt(formCreditos, 10) || 6;
    const finalMateriaId = formIdMateria.trim() || (editingMateria ? editingMateria.id : Date.now().toString());

    if (editingMateria) {
      updateMaterias(materiasList.map(m => m.id === editingMateria.id ? {
        ...m,
        id: finalMateriaId,
        clave: formClaveMateria || m.clave || `MAT-${finalMateriaId.slice(-3)}`,
        nombre: formNombreMateria,
        profesor: formProfesor,
        creditos: credNum,
        area: formAreaMateria,
        grado: formGradoMateria,
        estatus: 'Activa'
      } : m));
    } else {
      const newItem: MateriaItem = {
        id: finalMateriaId,
        clave: formClaveMateria || `MAT-${Math.floor(100 + Math.random() * 900)}`,
        nombre: formNombreMateria,
        profesor: formProfesor,
        creditos: credNum,
        area: formAreaMateria,
        grado: formGradoMateria,
        estatus: 'Activa'
      };
      updateMaterias([newItem, ...materiasList]);
    }
    setIsMateriaModalOpen(false);
  };

  const handleDeleteMateria = (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta materia del plan y de la hoja de Google Sheets?')) {
      updateMaterias(materiasList.filter(m => m.id !== id));
    }
  };

  const exportMateriasToCSV = () => {
    const headers = ['Clave / ID', 'Nombre de Materia', 'Grado Escolar', 'Profesor Asignado', 'Créditos Académicos', 'Área / Nivel', 'Estatus'];
    const csvRows = [headers.join(',')];
    
    materiasList.forEach(materia => {
      const row = [
        `"${materia.clave || `MAT-${materia.id.slice(-4)}`}"`,
        `"${materia.nombre.replace(/"/g, '""')}"`,
        `"${(materia.grado || 'Todos los grados').replace(/"/g, '""')}"`,
        `"${(materia.profesor || 'Sin asignar').replace(/"/g, '""')}"`,
        `"${materia.creditos}"`,
        `"${(materia.area || 'Tronco Común').replace(/"/g, '""')}"`,
        `"${materia.estatus || 'Activa'}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `materias_plan_estudios_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Maestros Submenu State & Handlers
  const [maestroSearchQuery, setMaestroSearchQuery] = useState('');
  const [isMaestroModalOpen, setIsMaestroModalOpen] = useState(false);
  const [editingMaestro, setEditingMaestro] = useState<SystemUser | null>(null);
  const [formMaestroId, setFormMaestroId] = useState('');
  const [formMaestroName, setFormMaestroName] = useState('');
  const [formMaestroLogin, setFormMaestroLogin] = useState('');
  const [formMaestroPassword, setFormMaestroPassword] = useState('');
  const [formMaestroEmail, setFormMaestroEmail] = useState('');
  const [formMaestroRole, setFormMaestroRole] = useState<'Maestros' | 'Directivo'>('Maestros');
  const [formMaestroStatus, setFormMaestroStatus] = useState<'Activo' | 'Inactivo'>('Activo');

  const handleOpenCreateMaestro = () => {
    setEditingMaestro(null);
    setFormMaestroId(`MAE-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormMaestroName('');
    setFormMaestroLogin('');
    setFormMaestroPassword('');
    setFormMaestroEmail('');
    setFormMaestroRole('Maestros');
    setFormMaestroStatus('Activo');
    setIsMaestroModalOpen(true);
  };

  const handleOpenEditMaestro = (teacher: SystemUser) => {
    setEditingMaestro(teacher);
    setFormMaestroId(teacher.id);
    setFormMaestroName(teacher.name);
    setFormMaestroLogin(teacher.username || '');
    setFormMaestroPassword(teacher.password || '');
    setFormMaestroEmail(teacher.email);
    setFormMaestroRole((teacher.role === 'Maestros' || teacher.role === 'Directivo' ? teacher.role : 'Maestros') as any);
    setFormMaestroStatus(teacher.status);
    setIsMaestroModalOpen(true);
  };

  const handleSaveMaestro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMaestroName.trim()) return;

    const finalLogin = formMaestroLogin.trim() || formMaestroName.toLowerCase().replace(/\s+/g, '_');
    const finalPassword = formMaestroPassword.trim() || '123456';
    const trimmedEmail = formMaestroEmail.trim().toLowerCase();

    const duplicateTeacher = systemUsers.find(u => {
      if (editingMaestro && u.id === editingMaestro.id) return false;
      const matchLogin = u.username.trim().toLowerCase() === finalLogin.toLowerCase();
      const matchEmail = trimmedEmail && u.email && u.email.trim().toLowerCase() === trimmedEmail;
      const matchName = u.name.trim().toLowerCase() === formMaestroName.trim().toLowerCase();
      return matchLogin || matchEmail || matchName;
    });

    if (duplicateTeacher) {
      playErrorSound();
      setDuplicateWarning({
        isOpen: true,
        title: '¡El Maestro / Docente ya existe en el sistema!',
        message: '¡El registro ya existe, tienes la opción de mejor modificarlo!',
        detail: `Ya existe un maestro o usuario con el mismo nombre ("${duplicateTeacher.name}"), usuario ("${duplicateTeacher.username}") o correo ("${duplicateTeacher.email}").`,
        existingRecordSummary: `Docente: ${duplicateTeacher.name} • Rol: ${duplicateTeacher.role} • Correo: ${duplicateTeacher.email}`,
        onModify: () => {
          setDuplicateWarning(null);
          setIsMaestroModalOpen(false);
          setTimeout(() => {
            handleOpenEditMaestro(duplicateTeacher);
          }, 100);
        }
      });
      return;
    }

    const finalMaestroId = formMaestroId.trim() || (editingMaestro ? editingMaestro.id : Date.now().toString());

    let updatedList: SystemUser[];
    if (editingMaestro) {
      updatedList = systemUsers.map(u => u.id === editingMaestro.id ? {
        ...u,
        id: finalMaestroId,
        name: formMaestroName.trim(),
        username: finalLogin,
        password: finalPassword,
        email: formMaestroEmail.trim(),
        role: formMaestroRole,
        status: formMaestroStatus
      } : u);
    } else {
      const newTeacher: SystemUser = {
        id: finalMaestroId,
        name: formMaestroName.trim(),
        username: finalLogin,
        password: finalPassword,
        email: formMaestroEmail.trim(),
        role: formMaestroRole,
        status: formMaestroStatus,
        fechaRegistro: new Date().toISOString().split('T')[0],
        lastAccess: 'Nunca',
        mustChangePassword: true,
        firstLogin: true
      };
      updatedList = [newTeacher, ...systemUsers];
    }

    setSystemUsers(updatedList);
    localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updatedList));
    syncUsersToServer(updatedList);
    syncSystemStoreToServer({ systemUsers: updatedList });
    setIsMaestroModalOpen(false);

    let activeToken = token || localStorage.getItem('sysacad_google_access_token');
    let activeSheetId = workspaceResult?.spreadsheetId;
    if (!activeSheetId) {
      const savedRaw = localStorage.getItem('sysacad_workspace_result');
      if (savedRaw) {
        try { activeSheetId = JSON.parse(savedRaw)?.spreadsheetId; } catch(e) {}
      }
    }

    if (activeToken && activeSheetId) {
      try {
        await syncUsersToSheet(activeToken, activeSheetId, updatedList);
        playSuccessSound();
        alert('✅ Maestro registrado exitosamente y sincronizado en Google Sheets.');
      } catch (err: any) {
        console.warn('Could not auto-sync teachers to sheet:', err);
        alert('⚠️ Maestro guardado en el dispositivo, pero hubo un detalle con Google Sheets: ' + (err.message || 'Error de sincronización'));
      }
    } else {
      playSuccessSound();
      alert('✅ Maestro registrado y sincronizado en el puente central.\n\nYa puede iniciar sesión tanto desde la PC como desde el celular.');
    }
  };

  const handleDeleteMaestro = (id: string) => {
    if (confirm('¿Está seguro de eliminar este maestro de la plantilla docente?')) {
      const updated = systemUsers.filter(u => u.id !== id);
      setSystemUsers(updated);
      localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updated));
      syncUsersToServer(updated);
      syncSystemStoreToServer({ systemUsers: updated });
      let activeToken = token || localStorage.getItem('sysacad_google_access_token');
      let activeSheetId = workspaceResult?.spreadsheetId;
      if (!activeSheetId) {
        const savedRaw = localStorage.getItem('sysacad_workspace_result');
        if (savedRaw) {
          try { activeSheetId = JSON.parse(savedRaw)?.spreadsheetId; } catch(e) {}
        }
      }
      if (activeToken && activeSheetId) {
        syncUsersToSheet(activeToken, activeSheetId, updated).catch(console.error);
      }
    }
  };

  const exportMaestrosToCSV = () => {
    const teachers = systemUsers.filter(u => u.role === 'Maestros' || u.role === 'Docente' || u.role === 'Directivo');
    const headers = ['ID / Clave', 'Nombre Completo', 'Usuario de Acceso', 'Rol / Categoría', 'Correo Institucional', 'Estatus', 'Último Acceso'];
    const csvRows = [headers.join(',')];
    
    teachers.forEach(teacher => {
      const row = [
        `"DOC-${teacher.id.slice(-4)}"`,
        `"${teacher.name.replace(/"/g, '""')}"`,
        `"${(teacher.username || '').replace(/"/g, '""')}"`,
        `"${teacher.role.replace(/"/g, '""')}"`,
        `"${teacher.email.replace(/"/g, '""')}"`,
        `"${teacher.status}"`,
        `"${teacher.lastAccess || 'Reciente'}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plantilla_maestros_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ciclos Escolares State & Handlers
  const [ciclosList, setCiclosList] = useState<CicloEscolarItem[]>(() => {
    const saved = localStorage.getItem('sysacad_ciclos_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const defaultCycles: CicloEscolarItem[] = [
      {
        id: 'c-2026-2027',
        clave: 'CICLO-2026-2027',
        nombre: 'CICLO ESCOLAR 2026 - 2027',
        periodo: 'Agosto 2026 - Julio 2027',
        fechaInicio: '2026-08-15',
        fechaFin: '2027-07-15',
        estatus: 'Activo',
        observaciones: 'Ciclo escolar principal en curso',
        fechaCreacion: new Date().toISOString().split('T')[0]
      }
    ];
    localStorage.setItem('sysacad_ciclos_list', JSON.stringify(defaultCycles));
    return defaultCycles;
  });

  const updateCiclos = (newList: CicloEscolarItem[]) => {
    setCiclosList(newList);
    localStorage.setItem('sysacad_ciclos_list', JSON.stringify(newList));
    syncSystemStoreToServer({ ciclosList: newList });
  };

  const [cicloSearchQuery, setCicloSearchQuery] = useState('');
  const [isCicloModalOpen, setIsCicloModalOpen] = useState(false);
  const [editingCiclo, setEditingCiclo] = useState<CicloEscolarItem | null>(null);
  const [formCicloClave, setFormCicloClave] = useState('');
  const [formCicloNombre, setFormCicloNombre] = useState('');
  const [formCicloPeriodo, setFormCicloPeriodo] = useState('');
  const [formCicloFechaInicio, setFormCicloFechaInicio] = useState('');
  const [formCicloFechaFin, setFormCicloFechaFin] = useState('');
  const [formCicloEstatus, setFormCicloEstatus] = useState<'Activo' | 'Próximo' | 'Concluido'>('Activo');
  const [formCicloObservaciones, setFormCicloObservaciones] = useState('');
  const [syncingCycleId, setSyncingCycleId] = useState<string | null>(null);

  // State & Handlers for Informe General de Actividades modal
  const [isInformeGeneralModalOpen, setIsInformeGeneralModalOpen] = useState(false);
  const [informeTab, setInformeTab] = useState<'ciclo' | 'docentes' | 'alumnos'>('ciclo');
  const [informeSearchQuery, setInformeSearchQuery] = useState('');

  // State for Boletin General Modal (3 options: Lista de alumnos, Kardex de calificaciones, Lista de asistencia)
  const [isBoletinGeneralModalOpen, setIsBoletinGeneralModalOpen] = useState(false);

  // State for Direct Table Print Modal (Alumnos, Maestros, Materias)
  const [isDirectTablePrintModalOpen, setIsDirectTablePrintModalOpen] = useState(false);
  const [directTablePrintType, setDirectTablePrintType] = useState<TablePrintType>('alumnos');

  const exportInformeGeneralToCSV = () => {
    let csvContent = '\uFEFF';
    const sanitize = (text: any) => `"${String(text || '').replace(/"/g, '""')}"`;

    if (informeTab === 'ciclo') {
      const headers = ['Clave', 'Ciclo Escolar', 'Periodo Académico', 'Fecha Inicio', 'Fecha Fin', 'Estatus', 'Total Alumnos', 'Observaciones'];
      csvContent += headers.join(',') + '\n';
      ciclosList.forEach(c => {
        csvContent += [
          sanitize(c.clave),
          sanitize(c.nombre),
          sanitize(c.periodo),
          sanitize(c.fechaInicio),
          sanitize(c.fechaFin),
          sanitize(c.estatus),
          sanitize(alumnosList.length),
          sanitize(c.observaciones)
        ].join(',') + '\n';
      });
    } else if (informeTab === 'docentes') {
      const teachers = systemUsers.filter(u => u.role === 'Maestros' || u.role === 'Docente' || u.role === 'Directivo');
      const headers = ['ID / Cédula', 'Nombre Completo', 'Usuario', 'Correo Institucional', 'Rol / Categoría', 'Estatus', 'Materias Asignadas'];
      csvContent += headers.join(',') + '\n';
      teachers.forEach(t => {
        const assigned = materiasList.filter(m => m.profesor?.toLowerCase().includes(t.name.toLowerCase())).map(m => m.nombre).join('; ');
        csvContent += [
          sanitize(`DOC-${t.id.slice(-4)}`),
          sanitize(t.name),
          sanitize(t.username),
          sanitize(t.email),
          sanitize(t.role),
          sanitize(t.status),
          sanitize(assigned || 'Sin asignación')
        ].join(',') + '\n';
      });
    } else {
      const headers = ['Matrícula', 'Nombre Completo', 'CURP', 'Nivel', 'Grado', 'Grupo', 'Turno', 'Email', 'Promedio General', 'Estatus'];
      csvContent += headers.join(',') + '\n';
      alumnosList.forEach(a => {
        csvContent += [
          sanitize(a.matricula || a.id),
          sanitize(`${a.nombres} ${a.apellidos}`),
          sanitize(a.curp),
          sanitize(a.nivel || 'Primaria'),
          sanitize(a.grado),
          sanitize(a.grupo || 'A'),
          sanitize(a.turno || 'Matutino'),
          sanitize(a.email),
          sanitize(a.promedio || '9.2'),
          sanitize(a.estatus || 'Activo')
        ].join(',') + '\n';
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `informe_general_${informeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccessSound();
  };

  const handleOpenCreateCiclo = () => {
    setEditingCiclo(null);
    const nextYearStart = 2026 + ciclosList.length;
    const nextYearEnd = nextYearStart + 1;
    setFormCicloClave(`CICLO-${nextYearStart}-${nextYearEnd}`);
    setFormCicloNombre(`CICLO ESCOLAR ${nextYearStart} - ${nextYearEnd}`);
    setFormCicloPeriodo(`Agosto ${nextYearStart} - Julio ${nextYearEnd}`);
    setFormCicloFechaInicio(`${nextYearStart}-08-15`);
    setFormCicloFechaFin(`${nextYearEnd}-07-15`);
    setFormCicloEstatus(ciclosList.length === 0 ? 'Activo' : 'Próximo');
    setFormCicloObservaciones('');
    setIsCicloModalOpen(true);
  };

  const handleOpenEditCiclo = (item: CicloEscolarItem) => {
    setEditingCiclo(item);
    setFormCicloClave(item.clave);
    setFormCicloNombre(item.nombre);
    setFormCicloPeriodo(item.periodo);
    setFormCicloFechaInicio(item.fechaInicio || '');
    setFormCicloFechaFin(item.fechaFin || '');
    setFormCicloEstatus(item.estatus);
    setFormCicloObservaciones(item.observaciones || '');
    setIsCicloModalOpen(true);
  };

  const handleSyncCycleToDrive = async (item: CicloEscolarItem) => {
    if (!token) {
      alert('Para crear y sincronizar la carpeta y hojas en Google Drive, primero inicia sesión y vincula Google Workspace en el menú de Administrador.');
      return;
    }
    setSyncingCycleId(item.id);
    try {
      const appData = {
        activeCycleName: item.nombre,
        studentsList: alumnosList,
        teachersList: systemUsers.filter(u => u.role === 'Docente' || u.role === 'Maestros' || u.role === 'Directivo'),
        materiasList: materiasList,
        ciclosList: ciclosList,
        calificacionesList: calificacionesList,
        controlRecords: [
          { id: '1', cicloEscolar: item.nombre, periodo: item.periodo, turno: 'Matutino', inscritos: alumnosList.length, estatus: item.estatus }
        ],
        kardexList: alumnosList.map(a => ({
          id: a.id,
          alumno: `${a.nombres} ${a.apellidos}`,
          promedio: a.promedio || 9.2,
          cursadas: materiasList.length,
          creditos: materiasList.reduce((acc, m) => acc + (m.creditos || 6), 0),
          estatus: 'Regular'
        })),
        systemUsers: systemUsers,
        avisosList: avisosList
      };

      const result = await setupSpecificCycleInDrive(token, item.nombre, workspaceResult?.rootFolderId, appData);
      
      const updated = ciclosList.map(c => {
        if (c.id === item.id) {
          return {
            ...c,
            folderId: result.cycleFolderId,
            folderUrl: result.cycleFolderUrl,
            spreadsheetId: result.spreadsheetId,
            spreadsheetUrl: result.spreadsheetUrl,
            subfolders: result.subfolders
          };
        }
        return c;
      });

      updateCiclos(updated);
      if (item.estatus === 'Activo') {
        localStorage.setItem('sysacad_cycle_folder_link', result.cycleFolderUrl);
      }
      playSuccessSound();
    } catch (err: any) {
      console.error('Error al sincronizar ciclo en Drive:', err);
      playErrorSound();
      alert('Ocurrió un detalle al sincronizar la carpeta en Drive: ' + (err.message || err));
    } finally {
      setSyncingCycleId(null);
    }
  };

  const handleSaveCiclo = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNombre = formCicloNombre.trim().toUpperCase();
    const trimmedClave = formCicloClave.trim().toUpperCase();
    if (!trimmedNombre) return;

    const duplicateCiclo = ciclosList.find(c => {
      if (editingCiclo && c.id === editingCiclo.id) return false;
      return c.nombre.trim().toUpperCase() === trimmedNombre || 
             (trimmedClave && c.clave && c.clave.trim().toUpperCase() === trimmedClave);
    });

    if (duplicateCiclo) {
      playErrorSound();
      setDuplicateWarning({
        isOpen: true,
        title: '¡El Ciclo Escolar ya se encuentra registrado!',
        message: '¡El registro ya existe, tienes la opción de mejor modificarlo!',
        detail: `Ya existe un ciclo escolar registrado con el nombre "${duplicateCiclo.nombre}".`,
        existingRecordSummary: `${duplicateCiclo.nombre} • ${duplicateCiclo.periodo} • Estatus: ${duplicateCiclo.estatus}`,
        onModify: () => {
          setDuplicateWarning(null);
          handleOpenEditCiclo(duplicateCiclo);
        }
      });
      return;
    }

    let updatedList: CicloEscolarItem[];
    if (editingCiclo) {
      updatedList = ciclosList.map(c => {
        if (c.id === editingCiclo.id) {
          return {
            ...c,
            clave: trimmedClave || c.clave,
            nombre: trimmedNombre,
            periodo: formCicloPeriodo.trim() || c.periodo,
            fechaInicio: formCicloFechaInicio,
            fechaFin: formCicloFechaFin,
            estatus: formCicloEstatus,
            observaciones: formCicloObservaciones.trim()
          };
        }
        if (formCicloEstatus === 'Activo' && c.estatus === 'Activo') {
          return { ...c, estatus: 'Concluido' as const };
        }
        return c;
      });
    } else {
      const existingAdjusted = formCicloEstatus === 'Activo'
        ? ciclosList.map(c => c.estatus === 'Activo' ? { ...c, estatus: 'Concluido' as const } : c)
        : ciclosList;

      const newCiclo: CicloEscolarItem = {
        id: `c-${Date.now()}`,
        clave: trimmedClave || `CICLO-${Date.now().toString().slice(-4)}`,
        nombre: trimmedNombre,
        periodo: formCicloPeriodo.trim() || 'Periodo Anual',
        fechaInicio: formCicloFechaInicio,
        fechaFin: formCicloFechaFin,
        estatus: formCicloEstatus,
        observaciones: formCicloObservaciones.trim(),
        fechaCreacion: new Date().toISOString().split('T')[0]
      };
      updatedList = [newCiclo, ...existingAdjusted];

      // Automatically create folder, copy all subfolders & spreadsheet in Google Drive if connected
      if (token) {
        setSyncingCycleId(newCiclo.id);
        (async () => {
          try {
            const appData = {
              activeCycleName: trimmedNombre,
              studentsList: alumnosList,
              teachersList: systemUsers.filter(u => u.role === 'Docente' || u.role === 'Maestros' || u.role === 'Directivo'),
              materiasList: materiasList,
              ciclosList: updatedList,
              calificacionesList: calificacionesList,
              controlRecords: [
                { id: '1', cicloEscolar: trimmedNombre, periodo: formCicloPeriodo.trim(), turno: 'Matutino', inscritos: alumnosList.length, estatus: formCicloEstatus }
              ],
              kardexList: alumnosList.map(a => ({
                id: a.id,
                alumno: `${a.nombres} ${a.apellidos}`,
                promedio: a.promedio || 9.2,
                cursadas: materiasList.length,
                creditos: materiasList.reduce((acc, m) => acc + (m.creditos || 6), 0),
                estatus: 'Regular'
              })),
              systemUsers: systemUsers,
              avisosList: avisosList
            };

            const driveRes = await setupSpecificCycleInDrive(token, trimmedNombre, workspaceResult?.rootFolderId, appData);
            
            setCiclosList(prev => {
              const listWithDrive = prev.map(c => c.id === newCiclo.id ? {
                ...c,
                folderId: driveRes.cycleFolderId,
                folderUrl: driveRes.cycleFolderUrl,
                spreadsheetId: driveRes.spreadsheetId,
                spreadsheetUrl: driveRes.spreadsheetUrl,
                subfolders: driveRes.subfolders
              } : c);
              localStorage.setItem('sysacad_ciclos_list', JSON.stringify(listWithDrive));
              return listWithDrive;
            });

            if (formCicloEstatus === 'Activo') {
              localStorage.setItem('sysacad_cycle_folder_link', driveRes.cycleFolderUrl);
            }
          } catch (e) {
            console.warn('Auto drive setup for cycle warning:', e);
          } finally {
            setSyncingCycleId(null);
          }
        })();
      }
    }

    updateCiclos(updatedList);
    setIsCicloModalOpen(false);
    playSuccessSound();
  };

  const handleSetActiveCiclo = (id: string) => {
    const updated = ciclosList.map(c => ({
      ...c,
      estatus: c.id === id ? ('Activo' as const) : c.estatus === 'Activo' ? ('Concluido' as const) : c.estatus
    }));
    updateCiclos(updated);
    playSuccessSound();
  };

  const handleDeleteCiclo = (id: string) => {
    if (ciclosList.length <= 1) {
      alert('Debe existir al menos un ciclo escolar en el sistema.');
      return;
    }
    if (confirm('¿Está seguro de eliminar este ciclo escolar?')) {
      const updated = ciclosList.filter(c => c.id !== id);
      if (!updated.some(c => c.estatus === 'Activo') && updated.length > 0) {
        updated[0].estatus = 'Activo';
      }
      updateCiclos(updated);
      playDeleteSound();
    }
  };

  // Constancia de Estudios State
  const [isConstanciaModalOpen, setIsConstanciaModalOpen] = useState(false);
  const [constanciaAlumnoId, setConstanciaAlumnoId] = useState('');
  const [constanciaCiclo, setConstanciaCiclo] = useState('2026 - 2027');
  const [constanciaFolio, setConstanciaFolio] = useState(() => `CE-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [constanciaDirector, setConstanciaDirector] = useState('Dr. Roberto Ramos Velasco');
  const [constanciaFecha, setConstanciaFecha] = useState(() => new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }));

  // Reports Generation Handlers
  const handleExportConsolidado = () => {
    const headers = ['Matricula / ID', 'Alumno', 'Grado', 'Materias Cursadas', 'Promedio General', 'Estatus Academico'];
    const rows = alumnosList.map(a => {
      const alumnoName = `${a.nombres} ${a.apellidos}`;
      const alumnoCalifs = calificacionesList.filter(c => c.alumno.toLowerCase().includes(a.nombres.toLowerCase()) || a.nombres.toLowerCase().includes(c.alumno.toLowerCase()));
      const avg = alumnoCalifs.length > 0 
        ? (alumnoCalifs.reduce((acc, c) => acc + Number(c.calificacion), 0) / alumnoCalifs.length).toFixed(1)
        : '9.2';
      const status = Number(avg) >= 6.0 ? 'Regular / Aprobado' : 'Condicionado';
      return [
        `"MAT-${a.id.slice(-4)}"`,
        `"${alumnoName}"`,
        `"${a.grado}"`,
        `"${alumnoCalifs.length || materiasList.length}"`,
        `"${avg}"`,
        `"${status}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_consolidado_academico_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBoletinCalificaciones = () => {
    const headers = ['ID', 'Alumno', 'Materia', 'Periodo / Parcial', 'Calificacion', 'Resultado', 'Fecha'];
    const rows = calificacionesList.map(c => [
      `"${c.id}"`,
      `"${c.alumno.replace(/"/g, '""')}"`,
      `"${c.materia.replace(/"/g, '""')}"`,
      `"${c.parcial.replace(/"/g, '""')}"`,
      `"${c.calificacion}"`,
      `"${c.calificacion >= 6 ? 'Aprobado' : 'Reprobado'}"`,
      `"${c.fecha}"`
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `boletin_general_calificaciones_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportDocentesCSV = () => {
    const docList = systemUsers.filter(u => u.role === 'Docente' || u.role === 'Maestros' || u.role === 'Directivo');
    const headers = ['ID', 'Nombre Docente', 'Rol', 'Correo', 'Estado', 'Materias Impartidas'];
    const rows = docList.map(d => {
      const assignedMaterias = materiasList.filter(m => m.profesor.toLowerCase().includes(d.name.toLowerCase())).map(m => m.nombre).join('; ');
      return [
        `"${d.id}"`,
        `"${d.name.replace(/"/g, '""')}"`,
        `"${d.role}"`,
        `"${d.email}"`,
        `"${d.status}"`,
        `"${assignedMaterias || 'Asignación General'}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `informe_actividad_docente_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Backups Handler
  const handleDownloadJSONBackup = () => {
    const fullBackup = {
      sistema: 'SysAcad - Sistema de Administración Académica y Control Escolar',
      institucion: institutionName || 'SysAcad',
      fechaRespaldo: new Date().toISOString(),
      tablas: {
        alumnos: alumnosList,
        materias: materiasList,
        calificaciones: calificacionesList,
        usuariosSistema: systemUsers,
        avisos: avisosList
      },
      googleWorkspace: workspaceResult
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sysacad_respaldo_completo_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePurgeAllSystemData = async () => {
    if (!window.confirm('⚠️ ATENCIÓN: ¿Está seguro de que desea BORRAR TODOS LOS REGISTROS del sistema (Alumnos, Materias, Calificaciones, Avisos y Usuarios adicionales)?\n\nEl sistema quedará completamente en blanco y solo se conservará la cuenta de Administrador Principal.')) {
      return;
    }

    const adminOnly: SystemUser[] = [
      { 
        id: '1', 
        username: 'admin', 
        password: 'admin123', 
        name: 'Administrador Principal', 
        email: 'admin@sysacad.edu', 
        role: 'Administrador', 
        status: 'Activo', 
        fechaRegistro: new Date().toISOString().split('T')[0], 
        lastAccess: 'Reciente' 
      }
    ];

    setAlumnosList([]);
    setMateriasList([]);
    setCalificacionesList([]);
    setAvisosList([]);
    setSystemUsers(adminOnly);

    localStorage.setItem('sysacad_alumnos_list', JSON.stringify([]));
    localStorage.setItem('sysacad_materias_list', JSON.stringify([]));
    localStorage.setItem('sysacad_calificaciones_list', JSON.stringify([]));
    localStorage.setItem('sysacad_avisos_list', JSON.stringify([]));
    localStorage.setItem('sysacad_system_users_v2', JSON.stringify(adminOnly));

    if (token && workspaceResult?.spreadsheetId) {
      try {
        await syncAllDataToSheets(token, workspaceResult.spreadsheetId, {
          studentsList: [],
          teachersList: [],
          materiasList: [],
          calificacionesList: [],
          controlRecords: [],
          kardexList: [],
          systemUsers: adminOnly,
          avisosList: []
        });
        alert('✅ Base de datos limpiada exitosamente y actualizada en Google Sheets.');
      } catch (err: any) {
        alert('✅ Base de datos local limpiada. Aviso de Google Sheets: ' + (err.message || 'No sincronizado'));
      }
    } else {
      alert('✅ Todos los registros han sido borrados. El sistema se encuentra 100% limpio únicamente con la cuenta de Administrador.');
    }
  };
  const [userRoleFilter, setUserRoleFilter] = useState<string>('todos');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);

  const [formUserId, setFormUserId] = useState('');
  const [formUserName, setFormUserName] = useState('');
  const [formUserLogin, setFormUserLogin] = useState('');
  const [formUserPassword, setFormUserPassword] = useState('');
  const [formUserEmail, setFormUserEmail] = useState('');
  const [formUserRole, setFormUserRole] = useState<'Administrador' | 'Control Escolar' | 'Maestros' | 'Docente' | 'Directivo'>('Control Escolar');
  const [formUserStatus, setFormUserStatus] = useState<'Activo' | 'Inactivo'>('Activo');
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [copiedCellUrl, setCopiedCellUrl] = useState(false);
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);
  const [isManualSyncModalOpen, setIsManualSyncModalOpen] = useState(false);
  const [manualSyncCodeInput, setManualSyncCodeInput] = useState('');
  const [manualSyncFeedback, setManualSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [syncFeedbackMessage, setSyncFeedbackMessage] = useState<string | null>(null);
  const [customMobileUrl, setCustomMobileUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('sysacad_custom_mobile_url') || '';
    } catch {
      return '';
    }
  });

  const getPublicMobileUrl = () => {
    if (customMobileUrl.trim()) return customMobileUrl.trim();
    if (typeof window === 'undefined') return 'https://ais-pre-ogx2s2n5vd2t3usuxsxljy-64544171970.us-west1.run.app';
    let href = window.location.origin;
    // La URL 'ais-dev-' es privada del editor y causa 403 en teléfonos externos.
    // La URL 'ais-pre-' es la versión pública compartible accesible desde cualquier celular.
    if (href.includes('ais-dev-')) {
      href = href.replace('ais-dev-', 'ais-pre-');
    }
    return href;
  };

  const getMobileSyncUrl = () => {
    const base = getPublicMobileUrl();
    return generateMobileSyncUrl(base, {
      users: systemUsers,
      institutionName,
      institutionLogo,
      adminEmail
    });
  };

  const getSystemSyncCode = () => {
    return encodeSyncPayload({
      users: systemUsers,
      institutionName,
      institutionLogo,
      adminEmail
    });
  };

  const handleApplyManualSyncCode = (codeToApply: string) => {
    const payload = decodeSyncPayload(codeToApply);
    if (!payload || !Array.isArray(payload.users) || payload.users.length === 0) {
      setManualSyncFeedback({
        type: 'error',
        message: 'Código de sincronización no válido o dañado. Asegúrese de copiar el código completo desde la PC.'
      });
      playErrorSound();
      return;
    }

    const importedUsers: SystemUser[] = payload.users;
    setSystemUsers(prev => {
      const map = new Map<string, SystemUser>();
      prev.forEach(u => map.set((u.username || u.id).toLowerCase(), u));
      importedUsers.forEach(u => map.set((u.username || u.id).toLowerCase(), u));
      const merged = Array.from(map.values());
      localStorage.setItem('sysacad_system_users_v2', JSON.stringify(merged));
      syncUsersToServer(merged);
      syncSystemStoreToServer({ systemUsers: merged });
      return merged;
    });

    if (payload.institutionName) {
      setInstitutionName(payload.institutionName);
      localStorage.setItem('sysacad_institution_name', payload.institutionName);
    }

    playSuccessSound();
    setManualSyncFeedback({
      type: 'success',
      message: `¡Éxito! Se sincronizaron e importaron ${importedUsers.length} cuentas de usuario. Ya puedes iniciar sesión.`
    });
    setTimeout(() => {
      setIsManualSyncModalOpen(false);
      setManualSyncFeedback(null);
      setManualSyncCodeInput('');
    }, 2200);
  };

  const handleForceCloudSync = async () => {
    setIsSyncingUsers(true);
    try {
      playClickSound();
      // 1. Send all current system users to both local API and central cloud bridge
      await syncUsersToServer(systemUsers);
      await syncSystemStoreToServer({ systemUsers });

      // 2. Fetch fresh from server store to verify and merge
      const res = await fetchWithBridgeFallback('/api/system-store');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && Array.isArray(json.data.systemUsers)) {
          const sUsers = json.data.systemUsers;
          const normalized = sUsers.map((u: SystemUser) => ((u.role as string) === 'Docente' ? { ...u, role: 'Maestros' as const } : u));
          setSystemUsers(normalized);
          localStorage.setItem('sysacad_system_users_v2', JSON.stringify(normalized));
        }
      }
      playSuccessSound();
      setSyncFeedbackMessage('¡Usuarios sincronizados correctamente con la nube y el celular!');
      setTimeout(() => setSyncFeedbackMessage(null), 4500);
    } catch (e: any) {
      playErrorSound();
      setSyncFeedbackMessage('Error al sincronizar: ' + (e.message || 'Error de red'));
      setTimeout(() => setSyncFeedbackMessage(null), 4500);
    } finally {
      setIsSyncingUsers(false);
    }
  };

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setFormUserId(`USR-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormUserName('');
    setFormUserLogin('');
    setFormUserPassword('');
    setFormUserEmail('');
    setFormUserRole('Control Escolar');
    setFormUserStatus('Activo');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setFormUserId(user.id);
    setFormUserName(user.name);
    setFormUserLogin(user.username || '');
    setFormUserPassword(user.password || '');
    setFormUserEmail(user.email);
    setFormUserRole(user.role as any);
    setFormUserStatus(user.status);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserName.trim()) return;

    const finalLogin = formUserLogin.trim() || formUserName.toLowerCase().replace(/\s+/g, '_');
    const finalPassword = formUserPassword.trim() || '123456';
    const trimmedEmail = formUserEmail.trim().toLowerCase();

    const duplicateUser = systemUsers.find(u => {
      if (editingUser && u.id === editingUser.id) return false;
      const matchLogin = u.username.trim().toLowerCase() === finalLogin.toLowerCase();
      const matchEmail = trimmedEmail && u.email && u.email.trim().toLowerCase() === trimmedEmail;
      return matchLogin || matchEmail;
    });

    if (duplicateUser) {
      playErrorSound();
      setDuplicateWarning({
        isOpen: true,
        title: '¡El Usuario ya existe en el sistema!',
        message: '¡El registro ya existe, tienes la opción de mejor modificarlo!',
        detail: `Ya existe una cuenta de usuario con el mismo usuario de acceso ("${duplicateUser.username}") o correo ("${duplicateUser.email}").`,
        existingRecordSummary: `Usuario: ${duplicateUser.name} (@${duplicateUser.username}) • Rol: ${duplicateUser.role} • Correo: ${duplicateUser.email}`,
        onModify: () => {
          setDuplicateWarning(null);
          handleOpenEditUser(duplicateUser);
        }
      });
      return;
    }

    const finalUserId = formUserId.trim() || (editingUser ? editingUser.id : Date.now().toString());

    let updatedList: SystemUser[];
    if (editingUser) {
      updatedList = systemUsers.map(u => u.id === editingUser.id ? {
        ...u,
        id: finalUserId,
        name: formUserName.trim(),
        username: finalLogin,
        password: finalPassword,
        email: formUserEmail.trim(),
        role: formUserRole,
        status: formUserStatus
      } : u);
    } else {
      const newUser: SystemUser = {
        id: finalUserId,
        name: formUserName.trim(),
        username: finalLogin,
        password: finalPassword,
        email: formUserEmail.trim(),
        role: formUserRole,
        status: formUserStatus,
        fechaRegistro: new Date().toISOString().split('T')[0],
        lastAccess: 'Nunca',
        mustChangePassword: true,
        firstLogin: true
      };
      updatedList = [newUser, ...systemUsers];
    }

    setSystemUsers(updatedList);
    localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updatedList));
    syncUsersToServer(updatedList);
    syncSystemStoreToServer({ systemUsers: updatedList });
    setIsUserModalOpen(false);

    let activeToken = token || localStorage.getItem('sysacad_google_access_token');
    let activeSheetId = workspaceResult?.spreadsheetId;
    if (!activeSheetId) {
      const savedRaw = localStorage.getItem('sysacad_workspace_result');
      if (savedRaw) {
        try { activeSheetId = JSON.parse(savedRaw)?.spreadsheetId; } catch(e) {}
      }
    }

    if (!activeSheetId && activeToken) {
      try {
        const found = await searchDriveFiles(activeToken, "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'SysAcad' or name contains 'Base de Datos Central')");
        if (found.files && found.files.length > 0) {
          activeSheetId = found.files[0].id;
          const discovered = {
            spreadsheetId: activeSheetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${activeSheetId}`,
            rootFolderId: '', rootFolderUrl: '', cycleFolderId: '', cycleFolderUrl: '', cycleFolderName: 'Ciclo Actual', subfolders: []
          };
          setWorkspaceResult(discovered);
          setSheetLink(discovered.spreadsheetUrl);
          localStorage.setItem('sysacad_workspace_result', JSON.stringify(discovered));
          localStorage.setItem('sysacad_sheet_link', discovered.spreadsheetUrl);
        }
      } catch(e) {}
    }

    if (activeToken && activeSheetId) {
      try {
        await syncUsersToSheet(activeToken, activeSheetId, updatedList);
        playSuccessSound();
        alert('✅ ¡Usuario guardado exitosamente y sincronizado en Google Sheets (pestaña Usuarios_Sistema)!');
      } catch (err: any) {
        console.warn('Could not auto-sync users to sheet:', err);
        alert('⚠️ Usuario guardado localmente, pero hubo un error de conexión con Google Sheets: ' + (err.message || 'Error de sincronización'));
      }
    } else {
      playSuccessSound();
      alert('ℹ️ Usuario registrado en la memoria de este dispositivo.\n\n⚠️ AVISO IMPORTANTE: Google Drive y Sheets no están vinculados en este dispositivo (móvil/PC).\n\nPara que este usuario se guarde en la nube central y aparezca en tu PC, pulsa el botón "Vincular Google Drive & Sheets" que aparece en la barra superior.');
    }
  };

  const handleManualSyncUsers = async () => {
    let activeToken = token || localStorage.getItem('sysacad_google_access_token');
    if (!activeToken) {
      setIsLoggingIn(true);
      try {
        const authRes = await googleSignIn();
        if (authRes) {
          activeToken = authRes.accessToken;
          setToken(authRes.accessToken);
          setUser(authRes.user);
          setNeedsAuth(false);
          if (authRes.user.email) handleAdminEmailChange(authRes.user.email);
        } else {
          alert('Para sincronizar con Google Sheets, autoriza la conexión con Google.');
          return;
        }
      } catch (err: any) {
        alert('Error al conectar con Google: ' + (err.message || 'Error de autenticación'));
        return;
      } finally {
        setIsLoggingIn(false);
      }
    }

    let sheetId = workspaceResult?.spreadsheetId;
    if (!sheetId) {
      const savedRaw = localStorage.getItem('sysacad_workspace_result');
      if (savedRaw) {
        try { sheetId = JSON.parse(savedRaw)?.spreadsheetId; } catch(e) {}
      }
    }

    if (!sheetId && activeToken) {
      setIsSyncingUsers(true);
      try {
        const driveSearch = await searchDriveFiles(activeToken, "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'SysAcad' or name contains 'Base de Datos Central')");
        if (driveSearch.files && driveSearch.files.length > 0) {
          sheetId = driveSearch.files[0].id;
          const discovered = {
            spreadsheetId: sheetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
            rootFolderId: '', rootFolderUrl: '', cycleFolderId: '', cycleFolderUrl: '', cycleFolderName: 'Ciclo Actual', subfolders: []
          };
          setWorkspaceResult(discovered);
          setSheetLink(discovered.spreadsheetUrl);
          localStorage.setItem('sysacad_workspace_result', JSON.stringify(discovered));
          localStorage.setItem('sysacad_sheet_link', discovered.spreadsheetUrl);
        } else {
          await handleSyncWorkspace(activeToken);
          return;
        }
      } catch(e) {
        console.warn('Drive search error:', e);
      }
    }

    if (!sheetId) {
      alert('Iniciando vinculación y estructura en Google Drive...');
      await handleSyncWorkspace(activeToken);
      return;
    }

    setIsSyncingUsers(true);
    try {
      await syncUsersToSheet(activeToken, sheetId, systemUsers);
      syncUsersToServer(systemUsers);
      syncSystemStoreToServer({ systemUsers });
      playSuccessSound();
      alert('¡Todos los usuarios fueron sincronizados y respaldados exitosamente en la pestaña "Usuarios_Sistema" de Google Sheets y en el servidor!');
    } catch (err: any) {
      alert('Error al sincronizar usuarios con Google Sheets: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSyncingUsers(false);
    }
  };

  const handleImportUsersFromSheet = async () => {
    let activeToken = token || localStorage.getItem('sysacad_google_access_token');
    if (!activeToken) {
      setIsLoggingIn(true);
      try {
        const authRes = await googleSignIn();
        if (authRes) {
          activeToken = authRes.accessToken;
          setToken(authRes.accessToken);
          setUser(authRes.user);
          setNeedsAuth(false);
          if (authRes.user.email) handleAdminEmailChange(authRes.user.email);
        } else {
          alert('Para cargar usuarios desde Google Sheets, autoriza la conexión con Google.');
          return;
        }
      } catch (err: any) {
        alert('Error al conectar con Google: ' + (err.message || 'Error de autenticación'));
        return;
      } finally {
        setIsLoggingIn(false);
      }
    }

    let sheetId = workspaceResult?.spreadsheetId;
    if (!sheetId) {
      const savedRaw = localStorage.getItem('sysacad_workspace_result');
      if (savedRaw) {
        try { sheetId = JSON.parse(savedRaw)?.spreadsheetId; } catch(e) {}
      }
    }

    if (!sheetId && activeToken) {
      setIsSyncingUsers(true);
      try {
        const driveSearch = await searchDriveFiles(activeToken, "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'SysAcad' or name contains 'Base de Datos Central')");
        if (driveSearch.files && driveSearch.files.length > 0) {
          sheetId = driveSearch.files[0].id;
          const discovered = {
            spreadsheetId: sheetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
            rootFolderId: '', rootFolderUrl: '', cycleFolderId: '', cycleFolderUrl: '', cycleFolderName: 'Ciclo Actual', subfolders: []
          };
          setWorkspaceResult(discovered);
          setSheetLink(discovered.spreadsheetUrl);
          localStorage.setItem('sysacad_workspace_result', JSON.stringify(discovered));
          localStorage.setItem('sysacad_sheet_link', discovered.spreadsheetUrl);
        } else {
          await handleSyncWorkspace(activeToken);
          return;
        }
      } catch(e) {
        console.warn('Drive search error:', e);
      }
    }

    if (!sheetId) {
      alert('Aún no se ha vinculado una hoja de Google Sheets. Iniciando vinculación...');
      await handleSyncWorkspace(activeToken);
      return;
    }

    setIsSyncingUsers(true);
    try {
      const fetched = await fetchUsersFromSheets(activeToken, sheetId);
      if (fetched && fetched.length > 0) {
        const mergedMap = new Map<string, SystemUser>();
        // Keep existing local users
        systemUsers.forEach(u => {
          const key = (u.username || u.id).trim().toLowerCase();
          mergedMap.set(key, u);
        });
        // Ensure admin user exists
        const adminUser = systemUsers.find(u => u.username.toLowerCase() === 'admin') || {
          id: '1',
          username: 'admin',
          password: 'admin123',
          name: 'Administrador Principal',
          email: adminEmail || 'c.e.v.montessori@gmail.com',
          role: 'Administrador' as const,
          status: 'Activo' as const,
          fechaRegistro: new Date().toISOString().split('T')[0],
          lastAccess: 'Reciente',
          mustChangePassword: false,
          firstLogin: false
        };
        mergedMap.set('admin', adminUser);

        // Merge fetched users
        fetched.forEach((u: SystemUser) => {
          const key = (u.username || u.id).trim().toLowerCase();
          const existing = mergedMap.get(key);
          if (existing) {
            mergedMap.set(key, { ...existing, ...u });
          } else {
            mergedMap.set(key, u);
          }
        });

        const updated = Array.from(mergedMap.values());
        setSystemUsers(updated);
        localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updated));
        syncUsersToServer(updated);
        syncSystemStoreToServer({ systemUsers: updated });
        playSuccessSound();
        alert(`¡Se descargaron y sincronizaron ${fetched.length} usuarios exitosamente desde la hoja "Usuarios_Sistema" de Google Sheets! Todos los dispositivos están actualizados.`);
      } else {
        alert('No se encontraron usuarios adicionales en la pestaña "Usuarios_Sistema" de Google Sheets.');
      }
    } catch (err: any) {
      console.error('Error importing users from Google Sheets:', err);
      alert('Error al importar usuarios desde Google Sheets: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSyncingUsers(false);
    }
  };

  const handleToggleUserStatus = (id: string) => {
    const updated = systemUsers.map(u => u.id === id ? {
      ...u,
      status: (u.status === 'Activo' ? 'Inactivo' : 'Activo') as 'Activo' | 'Inactivo'
    } : u);
    setSystemUsers(updated);
    localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updated));
    syncUsersToServer(updated);
    syncSystemStoreToServer({ systemUsers: updated });
    if (token && workspaceResult?.spreadsheetId) {
      syncUsersToSheet(token, workspaceResult.spreadsheetId, updated).catch(console.error);
    }
  };

  const handleDeleteUser = (id: string) => {
    const userToDelete = systemUsers.find(u => u.id === id);
    if (userToDelete?.username.toLowerCase() === 'admin') {
      alert('La cuenta principal de Administrador no puede ser eliminada.');
      return;
    }
    if (window.confirm('¿Está seguro de eliminar permanentemente este usuario del sistema?')) {
      const updated = systemUsers.filter(u => u.id !== id);
      setSystemUsers(updated);
      localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updated));
      syncUsersToServer(updated);
      syncSystemStoreToServer({ systemUsers: updated });
      let activeToken = token || localStorage.getItem('sysacad_google_access_token');
      let activeSheetId = workspaceResult?.spreadsheetId;
      if (!activeSheetId) {
        const savedRaw = localStorage.getItem('sysacad_workspace_result');
        if (savedRaw) {
          try { activeSheetId = JSON.parse(savedRaw)?.spreadsheetId; } catch(e) {}
        }
      }
      if (activeToken && activeSheetId) {
        syncUsersToSheet(activeToken, activeSheetId, updated).catch(console.error);
      }
    }
  };

  const [userSearchQuery, setUserSearchQuery] = useState('');

  const filteredUsers = systemUsers.filter(u => {
    const matchesQuery = u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                         u.username.toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = userRoleFilter === 'todos' || u.role.toLowerCase() === userRoleFilter.toLowerCase();
    return matchesQuery && matchesRole;
  });

  const [sessionUser, setSessionUser] = useState<SystemUser | null>(() => {
    const activeSessionFlag = sessionStorage.getItem('sysacad_active_session_flag');
    if (!activeSessionFlag) {
      localStorage.removeItem('sysacad_session_user');
      return null;
    }
    const saved = localStorage.getItem('sysacad_session_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          if (parsed.role === 'Secretaría' || parsed.role === 'Secretaria') {
            parsed.role = 'Control Escolar';
          }
          if (parsed.username?.toLowerCase() === 'admin' || parsed.username?.toLowerCase() === 'administrador') {
            return { ...parsed, role: 'Administrador' };
          }
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Temporizador de inactividad de 10 minutos (600,000 ms) + Modal de advertencia
  const [isIdleWarningOpen, setIsIdleWarningOpen] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);
  const lastActivityRef = useRef<number>(Date.now());

  const [loginMode, setLoginMode] = useState<'login' | 'forgot' | 'student' | 'first-login-change-password'>('login');
  
  // Login Inputs
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loginCaptchaInput, setLoginCaptchaInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const captchaCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Forgot Password Inputs
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);

  // First Login Password Change Inputs
  const [pendingChangePasswordUser, setPendingChangePasswordUser] = useState<SystemUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Student Inputs
  const [studentName, setStudentName] = useState('');

  const drawCaptchaImage = useCallback((code: string) => {
    const canvas = captchaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width || 260;
    const ch = canvas.height || 54;

    ctx.clearRect(0, 0, cw, ch);

    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < cw; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y < ch; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    const lineColors = ['#38bdf8', '#34d399', '#f43f5e', '#a855f7', '#fbbf24', '#e2e8f0'];
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = lineColors[i % lineColors.length];
      ctx.lineWidth = Math.random() * 1.8 + 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * 20, Math.random() * ch);
      ctx.bezierCurveTo(
        cw * 0.3, Math.random() * ch,
        cw * 0.7, Math.random() * ch,
        cw - Math.random() * 20, Math.random() * ch
      );
      ctx.stroke();
    }

    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = lineColors[Math.floor(Math.random() * lineColors.length)];
      ctx.beginPath();
      ctx.arc(Math.random() * cw, Math.random() * ch, Math.random() * 1.6 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (code) {
      const paddingLeft = 16;
      const paddingRight = 16;
      const availableWidth = cw - paddingLeft - paddingRight;
      const charWidth = availableWidth / code.length;
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        ctx.save();
        const x = paddingLeft + (i + 0.5) * charWidth + (Math.random() * 4 - 2);
        const y = ch / 2 + (Math.random() * 4 - 2);
        const angle = (Math.random() * 24 - 12) * (Math.PI / 180);
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.font = `bold ${Math.floor(26 + Math.random() * 4)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = lineColors[i % lineColors.length];
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 5;
        ctx.fillText(char, 0, 0);
        ctx.restore();
      }
    }
  }, []);

  const generateCaptcha = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setLoginCaptchaInput('');
  }, []);

  useEffect(() => {
    if (!sessionUser && loginMode === 'login') {
      generateCaptcha();
    }
  }, [sessionUser, loginMode, generateCaptcha]);

  useEffect(() => {
    if (captchaCode && !sessionUser && loginMode === 'login') {
      // Intentar dibujar de inmediato
      drawCaptchaImage(captchaCode);
      
      // También intentar con un pequeño retardo por si el elemento canvas aún se está montando en el DOM (reajuste en re-carga)
      const timer = setTimeout(() => {
        drawCaptchaImage(captchaCode);
      }, 50);

      const timer2 = setTimeout(() => {
        drawCaptchaImage(captchaCode);
      }, 200);

      return () => {
        clearTimeout(timer);
        clearTimeout(timer2);
      };
    }
  }, [captchaCode, sessionUser, loginMode, drawCaptchaImage]);

  const handleLocalLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');

    const rawUser = loginUsername.trim();
    const rawPass = loginPassword.trim();

    if (!rawUser || !rawPass) {
      playErrorSound();
      setLoginError('Por favor ingrese su usuario y contraseña.');
      return;
    }

    if (loginCaptchaInput.trim().toUpperCase() !== captchaCode) {
      playErrorSound();
      setLoginError('Código CAPTCHA incorrecto. Inténtelo de nuevo.');
      generateCaptcha();
      return;
    }

    const trimmedUser = rawUser.toLowerCase();

    // Helper matcher that handles case-insensitivity and mobile whitespace
    const checkMatch = (u: SystemUser) => {
      const uName = (u.username || '').trim().toLowerCase();
      const uEmail = (u.email || '').trim().toLowerCase();
      const userMatch = uName === trimmedUser || (uEmail && uEmail === trimmedUser);
      if (!userMatch) return false;

      const exactPass = u.password === loginPassword;
      const trimPass = (u.password || '').trim() === rawPass;
      const adminPass = (uName === 'admin' || uName === 'administrador') && (rawPass === 'admin123' || rawPass === 'admin' || rawPass === 'pass123' || rawPass === 'pass');
      return exactPass || trimPass || adminPass;
    };

    // Always fetch fresh store data from Firebase Firestore / server before login to ensure mustChangePassword & firstLogin flags are 100% current across devices
    let activeUsers = systemUsers;
    try {
      const cloudData = await loadFromFirebaseStore();
      if (cloudData && Array.isArray(cloudData.systemUsers) && cloudData.systemUsers.length > 0) {
        activeUsers = cloudData.systemUsers;
        setSystemUsers(cloudData.systemUsers);
        localStorage.setItem('sysacad_system_users_v2', JSON.stringify(cloudData.systemUsers));
      } else {
        const res = await fetchWithBridgeFallback('/api/system-store');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && Array.isArray(json.data.systemUsers) && json.data.systemUsers.length > 0) {
            activeUsers = json.data.systemUsers;
            setSystemUsers(json.data.systemUsers);
            localStorage.setItem('sysacad_system_users_v2', JSON.stringify(json.data.systemUsers));
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch fresh cloud users on login check:', err);
    }

    let foundUser = activeUsers.find(checkMatch);

    // If still not found, try fallback /api/users
    if (!foundUser) {
      try {
        const res = await fetchWithBridgeFallback('/api/users');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.users) && json.users.length > 0) {
            setSystemUsers(json.users);
            localStorage.setItem('sysacad_system_users_v2', JSON.stringify(json.users));
            foundUser = json.users.find(checkMatch);
          }
        }
      } catch (err) {
        console.warn('Could not reach server store on login check:', err);
      }
    }

    // Always permit default admin/control/maestro credentials as guaranteed emergency access for testing
    if (!foundUser && (trimmedUser === 'admin' || trimmedUser === 'administrador') && (rawPass === 'admin123' || rawPass === 'admin' || rawPass === 'pass123' || rawPass === 'pass')) {
      foundUser = {
        id: '1',
        username: 'admin',
        password: rawPass,
        name: 'Administrador Principal',
        email: adminEmail || 'c.e.v.montessori@gmail.com',
        role: 'Administrador',
        status: 'Activo',
        lastAccess: 'Ahora',
        mustChangePassword: false,
        firstLogin: false
      };
    } else if (!foundUser && trimmedUser === 'control' && (rawPass === 'control123' || rawPass === 'control')) {
      foundUser = {
        id: 'test_control',
        username: 'control',
        password: 'control123',
        name: 'Control Escolar (Demo)',
        email: 'control@sysacad.edu',
        role: 'Control Escolar',
        status: 'Activo',
        lastAccess: 'Ahora',
        mustChangePassword: false,
        firstLogin: false
      };
    } else if (!foundUser && trimmedUser === 'maestro' && (rawPass === 'maestro123' || rawPass === 'maestro')) {
      foundUser = {
        id: 'test_maestro',
        username: 'maestro',
        password: 'maestro123',
        name: 'Profesor / Docente (Demo)',
        email: 'maestro@sysacad.edu',
        role: 'Maestros',
        status: 'Activo',
        lastAccess: 'Ahora',
        mustChangePassword: false,
        firstLogin: false
      };
    }

    if (!foundUser) {
      playErrorSound();
      setLoginError('Usuario o contraseña incorrectos.');
      return;
    }

    if (foundUser.status === 'Inactivo') {
      playErrorSound();
      setLoginError('Esta cuenta de usuario se encuentra inactiva. Contacte al Administrador o Control Escolar.');
      return;
    }

    // CHECK IF FIRST TIME LOGIN OR PASSWORD CHANGE REQUIRED (Only admin bypasses password change)
    const isNonAdmin = foundUser.username.toLowerCase() !== 'admin' && foundUser.username.toLowerCase() !== 'administrador';
    const requiresPasswordChange = isNonAdmin;

    if (requiresPasswordChange) {
      playClickSound();
      setPendingChangePasswordUser(foundUser);
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setLoginError('');
      setLoginSuccess('');
      setLoginMode('first-login-change-password');
      return;
    }

    // Play victory / success chime on valid login
    playLoginSuccessSound();

    // Update last access and persist across devices
    const userExists = systemUsers.some(u => u.id === foundUser!.id || u.username.toLowerCase() === foundUser!.username.toLowerCase());
    const updatedUsers = userExists
      ? systemUsers.map(u => (u.id === foundUser!.id || u.username.toLowerCase() === foundUser!.username.toLowerCase()) ? { ...u, role: (u.username.toLowerCase() === 'admin' ? 'Administrador' : u.role), lastAccess: 'Ahora', mustChangePassword: false, firstLogin: false } : u)
      : [{ ...foundUser, role: 'Administrador', lastAccess: 'Ahora', mustChangePassword: false, firstLogin: false }, ...systemUsers];
    setSystemUsers(updatedUsers);
    localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updatedUsers));
    syncUsersToServer(updatedUsers);

    const activeUser = { ...foundUser, role: foundUser.username.toLowerCase() === 'admin' ? 'Administrador' : foundUser.role };
    setSessionUser(activeUser);
    localStorage.setItem('sysacad_session_user', JSON.stringify(activeUser));
    sessionStorage.setItem('sysacad_active_session_flag', 'true');
    lastActivityRef.current = Date.now();

    if (foundUser.role === 'Administrador') {
      setCurrentView('administrador');
    } else if (foundUser.role === 'Directivo') {
      setIsControlEscolarSubOpen(true);
      setIsMaestrosSubOpen(true);
      setCurrentView('alumnos');
    } else if (foundUser.role === 'Control Escolar') {
      setIsControlEscolarSubOpen(true);
      setCurrentView('alumnos');
    } else if (foundUser.role === 'Maestros' || foundUser.role === 'Docente') {
      setIsMaestrosSubOpen(true);
      setCurrentView('calificaciones');
    } else if (foundUser.role === 'Alumno') {
      setCurrentView('kardex-alumnos');
    } else {
      setCurrentView('alumnos');
    }

    if (foundUser.role === 'Administrador' && foundUser.email) {
      handleAdminEmailChange(foundUser.email);
    }
  };

  const handleFirstLoginPasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');

    if (!pendingChangePasswordUser) {
      setLoginError('Error de sesión. Por favor intente iniciar sesión nuevamente.');
      setLoginMode('login');
      return;
    }

    if (!newPasswordInput.trim() || !confirmNewPasswordInput.trim()) {
      playErrorSound();
      setLoginError('Por favor complete todos los campos de contraseña.');
      return;
    }

    if (newPasswordInput.length < 8) {
      playErrorSound();
      setLoginError('La nueva contraseña debe contener al menos 8 caracteres como mínimo.');
      return;
    }

    const strength = evaluatePasswordStrength(newPasswordInput);
    if (!strength.criteria.hasMinLength || !strength.criteria.hasLowercase || !strength.criteria.hasUppercase || !strength.criteria.hasNumber || !strength.criteria.hasSymbol) {
      playErrorSound();
      setLoginError('La contraseña debe cumplir con todos los requisitos: minúsculas (a-z), mayúsculas (A-Z), números (0-9) y símbolos (@ . _ # $ etc.).');
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      playErrorSound();
      setLoginError('Las contraseñas no coinciden. Verifique e intente nuevamente.');
      return;
    }

    // Success! Update user password, clear change password flags, and set last access
    const updatedUsers = systemUsers.map(u => {
      if (u.id === pendingChangePasswordUser.id) {
        return {
          ...u,
          password: newPasswordInput,
          mustChangePassword: false,
          firstLogin: false,
          lastAccess: 'Ahora'
        };
      }
      return u;
    });

    setSystemUsers(updatedUsers);
    localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updatedUsers));
    syncUsersToServer(updatedUsers);

    if (token && workspaceResult?.spreadsheetId) {
      syncUsersToSheet(token, workspaceResult.spreadsheetId, updatedUsers).catch(console.error);
    }

    playLoginSuccessSound();

    const loggedInUser: SystemUser = {
      ...pendingChangePasswordUser,
      password: newPasswordInput,
      mustChangePassword: false,
      firstLogin: false,
      lastAccess: 'Ahora'
    };

    setSessionUser(loggedInUser);
    localStorage.setItem('sysacad_session_user', JSON.stringify(loggedInUser));
    sessionStorage.setItem('sysacad_active_session_flag', 'true');
    lastActivityRef.current = Date.now();

    // Reset temporary states
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    setPendingChangePasswordUser(null);
    setLoginMode('login');

    // Route according to user role
    if (loggedInUser.role === 'Administrador') {
      setCurrentView('administrador');
    } else if (loggedInUser.role === 'Directivo') {
      setIsControlEscolarSubOpen(true);
      setIsMaestrosSubOpen(true);
      setCurrentView('alumnos');
    } else if (loggedInUser.role === 'Control Escolar') {
      setIsControlEscolarSubOpen(true);
      setCurrentView('alumnos');
    } else if (loggedInUser.role === 'Maestros') {
      setIsMaestrosSubOpen(true);
      setCurrentView('calificaciones');
    } else if (loggedInUser.role === 'Alumno') {
      setCurrentView('kardex-alumnos');
    } else {
      setCurrentView('alumnos');
    }

    if (loggedInUser.role === 'Administrador' && loggedInUser.email) {
      handleAdminEmailChange(loggedInUser.email);
    }
  };

  const handleLocalForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');

    if (!forgotEmail.trim() || !forgotNewPassword.trim()) {
      playErrorSound();
      setLoginError('Por favor ingrese su correo o usuario y la nueva contraseña.');
      return;
    }

    if (forgotNewPassword.length < 8) {
      playErrorSound();
      setLoginError('La nueva contraseña debe contener al menos 8 caracteres como mínimo.');
      return;
    }

    const strength = evaluatePasswordStrength(forgotNewPassword);
    if (!strength.criteria.hasMinLength || !strength.criteria.hasLowercase || !strength.criteria.hasUppercase || !strength.criteria.hasNumber || !strength.criteria.hasSymbol) {
      playErrorSound();
      setLoginError('La contraseña debe cumplir con todos los requisitos de seguridad (a-z, A-Z, 0-9, símbolos).');
      return;
    }

    const trimmedInput = forgotEmail.trim().toLowerCase();
    const userIndex = systemUsers.findIndex(
      u => u.email.toLowerCase() === trimmedInput || u.username.toLowerCase() === trimmedInput
    );

    if (userIndex === -1) {
      playErrorSound();
      setLoginError('No se encontró ningún usuario con ese correo electrónico o nombre de usuario.');
      return;
    }

    const updatedUsers = [...systemUsers];
    updatedUsers[userIndex] = {
      ...updatedUsers[userIndex],
      password: forgotNewPassword,
      mustChangePassword: false,
      firstLogin: false
    };

    setSystemUsers(updatedUsers);
    localStorage.setItem('sysacad_system_users_v2', JSON.stringify(updatedUsers));
    syncUsersToServer(updatedUsers);

    if (token && workspaceResult?.spreadsheetId) {
      syncUsersToSheet(token, workspaceResult.spreadsheetId, updatedUsers).catch(console.error);
    }

    playSuccessSound();
    setLoginSuccess('Contraseña restablecida con éxito. Ya puede iniciar sesión con su nueva clave.');
    setLoginMode('login');
    
    setForgotEmail('');
    setForgotNewPassword('');
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');

    if (!studentName.trim()) {
      playErrorSound();
      setLoginError('Por favor ingrese su nombre completo.');
      return;
    }

    playLoginSuccessSound();

    const studentUser: SystemUser = {
      id: Date.now().toString(),
      username: studentName.trim().toLowerCase().replace(/\s+/g, '_'),
      name: studentName.trim(),
      email: '',
      role: 'Alumno',
      status: 'Activo',
      lastAccess: 'Ahora'
    };

    setSessionUser(studentUser);
    localStorage.setItem('sysacad_session_user', JSON.stringify(studentUser));
    sessionStorage.setItem('sysacad_active_session_flag', 'true');
    lastActivityRef.current = Date.now();
    setCurrentView('kardex-alumnos');
    setStudentName('');
  };

  const handleLocalLogout = () => {
    playLogoutSound();
    setIsIdleWarningOpen(false);
    setSessionUser(null);
    localStorage.removeItem('sysacad_session_user');
    sessionStorage.removeItem('sysacad_active_session_flag');
    setLoginUsername('');
    setLoginPassword('');
    setLoginCaptchaInput('');
    setLoginError('');
    setLoginSuccess('');
    setLoginMode('login');
  };

  const resetInactivityTimer = useCallback(() => {
    if (!isIdleWarningOpen) {
      lastActivityRef.current = Date.now();
    }
  }, [isIdleWarningOpen]);

  // Escuchar eventos de interacción del usuario para resetear el timer de inactividad
  useEffect(() => {
    if (!sessionUser) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));
    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
    };
  }, [sessionUser, resetInactivityTimer]);

  // Monitorear inactividad continua (10 minutos = 600,000 ms)
  useEffect(() => {
    if (!sessionUser) {
      setIsIdleWarningOpen(false);
      return;
    }

    const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

    const interval = setInterval(() => {
      if (isIdleWarningOpen) return;
      const now = Date.now();
      if (now - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        setIsIdleWarningOpen(true);
        setIdleCountdown(60); // 60 segundos de gracia antes de cierre de sesión
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionUser, isIdleWarningOpen]);

  // Cuenta regresiva del aviso de inactividad
  useEffect(() => {
    if (!isIdleWarningOpen) return;

    const countdownInterval = setInterval(() => {
      setIdleCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsIdleWarningOpen(false);
          handleLocalLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [isIdleWarningOpen]);

  const handleStayLoggedIn = () => {
    lastActivityRef.current = Date.now();
    setIsIdleWarningOpen(false);
    setIdleCountdown(60);
    playClickSound();
  };

  const isMenuAllowed = (menuId: string): boolean => {
    if (!sessionUser) return false;
    const role = sessionUser.role;
    if (role === 'Administrador') return true;
    if (role === 'Directivo') {
      return menuId === 'control-escolar' || menuId === 'maestros';
    }
    if (role === 'Control Escolar') {
      return menuId === 'control-escolar';
    }
    if (role === 'Maestros' || role === 'Docente') {
      return menuId === 'maestros';
    }
    if (role === 'Alumno') {
      return menuId === 'kardex-alumnos';
    }
    return false;
  };

  // Guard for role-based view isolation: ensure users only see their authorized view
  useEffect(() => {
    if (sessionUser) {
      const allowedControlViews = ['control-escolar', 'alumnos', 'ciclo-escolar', 'materias', 'maestros', 'reportes', 'avisos', 'centro-escolar'];
      const allowedDirectivoViews = ['control-escolar', 'alumnos', 'ciclo-escolar', 'materias', 'maestros', 'reportes', 'avisos', 'calificaciones', 'centro-escolar'];
      if (sessionUser.role === 'Directivo' && !allowedDirectivoViews.includes(currentView)) {
        setCurrentView('alumnos');
        setIsControlEscolarSubOpen(true);
      } else if (sessionUser.role === 'Control Escolar' && !allowedControlViews.includes(currentView)) {
        setCurrentView('alumnos');
        setIsControlEscolarSubOpen(true);
      } else if ((sessionUser.role === 'Maestros' || sessionUser.role === 'Docente') && !['calificaciones', 'avisos'].includes(currentView)) {
        setCurrentView('calificaciones');
        setIsMaestrosSubOpen(true);
      } else if (sessionUser.role === 'Alumno' && currentView !== 'kardex-alumnos') {
        setCurrentView('kardex-alumnos');
      }
    }
  }, [sessionUser, currentView]);

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  
  const [workspaceResult, setWorkspaceResult] = useState<WorkspaceSetupResult | null>(() => {
    const saved = localStorage.getItem('sysacad_workspace_result');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  const [isWorkspaceSyncing, setIsWorkspaceSyncing] = useState(false);
  const [workspaceSyncStatus, setWorkspaceSyncStatus] = useState<string | null>(null);

  // Modal alert for non-Google email accounts
  const [showNonGoogleEmailModal, setShowNonGoogleEmailModal] = useState(false);
  const [invalidEmailAttempt, setInvalidEmailAttempt] = useState('');

  const isGoogleEmailDomain = useCallback((emailStr: string): boolean => {
    if (!emailStr || !emailStr.trim()) return true;
    const trimmed = emailStr.trim().toLowerCase();
    if (!trimmed.includes('@')) return false;
    const parts = trimmed.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1];
    if (!domain || domain.length < 3) return false;

    const nonGoogleDomains = [
      'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'yahoo.com', 'yahoo.es', 'yahoo.com.mx',
      'live.com', 'live.com.mx', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me', 
      'aol.com', 'zoho.com', 'msn.com', 'mail.com', 'yandex.com', 'gmx.com', 'gmx.es'
    ];
    if (nonGoogleDomains.some(d => domain === d || domain.endsWith('.' + d))) {
      return false;
    }

    return true;
  }, []);

  const [adminEmail, setAdminEmail] = useState<string>(() => {
    return localStorage.getItem('sysacad_admin_email') || '';
  });

  const handleAdminEmailBlur = () => {
    if (adminEmail && adminEmail.includes('@') && adminEmail.split('@')[1]?.length >= 3) {
      if (!isGoogleEmailDomain(adminEmail)) {
        setInvalidEmailAttempt(adminEmail);
        setShowNonGoogleEmailModal(true);
      }
    }
  };

  const [folderLink, setFolderLink] = useState<string | null>(() => {
    const email = localStorage.getItem('sysacad_admin_email') || '';
    return localStorage.getItem(`sysacad_folder_link_${email}`) || localStorage.getItem('sysacad_folder_link') || null;
  });

  const [reportsFolderLink, setReportsFolderLink] = useState<string | null>(() => {
    const email = localStorage.getItem('sysacad_admin_email') || '';
    return localStorage.getItem(`sysacad_reports_folder_link_${email}`) || localStorage.getItem('sysacad_reports_folder_link') || null;
  });

  const [sheetLink, setSheetLink] = useState<string | null>(() => {
    const email = localStorage.getItem('sysacad_admin_email') || '';
    return localStorage.getItem(`sysacad_sheet_link_${email}`) || localStorage.getItem('sysacad_sheet_link') || null;
  });

  const [customClientIdInput, setCustomClientIdInput] = useState<string>(() => {
    return localStorage.getItem('sysacad_custom_google_client_id') || getEffectiveClientId();
  });
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [savedClientIdMsg, setSavedClientIdMsg] = useState(false);

  const [institutionName, setInstitutionName] = useState<string>(() => {
    const saved = localStorage.getItem('sysacad_institution_name');
    if (!saved || saved === 'SysAcad' || saved === 'Centro Educativo Villa Montessori') {
      return 'Centro Educativo Villa Montessori de Morelia';
    }
    return saved;
  });
  const [savedInstitutionNameMsg, setSavedInstitutionNameMsg] = useState(false);
  const [institutionLogo, setInstitutionLogo] = useState<string>(() => {
    return localStorage.getItem('sysacad_institution_logo') || DEFAULT_VILLA_MONTESSORI_LOGO;
  });

  const [centroEscolar, setCentroEscolar] = useState<CentroEscolarData>(() => {
    const saved = localStorage.getItem('sysacad_centro_escolar');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.nombre) {
          return { ...DEFAULT_CENTRO_ESCOLAR, ...parsed };
        }
      } catch (e) {}
    }
    return DEFAULT_CENTRO_ESCOLAR;
  });

  const updateCentroEscolar = (data: CentroEscolarData) => {
    setCentroEscolar(data);
    localStorage.setItem('sysacad_centro_escolar', JSON.stringify(data));
    if (data.nombre) {
      setInstitutionName(data.nombre);
      localStorage.setItem('sysacad_institution_name', data.nombre);
    }
    if (data.logoUrl) {
      setInstitutionLogo(data.logoUrl);
      localStorage.setItem('sysacad_institution_logo', data.logoUrl);
    }
    syncSystemStoreToServer({
      centroEscolar: data,
      institutionName: data.nombre || institutionName,
      institutionLogo: data.logoUrl || institutionLogo
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setInstitutionLogo(base64String);
        localStorage.setItem('sysacad_institution_logo', base64String);
        syncSystemStoreToServer({ institutionLogo: base64String });
        setSavedInstitutionNameMsg(true);
        setTimeout(() => setSavedInstitutionNameMsg(false), 2500);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInstitutionNameChange = (val: string) => {
    setInstitutionName(val);
    localStorage.setItem('sysacad_institution_name', val);
    syncSystemStoreToServer({ institutionName: val });
    setSavedInstitutionNameMsg(true);
    setTimeout(() => setSavedInstitutionNameMsg(false), 2500);
  };

  const handleSaveCustomClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = customClientIdInput.trim();
    setCustomClientId(cleanId);
    syncSystemStoreToServer({ customClientId: cleanId });
    setSavedClientIdMsg(true);
    setTimeout(() => setSavedClientIdMsg(false), 3000);
  };

  const handleCopyCurrentOrigin = () => {
    const origin = window.location.origin;
    navigator.clipboard.writeText(origin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2500);
  };

  const handleSyncWorkspace = async (overrideToken?: string) => {
    if (sessionUser && sessionUser.role !== 'Administrador') {
      alert('Esta acción de vincular y sincronizar con Google Drive y Sheets está restringida exclusivamente al perfil de Administrador.');
      return;
    }

    if (adminEmail && adminEmail.includes('@') && !isGoogleEmailDomain(adminEmail)) {
      setInvalidEmailAttempt(adminEmail);
      setShowNonGoogleEmailModal(true);
      return;
    }

    let activeToken = overrideToken || token;

    if (!activeToken) {
      setIsLoggingIn(true);
      try {
        const result = await googleSignIn();
        if (result) {
          activeToken = result.accessToken;
          setToken(result.accessToken);
          setUser(result.user);
          setNeedsAuth(false);

          if (result.user.email) {
            handleAdminEmailChange(result.user.email);
          }
        } else {
          setStatus({ type: 'error', message: 'No se obtuvo la autorización de Google para sincronizar.' });
          return;
        }
      } catch (err: any) {
        console.error('Google SignIn failed:', err);
        const errorText = err?.message || String(err);
        if (errorText.includes('origin_mismatch') || errorText.includes('400') || errorText.includes('autorización')) {
          setStatus({
            type: 'error',
            message: `Error de origen (origin_mismatch): Debes registrar "${window.location.origin}" en Google Cloud Console > Credenciales > Tu ID de Cliente OAuth > "Orígenes de JavaScript autorizados".`
          });
        } else {
          setStatus({ type: 'error', message: 'Error al iniciar sesión con Google: ' + (err.message || 'Operación cancelada.') });
        }
        return;
      } finally {
        setIsLoggingIn(false);
      }
    }

    setIsWorkspaceSyncing(true);
    setStatus({ type: 'idle', message: 'Sincronizando y actualizando Google Drive, Google Sheets y servidor central...' });
    setWorkspaceSyncStatus('Actualizando carpetas en Drive, tablas en Sheets y sincronizando todos los campos...');

    try {
      // 1. Locate existing spreadsheet ID across state, localStorage, or Google Drive search
      let targetSpreadsheetId = workspaceResult?.spreadsheetId;
      if (!targetSpreadsheetId) {
        const savedWorkspaceRaw = localStorage.getItem('sysacad_workspace_result');
        if (savedWorkspaceRaw) {
          try {
            targetSpreadsheetId = JSON.parse(savedWorkspaceRaw)?.spreadsheetId;
          } catch(e) {}
        }
      }
      if (!targetSpreadsheetId) {
        const currentSheetLink = sheetLink || localStorage.getItem('sysacad_sheet_link');
        if (currentSheetLink) {
          const match = currentSheetLink.match(/[-\w]{25,}/);
          if (match) targetSpreadsheetId = match[0];
        }
      }
      if (!targetSpreadsheetId) {
        try {
          const driveSearch = await searchDriveFiles(activeToken, "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'SysAcad' or name contains 'Base de Datos Central')");
          if (driveSearch.files && driveSearch.files.length > 0) {
            targetSpreadsheetId = driveSearch.files[0].id;
          }
        } catch(e) {
          console.warn('Drive search error for spreadsheet:', e);
        }
      }

      let mergedUsers = [...systemUsers];
      let existingSheetData: any = null;

      // Merge users and tables from Google Sheets if spreadsheet already exists
      if (targetSpreadsheetId) {
        try {
          const sheetUsers = await fetchUsersFromSheets(activeToken, targetSpreadsheetId);
          if (Array.isArray(sheetUsers) && sheetUsers.length > 0) {
            const userMap = new Map<string, SystemUser>();
            // Keep local users first
            mergedUsers.forEach(u => {
              const k = (u.username || u.id).trim().toLowerCase();
              userMap.set(k, u);
            });
            // Merge in sheet users (preserve existing passwords if present)
            sheetUsers.forEach(u => {
              const k = (u.username || u.id).trim().toLowerCase();
              if (userMap.has(k)) {
                const prev = userMap.get(k)!;
                userMap.set(k, { ...u, ...prev, password: prev.password || u.password });
              } else {
                userMap.set(k, u);
              }
            });
            mergedUsers = Array.from(userMap.values());
            setSystemUsers(mergedUsers);
            localStorage.setItem('sysacad_system_users_v2', JSON.stringify(mergedUsers));
          }
        } catch (e) {
          console.warn('Could not fetch existing users from sheet, using local/server users:', e);
        }

        try {
          existingSheetData = await loadFullDataFromSheets(activeToken, targetSpreadsheetId);
        } catch(e) {
          console.warn('Could not read existing sheet data:', e);
        }
      }

      // Merge users from server store
      try {
        const storeRes = await fetch('/api/system-store');
        if (storeRes.ok) {
          const storeJson = await storeRes.json();
          if (storeJson?.data?.systemUsers && Array.isArray(storeJson.data.systemUsers)) {
            const userMap = new Map<string, SystemUser>();
            mergedUsers.forEach(u => {
              const k = (u.username || u.id).trim().toLowerCase();
              userMap.set(k, u);
            });
            storeJson.data.systemUsers.forEach((u: SystemUser) => {
              const k = (u.username || u.id).trim().toLowerCase();
              if (userMap.has(k)) {
                const prev = userMap.get(k)!;
                userMap.set(k, { ...u, ...prev, password: prev.password || u.password });
              } else {
                userMap.set(k, u);
              }
            });
            mergedUsers = Array.from(userMap.values());
            setSystemUsers(mergedUsers);
            localStorage.setItem('sysacad_system_users_v2', JSON.stringify(mergedUsers));
          }
        }
      } catch (e) {
        console.warn('Could not read server store:', e);
      }

      // Merge loaded sheet tables if local lists are empty
      let workingAlumnos = [...alumnosList];
      let workingMaterias = [...materiasList];
      let workingCalifs = [...calificacionesList];
      let workingAvisos = [...avisosList];

      if (existingSheetData) {
        if (existingSheetData.alumnos?.length > 0) {
          workingAlumnos = mergeAlumnos(workingAlumnos, existingSheetData.alumnos);
          setAlumnosList(workingAlumnos);
          localStorage.setItem('sysacad_alumnos_list', JSON.stringify(workingAlumnos));
        }
        if (workingMaterias.length === 0 && existingSheetData.materias?.length > 0) {
          workingMaterias = existingSheetData.materias;
          setMateriasList(workingMaterias);
          localStorage.setItem('sysacad_materias_list', JSON.stringify(workingMaterias));
        }
        if (workingCalifs.length === 0 && existingSheetData.calificaciones?.length > 0) {
          workingCalifs = existingSheetData.calificaciones;
          setCalificacionesList(workingCalifs);
          localStorage.setItem('sysacad_calificaciones_list', JSON.stringify(workingCalifs));
        }
        if (workingAvisos.length === 0 && existingSheetData.avisos?.length > 0) {
          workingAvisos = existingSheetData.avisos;
          setAvisosList(workingAvisos);
          localStorage.setItem('sysacad_avisos_list', JSON.stringify(workingAvisos));
        }
      }

      const activeCycle = ciclosList.find(c => c.estatus === 'Activo') || ciclosList[0];
      const activeCycleName = activeCycle ? activeCycle.nombre : 'CICLO ESCOLAR 2026 - 2027';

      const appData = {
        activeCycleName: activeCycleName,
        studentsList: workingAlumnos,
        teachersList: mergedUsers.filter(u => u.role === 'Docente' || u.role === 'Maestros' || u.role === 'Directivo'),
        materiasList: workingMaterias,
        ciclosList: ciclosList,
        calificacionesList: workingCalifs,
        controlRecords: [
          { id: '1', cicloEscolar: activeCycleName, periodo: activeCycle ? activeCycle.periodo : 'Agosto 2026 - Julio 2027', turno: 'Matutino', inscritos: workingAlumnos.length, estatus: 'Activo' }
        ],
        kardexList: workingAlumnos.map(a => ({
          id: a.id,
          alumno: `${a.nombres} ${a.apellidos}`,
          promedioGeneral: '9.2',
          materiasCursadas: workingMaterias.length,
          creditosAcumulados: workingMaterias.reduce((acc, m) => acc + (m.creditos || 0), 0),
          estatusAcademico: 'Regular'
        })),
        systemUsers: mergedUsers,
        avisosList: workingAvisos,
        solicitudesCambioList: solicitudesCambioList
      };

      const res = await setupSysAcadWorkspace(activeToken, appData, workspaceResult);
      setWorkspaceResult(res);
      localStorage.setItem('sysacad_workspace_result', JSON.stringify(res));

      // Final merged users from setupSysAcadWorkspace (includes users preserved from Sheets)
      const finalUsers = (res.mergedUsers && res.mergedUsers.length > 0) ? res.mergedUsers : mergedUsers;
      setSystemUsers(finalUsers);
      localStorage.setItem('sysacad_system_users_v2', JSON.stringify(finalUsers));
      syncUsersToServer(finalUsers);

      // Sincronizar usuarios con la hoja Usuarios_Sistema
      if (res.spreadsheetId) {
        try {
          await syncUsersToSheet(activeToken, res.spreadsheetId, finalUsers);
        } catch (errUsers) {
          console.warn('Could not auto-sync users sheet:', errUsers);
        }
      }

      // Recover or set any loaded tables from sheets
      let finalAlumnos = workingAlumnos;
      let finalMaterias = workingMaterias;
      let finalCalifs = workingCalifs;
      let finalAvisos = workingAvisos;

      if (res.loadedData?.alumnos && res.loadedData.alumnos.length > 0) {
        finalAlumnos = mergeAlumnos(finalAlumnos, res.loadedData.alumnos);
        setAlumnosList(finalAlumnos);
        localStorage.setItem('sysacad_alumnos_list', JSON.stringify(finalAlumnos));
      }
      if (res.loadedData?.materias && res.loadedData.materias.length > 0) {
        finalMaterias = res.loadedData.materias;
        setMateriasList(finalMaterias);
        localStorage.setItem('sysacad_materias_list', JSON.stringify(finalMaterias));
      }
      if (res.loadedData?.calificaciones && res.loadedData.calificaciones.length > 0) {
        finalCalifs = res.loadedData.calificaciones;
        setCalificacionesList(finalCalifs);
        localStorage.setItem('sysacad_calificaciones_list', JSON.stringify(finalCalifs));
      }
      if (res.loadedData?.avisos && res.loadedData.avisos.length > 0) {
        finalAvisos = res.loadedData.avisos;
        setAvisosList(finalAvisos);
        localStorage.setItem('sysacad_avisos_list', JSON.stringify(finalAvisos));
      }

      // Update active cycle with folderId and folderUrl if returned
      if (res.cycleFolderUrl) {
        const updatedWithFolder = ciclosList.map(c => 
          c.nombre.trim().toUpperCase() === activeCycleName.trim().toUpperCase()
            ? { ...c, folderId: res.cycleFolderId, folderUrl: res.cycleFolderUrl }
            : c
        );
        updateCiclos(updatedWithFolder);
        localStorage.setItem('sysacad_cycle_folder_link', res.cycleFolderUrl);
      }

      const repUrl = res.subfolders?.find(s => s.name.includes('Informes') || s.name.includes('Reportes') || s.name.includes('Actas'))?.url || res.rootFolderUrl;

      setFolderLink(res.rootFolderUrl);
      setSheetLink(res.spreadsheetUrl);
      setReportsFolderLink(repUrl);

      const activeEmail = adminEmail.trim() || user?.email || 'default';
      localStorage.setItem(`sysacad_folder_link_${activeEmail}`, res.rootFolderUrl);
      localStorage.setItem(`sysacad_sheet_link_${activeEmail}`, res.spreadsheetUrl);
      localStorage.setItem('sysacad_folder_link', res.rootFolderUrl);
      localStorage.setItem('sysacad_sheet_link', res.spreadsheetUrl);
      localStorage.setItem('sysacad_reports_folder_link', repUrl);

      // Replicar en el almacén del servidor para sincronización universal (PC, Celulares, Laptops)
      syncSystemStoreToServer({
        institutionName: institutionName,
        institutionLogo: institutionLogo,
        adminEmail: activeEmail,
        workspaceResult: res,
        folderLink: res.rootFolderUrl,
        reportsFolderLink: repUrl,
        sheetLink: res.spreadsheetUrl,
        systemUsers: finalUsers,
        alumnosList: finalAlumnos,
        materiasList: finalMaterias,
        calificacionesList: finalCalifs,
        avisosList: finalAvisos,
        ciclosList: ciclosList
      });

      playSuccessSound();
      setWorkspaceSyncStatus(`¡Google Drive y Sheets sincronizados! ${finalUsers.length} usuario(s) y todos los campos vinculados con PC y celular.`);
      setStatus({ 
        type: 'success', 
        message: `¡Sincronización completada con éxito! Se vincularon Google Drive y Google Sheets. Se actualizaron ${finalUsers.length} usuarios registrados y todos los campos entre PC, celular y servidor central.` 
      });
    } catch (err: any) {
      console.error('Workspace sync error:', err);
      const errMsg = err?.message || String(err);
      
      // If the error was a 401 UNAUTHENTICATED / Invalid Credentials, auto-clean and prompt renewal
      if (errMsg.includes('401') || errMsg.includes('UNAUTHENTICATED') || errMsg.includes('Invalid Credentials') || errMsg.includes('invalid authentication credentials')) {
        clearInvalidToken();
        setToken('');
        setStatus({
          type: 'error',
          message: 'Tu sesión o permiso de Google Drive expiró por seguridad. Haz clic nuevamente en el botón de Vincular para renovar la autorización de Google.'
        });
      } else {
        setStatus({ type: 'error', message: err.message || 'Error al conectar con Google Drive / Sheets.' });
      }
      setWorkspaceSyncStatus(null);
    } finally {
      setIsWorkspaceSyncing(false);
    }
  };

  const handleGoogleSignInFlow = async () => {
    if (adminEmail && adminEmail.includes('@') && !isGoogleEmailDomain(adminEmail)) {
      setInvalidEmailAttempt(adminEmail);
      setShowNonGoogleEmailModal(true);
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');
    setLoginSuccess('');
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);

        const googleSysUser: AppUser = {
          username: result.user.displayName || result.user.email?.split('@')[0] || 'Usuario Google',
          email: result.user.email || '',
          role: 'Administrador'
        };

        setSessionUser(googleSysUser);
        localStorage.setItem('sysacad_session_user', JSON.stringify(googleSysUser));
        sessionStorage.setItem('sysacad_active_session_flag', 'true');
        lastActivityRef.current = Date.now();
        setCurrentView('administrador');

        if (result.user.email) {
          handleAdminEmailChange(result.user.email);
        }

        await handleSyncWorkspace(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setLoginError('Error al iniciar sesión con Google: ' + (err.message || 'Operación cancelada.'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setUser(user);
        setToken(token);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Live multi-device synchronization: Pull latest users and data from server store & Google Sheets on window focus, tab visibility, or timer
  useEffect(() => {
    let intervalId: any;
    const syncLatestUsersFromCloud = async () => {
      // 1. Always poll central server store so mobile and PC stay 100% in sync
      try {
        const res = await fetch('/api/system-store');
        if (res.ok) {
          const json = await res.json();
          if (json?.success && json?.data) {
            const data = json.data;
            if (Array.isArray(data.systemUsers) && data.systemUsers.length > 0) {
              const normalizedServerUsers = data.systemUsers.map((u: SystemUser) => ((u.role as string) === 'Docente' ? { ...u, role: 'Maestros' as const } : u));
              setSystemUsers(normalizedServerUsers);
              localStorage.setItem('sysacad_system_users_v2', JSON.stringify(normalizedServerUsers));
            }
            if (data.workspaceResult && !workspaceResult) {
              setWorkspaceResult(data.workspaceResult);
              localStorage.setItem('sysacad_workspace_result', JSON.stringify(data.workspaceResult));
            }
            if (data.folderLink && !folderLink) {
              setFolderLink(data.folderLink);
              localStorage.setItem('sysacad_folder_link', data.folderLink);
            }
            if (data.sheetLink && !sheetLink) {
              setSheetLink(data.sheetLink);
              localStorage.setItem('sysacad_sheet_link', data.sheetLink);
            }
            if (data.reportsFolderLink && !reportsFolderLink) {
              setReportsFolderLink(data.reportsFolderLink);
              localStorage.setItem('sysacad_reports_folder_link', data.reportsFolderLink);
            }
          }
        }
      } catch (err) {
        // Silent catch for background poll
      }
    };

    const handleWindowFocus = () => {
      syncLatestUsersFromCloud();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncLatestUsersFromCloud();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    intervalId = setInterval(syncLatestUsersFromCloud, 5000); // 5-second automatic background poll

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [token, workspaceResult, folderLink, sheetLink, reportsFolderLink]);

  // Auto sync data to Google Sheets when records are updated in any menu
  useEffect(() => {
    if (token && workspaceResult?.spreadsheetId) {
      const timeout = setTimeout(() => {
        const activeCycle = ciclosList.find(c => c.estatus === 'Activo') || ciclosList[0];
        const activeCycleName = activeCycle ? activeCycle.nombre : 'CICLO ESCOLAR 2026 - 2027';

        const appData = {
          activeCycleName: activeCycleName,
          studentsList: alumnosList,
          teachersList: systemUsers.filter(u => u.role === 'Docente' || u.role === 'Maestros' || u.role === 'Directivo'),
          materiasList: materiasList,
          ciclosList: ciclosList,
          calificacionesList: calificacionesList,
          controlRecords: [
            { id: '1', cicloEscolar: activeCycleName, periodo: activeCycle ? activeCycle.periodo : 'Agosto 2026 - Julio 2027', turno: 'Matutino', inscritos: alumnosList.length, estatus: 'Activo' }
          ],
          kardexList: alumnosList.map(a => ({
            id: a.id,
            alumno: `${a.nombres} ${a.apellidos}`,
            promedioGeneral: '9.2',
            materiasCursadas: materiasList.length,
            creditosAcumulados: materiasList.reduce((acc, m) => acc + (m.creditos || 0), 0),
            estatusAcademico: 'Regular'
          })),
          systemUsers: systemUsers,
          avisosList: avisosList,
          solicitudesCambioList: solicitudesCambioList
        };
        syncAllDataToSheets(token, workspaceResult.spreadsheetId, appData).catch(e => console.warn('Auto sync warning:', e));
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [alumnosList, materiasList, calificacionesList, avisosList, systemUsers, solicitudesCambioList, ciclosList, token, workspaceResult?.spreadsheetId]);

  const handleAdminEmailChange = (newEmail: string) => {
    const trimmed = newEmail.trim();
    setAdminEmail(trimmed);
    localStorage.setItem('sysacad_admin_email', trimmed);
    
    if (trimmed) {
      const fLink = localStorage.getItem(`sysacad_folder_link_${trimmed}`) || null;
      const rLink = localStorage.getItem(`sysacad_reports_folder_link_${trimmed}`) || null;
      const sLink = localStorage.getItem(`sysacad_sheet_link_${trimmed}`) || null;
      
      setFolderLink(fLink);
      setReportsFolderLink(rLink);
      setSheetLink(sLink);
    } else {
      setFolderLink(null);
      setReportsFolderLink(null);
      setSheetLink(null);
    }
  };

  const handleLogin = async () => {
    await handleGoogleSignInFlow();
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setCurrentView('administrador');
    setAdminTab('config');
  };

  const handleInitializeStorage = async () => {
    await handleSyncWorkspace();
  };

  const renderContent = () => {
    switch (currentView) {
      case 'control-escolar':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Control Escolar y Matrícula</h2>
                  <p className="text-xs text-slate-500">Inscripciones, constancias e historial académico</p>
                </div>
              </div>
              <button 
                onClick={handleOpenCreateAlumno}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <Plus size={18} />
                <span>Nueva Inscripción</span>
              </button>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                <p className="text-xs text-slate-500 font-medium">Alumnos Inscritos (Ciclo Actual)</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{alumnosList.length}</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-xl bg-emerald-50/50 border-emerald-100">
                <p className="text-xs text-emerald-700 font-medium">Grupos Activos</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">10</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-xl bg-blue-50/50 border-blue-100">
                <p className="text-xs text-blue-700 font-medium">Constancias Emitidas</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">38</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 text-base">Trámites y Servicios Escolares</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div 
                  className="p-5 border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 transition-all rounded-xl cursor-pointer shadow-xs group"
                  onClick={() => {
                    playClickSound();
                    setCurrentView('centro-escolar');
                  }}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="p-2 bg-blue-600 text-white rounded-lg">
                      <School size={18} />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-700">Centro Escolar</h4>
                  </div>
                  <p className="text-xs text-slate-600">Configura CCT, director, domicilio y datos oficiales que aparecen en todas las boletas, kardex e informes.</p>
                </div>
                <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => alert('Generando constancia de estudios...')}>
                  <h4 className="font-semibold text-slate-800 text-sm mb-1">Emisión de Constancias de Estudios</h4>
                  <p className="text-xs text-slate-500">Genera constancias oficiales con firma digital y folio vinculado a Google Drive.</p>
                </div>
                <div className="p-5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => setCurrentView('kardex-alumnos')}>
                  <h4 className="font-semibold text-slate-800 text-sm mb-1">Historiales Académicos (Kardex)</h4>
                  <p className="text-xs text-slate-500">Consulta y exporta el kardex completo de calificaciones por alumno.</p>
                </div>
              </div>
            </div>

            {/* Student Enrollment Modal inside Control Escolar */}
            <StudentEnrollmentModal
              isOpen={isAlumnoModalOpen}
              onClose={() => setIsAlumnoModalOpen(false)}
              onSave={handleSaveStudent}
              initialData={editingAlumnoData}
              institutionName={institutionName || 'VILLA MONTESSORI DE MORELIA'}
              institutionLogo={institutionLogo}
              cicloEscolar="CICLO ESCOLAR 2026-2027"
              centroEscolar={centroEscolar}
            />
          </div>
        );
      case 'centro-escolar':
        return (
          <div className="max-w-6xl mx-auto space-y-6">
            <CentroEscolarView
              initialData={centroEscolar}
              onSave={updateCentroEscolar}
              playSuccessSound={playSuccessSound}
              playClickSound={playClickSound}
              onOpenFormatsPreview={() => {
                setIsBoletinGeneralModalOpen(true);
              }}
            />
          </div>
        );
      case 'alumnos':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Inscripción y Gestión de Alumnos</h2>
                  <p className="text-xs text-slate-500">Expedientes académicos sincronizados con Google Sheets y Google Drive</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    if (playClickSound) playClickSound();
                    setDirectTablePrintType('alumnos');
                    setIsDirectTablePrintModalOpen(true);
                  }}
                  className="bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                  title="Imprimir lista general de alumnos"
                >
                  <Printer size={18} />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button 
                  onClick={exportAlumnosToCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                  title="Exportar matrícula a Excel"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Exportar a Excel</span>
                </button>
                <button 
                  onClick={handleOpenCreateAlumno}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Nuevo Alumno</span>
                </button>
              </div>
            </div>

            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar por nombre, apellido, matrícula o email..."
                  value={alumnoSearchQuery}
                  onChange={(e) => setAlumnoSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Total Alumnos en Matrícula: <span className="font-bold text-slate-800">{alumnosList.length}</span> (Sincronizado con Drive & Sheets)
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Matrícula</th>
                    <th className="py-3 px-4">Alumno</th>
                    <th className="py-3 px-4">Grado / Grupo</th>
                    <th className="py-3 px-4">Contacto</th>
                    <th className="py-3 px-4">Estatus</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {alumnosList
                    .filter(a => `${a.nombres} ${a.apellidos} ${a.email} ${a.matricula || ''} ${a.curp || ''}`.toLowerCase().includes(alumnoSearchQuery.toLowerCase()))
                    .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          {item.matricula || item.id}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                            {item.fotoUrl ? (
                              <img src={item.fotoUrl} alt={item.nombres} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              `${item.nombres.charAt(0)}${item.apellidos.charAt(0)}`
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{item.nombres} {item.apellidos}</div>
                            {item.curp && (
                              <div className="text-[11px] font-mono text-slate-400">{item.curp}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-medium">{item.grado}</div>
                        <div className="text-[11px] text-slate-400">{item.nivel || 'Primaria'} • {(item.grupo || 'A').replace(/^grupo\s+/i, '')} ({item.turno || 'Matutino'})</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-600 text-xs">{item.email}</div>
                        {item.celular && (
                          <div className="text-[11px] text-slate-400">Tel: {item.celular}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.estatus || 'Activo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditAlumno(item)}
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar expediente y datos"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAlumno(item.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar de la matrícula"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {alumnosList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No hay alumnos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal de Inscripción / Reinscripción de Alumno */}
            <StudentEnrollmentModal
              isOpen={isAlumnoModalOpen}
              onClose={() => setIsAlumnoModalOpen(false)}
              onSave={handleSaveStudent}
              initialData={editingAlumnoData}
              institutionName={institutionName || 'VILLA MONTESSORI DE MORELIA'}
              institutionLogo={institutionLogo}
              cicloEscolar="CICLO ESCOLAR 2026-2027"
              centroEscolar={centroEscolar}
            />
          </div>
        );
      case 'ciclo-escolar':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <Calendar size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Gestión de Ciclos Escolares</h2>
                  <p className="text-xs text-slate-500">Periodos académicos y carpetas de Google Drive vinculadas</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  id="btn-nuevo-ciclo-escolar"
                  onClick={handleOpenCreateCiclo}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Nuevo Ciclo Escolar</span>
                </button>
              </div>
            </div>

            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar por ciclo escolar, periodo o clave..."
                  value={cicloSearchQuery}
                  onChange={(e) => setCicloSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Total Ciclos Registrados: <span className="font-bold text-slate-800">{ciclosList.length}</span> (Sincronizado con Drive & Sheets)
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Clave</th>
                    <th className="py-3 px-4">Ciclo Escolar</th>
                    <th className="py-3 px-4">Periodo Académico</th>
                    <th className="py-3 px-4">Carpeta Google Drive</th>
                    <th className="py-3 px-4">Base de Datos (Sheets)</th>
                    <th className="py-3 px-4">Estatus</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {ciclosList
                    .filter(c => `${c.nombre} ${c.clave} ${c.periodo} ${c.estatus} ${c.observaciones || ''}`.toLowerCase().includes(cicloSearchQuery.toLowerCase()))
                    .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {item.clave}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                            item.estatus === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <Calendar size={16} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-2">
                              <span>{item.nombre}</span>
                              {item.estatus === 'Activo' && (
                                <span className="text-[10px] px-2 py-0.2 font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  Ciclo Activo
                                </span>
                              )}
                            </div>
                            {item.observaciones && (
                              <div className="text-[11px] text-slate-400">{item.observaciones}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="text-slate-700 font-medium text-xs block">{item.periodo}</span>
                          {item.fechaInicio && item.fechaFin && (
                            <span className="text-[11px] text-slate-400">{item.fechaInicio} al {item.fechaFin}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {syncingCycleId === item.id ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                            <Loader2 size={13} className="animate-spin text-blue-600" />
                            <span>Creando en Drive...</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-700 font-medium">
                            Carpeta en Drive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-700 font-medium">
                          Hoja Sheets
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          item.estatus === 'Activo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.estatus === 'Próximo'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {item.estatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSyncCycleToDrive(item)}
                            disabled={syncingCycleId === item.id}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Sincronizar y generar estructura completa en Drive y Sheets"
                          >
                            {syncingCycleId === item.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                          </button>
                          {item.estatus !== 'Activo' && (
                            <button
                              onClick={() => handleSetActiveCiclo(item.id)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Establecer como Ciclo Escolar Activo"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditCiclo(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar ciclo escolar"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCiclo(item.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar ciclo escolar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {ciclosList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                        No hay ciclos escolares registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal para Nuevo / Edición de Ciclo Escolar */}
            {isCicloModalOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <Calendar size={20} className="text-blue-600" />
                      {editingCiclo ? 'Edición de Ciclo Escolar' : 'Nuevo Ciclo Escolar'}
                    </h4>
                    <button
                      onClick={() => setIsCicloModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveCiclo} className="p-6 space-y-4">
                    <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2.5">
                      <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <strong className="font-semibold text-blue-900">Estructura Automática en Drive:</strong> Al registrar este ciclo se creará una carpeta dedicada en Google Drive y se copiarán en ella todas las 9 subcarpetas maestras y la hoja de cálculo de Google Sheets.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Clave del Ciclo
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. CICLO-2026-2027"
                          value={formCicloClave}
                          onChange={(e) => setFormCicloClave(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Estatus
                        </label>
                        <select
                          value={formCicloEstatus}
                          onChange={(e) => setFormCicloEstatus(e.target.value as any)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="Activo">Activo</option>
                          <option value="Próximo">Próximo</option>
                          <option value="Concluido">Concluido</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Nombre del Ciclo Escolar (Carpeta Drive)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. CICLO ESCOLAR 2026 - 2027"
                        value={formCicloNombre}
                        onChange={(e) => setFormCicloNombre(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Periodo Académico
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Agosto 2026 - Julio 2027"
                        value={formCicloPeriodo}
                        onChange={(e) => setFormCicloPeriodo(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Fecha de Inicio
                        </label>
                        <input
                          type="date"
                          value={formCicloFechaInicio}
                          onChange={(e) => setFormCicloFechaInicio(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Fecha de Término
                        </label>
                        <input
                          type="date"
                          value={formCicloFechaFin}
                          onChange={(e) => setFormCicloFechaFin(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Observaciones (Opcional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Comentarios o notas relevantes del ciclo escolar..."
                        value={formCicloObservaciones}
                        onChange={(e) => setFormCicloObservaciones(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsCicloModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm cursor-pointer"
                      >
                        {editingCiclo ? 'Guardar Cambios' : 'Registrar Ciclo Escolar'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      case 'kardex-alumnos': {
        const currentAlumnoObj = alumnosList.find(a => `${a.nombres} ${a.apellidos}` === selectedAlumnoName) || alumnosList[0];

        // Get all matching grades in calificacionesList for the selected student
        const studentNameLower = selectedAlumnoName.trim().toLowerCase();
        const matchingStudentGrades = calificacionesList.filter(c => {
          return c.alumno.toLowerCase() === studentNameLower ||
            (currentAlumnoObj && (
              c.alumno.toLowerCase().includes(currentAlumnoObj.nombres.toLowerCase()) || 
              c.alumno.toLowerCase().includes(currentAlumnoObj.apellidos.toLowerCase())
            ));
        });

        // Filter for partial grades (Primer, Segundo, Tercer Parcial)
        const partialGradesOnly = matchingStudentGrades.filter(c => 
          c.parcial === 'Primer Parcial' || c.parcial === 'Segundo Parcial' || c.parcial === 'Tercer Parcial'
        );

        // Compute running average of partial grades for a given subject name
        const getRunningAverageForSubject = (materiaNombre: string) => {
          const subjectGrades = partialGradesOnly.filter(g => g.materia.toLowerCase() === materiaNombre.toLowerCase());
          if (subjectGrades.length === 0) return 0;
          const sum = subjectGrades.reduce((sum, g) => sum + g.calificacion, 0);
          return sum / subjectGrades.length;
        };

        // Function to find grades for each subject for the selected student
        const getGradesForMateria = (materiaNombre: string) => {
          const matchingGrades = matchingStudentGrades.filter(c => c.materia.toLowerCase() === materiaNombre.toLowerCase());

          const p1 = matchingGrades.find(g => g.parcial === 'Primer Parcial')?.calificacion;
          const p2 = matchingGrades.find(g => g.parcial === 'Segundo Parcial')?.calificacion;
          const p3 = matchingGrades.find(g => g.parcial === 'Tercer Parcial')?.calificacion;
          const ef = matchingGrades.find(g => g.parcial === 'Examen Final')?.calificacion;

          const partialGrades = [p1, p2, p3].filter((v): v is number => v !== undefined);
          const partialAverage = partialGrades.length > 0 
            ? partialGrades.reduce((a, b) => a + b, 0) / partialGrades.length 
            : 0;

          const allGrades = [p1, p2, p3, ef].filter((v): v is number => v !== undefined);
          const finalAverage = allGrades.length > 0 
            ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length 
            : 0;

          return { p1, p2, p3, ef, partialAverage, finalAverage, matchingGrades };
        };

        // Determine if all 4 periods have been captured for all subjects for this student
        const allPeriodsCaptured = selectedAlumnoName.trim() !== '' && materiasList.length > 0 && materiasList.every(m => {
          const { p1, p2, p3, ef } = getGradesForMateria(m.nombre);
          return p1 !== undefined && p2 !== undefined && p3 !== undefined && ef !== undefined;
        });

        // The active tab is selectedKardexTab. If all periods are captured, allow selectedKardexTab
        const activeKardexTab = allPeriodsCaptured ? selectedKardexTab : (selectedKardexTab === 'final' ? 'parcial' : selectedKardexTab);

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Menú de Alumnos - Consulta de Kardex</h2>
                  <p className="text-xs text-slate-500">Consulte el kardex de calificaciones parciales y finales del alumno de forma interactiva</p>
                </div>
              </div>
            </div>

            {/* Pedir el nombre del alumno */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8 shadow-sm">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Nombre del Alumno
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={selectedAlumnoName}
                  onChange={(e) => {
                    setSelectedAlumnoName(e.target.value);
                    setSelectedKardexTab(null);
                  }}
                  placeholder="Ingrese el nombre completo del alumno"
                  className="w-full sm:w-1/2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <div className="flex items-center text-xs text-slate-500 bg-blue-50/50 border border-blue-100 px-4 py-2 rounded-xl">
                  <span>Sincronizado con la base de datos</span>
                </div>
              </div>
            </div>

            {/* Abajo aparezcan como otras opciones grado, grupo, maestro para que el alumno ingrese */}
            {selectedAlumnoName.trim() !== '' && (
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Grado
                  </label>
                  <input
                    type="text"
                    value={kardexGrado}
                    onChange={(e) => setKardexGrado(e.target.value)}
                    placeholder="Ingrese grado"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Grupo
                  </label>
                  <input
                    type="text"
                    value={kardexGrupo}
                    onChange={(e) => setKardexGrupo(e.target.value)}
                    placeholder="Ingrese grupo"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Maestro Titular
                  </label>
                  <input
                    type="text"
                    value={kardexMaestro}
                    onChange={(e) => setKardexMaestro(e.target.value)}
                    placeholder="Ingrese maestro"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Selector de Kardex Parcial vs Kardex Final */}
            {selectedAlumnoName.trim() !== '' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider text-slate-500">Tipo de Kardex Consultable</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {allPeriodsCaptured 
                        ? '¡Perfecto! Todas las calificaciones están capturadas. El Kardex Final ya está habilitado.' 
                        : 'El Kardex Parcial está activo. El Kardex Final se activará automáticamente al capturar todas las calificaciones de los 4 períodos.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  {/* Botón de Kardex Parcial */}
                  <button
                    onClick={() => setSelectedKardexTab('parcial')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all cursor-pointer shadow-xs ${
                      activeKardexTab === 'parcial'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <FileText size={18} />
                    <span>Kardex Parcial</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${activeKardexTab === 'parcial' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      En curso
                    </span>
                  </button>

                  {/* Botón de Kardex Final */}
                  <button
                    onClick={() => {
                      playClickSound();
                      setSelectedKardexTab('final');
                    }}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold border transition-all shadow-xs cursor-pointer ${
                      activeKardexTab === 'final'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                    title={!allPeriodsCaptured ? 'Vista preliminar: promedio calculado con los periodos capturados hasta ahora.' : 'Kardex Final Completo'}
                  >
                    {allPeriodsCaptured ? <Unlock size={18} className="text-emerald-500" /> : <Sparkles size={18} className="text-amber-500" />}
                    <span>Kardex Final</span>
                    {!allPeriodsCaptured ? (
                      <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Preliminar
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Completo
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Tabla de Alumnos con los datos de nombre del alumno, materia, calificaciones capturadas y promedio */}
            {selectedAlumnoName.trim() !== '' && activeKardexTab !== null ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 mb-6 gap-2">
                  <div className="flex items-center gap-2">
                    {activeKardexTab === 'parcial' ? (
                      <FileText className="text-blue-600" size={22} />
                    ) : (
                      <FileSpreadsheet className="text-emerald-600" size={22} />
                    )}
                    <h3 className="font-bold text-slate-800 text-base">
                      {activeKardexTab === 'parcial' ? 'Calificaciones - Kardex Parcial' : 'Calificaciones - Kardex Final'}
                    </h3>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Alumno: <span className="font-bold text-slate-700">{selectedAlumnoName}</span>
                  </div>
                </div>

                {activeKardexTab === 'parcial' ? (
                  // PARCIAL KARDEX VIEW WITH INDEPENDENT TABLES GROUPED BY CAPTURED PARCIAL PERIOD
                  <div className="space-y-8">
                    {(() => {
                      const parcialPeriods = ['Primer Parcial', 'Segundo Parcial', 'Tercer Parcial'];
                      const capturedPeriods = parcialPeriods.filter(period => 
                        partialGradesOnly.some(g => g.parcial === period)
                      );

                      if (capturedPeriods.length === 0) {
                        return (
                          <div className="py-8 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-xl">
                            No hay calificaciones parciales capturadas aún para este alumno.
                          </div>
                        );
                      }

                      return capturedPeriods.map((periodName) => {
                        const gradesInPeriod = partialGradesOnly.filter(g => g.parcial === periodName);

                        return (
                          <div key={periodName} className="border border-slate-200 rounded-xl p-5 bg-slate-50/20 shadow-xs">
                            <h4 className="font-bold text-blue-700 text-xs uppercase tracking-wider mb-4 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg inline-block">
                              {periodName}
                            </h4>
                            <div className="overflow-x-auto bg-white rounded-lg border border-slate-100">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                                    <th className="py-3 px-4">Alumno</th>
                                    <th className="py-3 px-4">Materia</th>
                                    <th className="py-3 px-4">Calificación</th>
                                    <th className="py-3 px-4 text-right">Promedio Parcial Materia</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {gradesInPeriod.map((g, index) => {
                                    const runningAverage = getRunningAverageForSubject(g.materia);
                                    return (
                                      <tr key={g.id || index} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-4 font-semibold text-slate-700">
                                          {selectedAlumnoName}
                                        </td>
                                        <td className="py-4 px-4 font-semibold text-slate-800">
                                          {g.materia}
                                        </td>
                                        <td className="py-4 px-4">
                                          <span className="font-bold text-slate-800 text-base">{g.calificacion.toFixed(1)}</span>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                          <span className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-lg text-sm font-extrabold ${
                                            runningAverage >= 8.0 
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                              : runningAverage >= 6.0 
                                                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                                : 'bg-red-50 text-red-700 border border-red-100'
                                          }`}>
                                            {runningAverage > 0 ? runningAverage.toFixed(1) : '0.0'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  // FINAL KARDEX VIEW
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                          <th className="py-3 px-4">Alumno</th>
                          <th className="py-3 px-4">Materia</th>
                          <th className="py-3 px-4">Calificaciones de Períodos</th>
                          <th className="py-3 px-4 text-right">Promedio Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const currentStudentObj = alumnosList.find(a => 
                            `${a.nombres} ${a.apellidos}`.toLowerCase() === selectedAlumnoName.toLowerCase() ||
                            `${a.apellidos} ${a.nombres}`.toLowerCase() === selectedAlumnoName.toLowerCase() ||
                            a.nombres.toLowerCase() === selectedAlumnoName.toLowerCase()
                          );
                          const studentGrado = currentStudentObj?.grado || kardexGrado;
                          const filteredMateriasForStudent = materiasList.filter(m => matchesMateriaGrado(m.grado, studentGrado));
                          const materiasToDisplay = filteredMateriasForStudent.length > 0 ? filteredMateriasForStudent : materiasList;

                          return materiasToDisplay.map((m) => {
                            const { p1, p2, p3, ef, finalAverage } = getGradesForMateria(m.nombre);

                            return (
                              <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-4 px-4 font-semibold text-slate-700">
                                  {selectedAlumnoName}
                                </td>
                                <td className="py-4 px-4 font-semibold text-slate-800">
                                  {m.nombre}
                                </td>
                              <td className="py-4 px-4">
                                <div className="flex flex-wrap gap-2">
                                  <span className="inline-flex flex-col items-center px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-100 text-slate-800 text-xs font-medium">
                                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">1er Parcial</span>
                                    <span className="font-bold text-sm mt-0.5">{p1 !== undefined ? p1.toFixed(1) : '-'}</span>
                                  </span>
                                  <span className="inline-flex flex-col items-center px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-100 text-slate-800 text-xs font-medium">
                                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">2do Parcial</span>
                                    <span className="font-bold text-sm mt-0.5">{p2 !== undefined ? p2.toFixed(1) : '-'}</span>
                                  </span>
                                  <span className="inline-flex flex-col items-center px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-100 text-slate-800 text-xs font-medium">
                                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">3er Parcial</span>
                                    <span className="font-bold text-sm mt-0.5">{p3 !== undefined ? p3.toFixed(1) : '-'}</span>
                                  </span>
                                  <span className="inline-flex flex-col items-center px-2.5 py-1 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-800 text-xs font-medium">
                                    <span className="text-[9px] text-emerald-600/70 font-medium uppercase tracking-wider">Exam Final</span>
                                    <span className="font-bold text-sm mt-0.5">{ef !== undefined ? ef.toFixed(1) : '-'}</span>
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1.5 rounded-lg text-sm font-extrabold ${
                                  finalAverage >= 8.0 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : finalAverage >= 6.0 
                                      ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                      : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {finalAverage > 0 ? finalAverage.toFixed(1) : '0.0'}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                      {materiasList.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 text-xs font-medium">
                              No hay materias registradas en el plan de estudios.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-4 italic">
                  Las calificaciones y promedios son de solo lectura y se sincronizan en tiempo real con Google Sheets.
                </p>
              </div>
            ) : selectedAlumnoName.trim() !== '' ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center">
                <Search size={36} className="text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-700 text-sm mb-1">Seleccione un tipo de Kardex</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Por favor haga clic en el botón de <strong>Kardex Parcial</strong> o <strong>Kardex Final</strong> arriba para consultar las calificaciones de este alumno.
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center">
                <Search size={36} className="text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-700 text-sm mb-1">Consulta de Kardex de Calificaciones</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Por favor ingrese el nombre completo del alumno en el campo superior para habilitar la consulta de kardex, grado, grupo, maestro y calificaciones.
                </p>
              </div>
            )}
          </div>
        );
      }
      case 'materias':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Plan de Estudios y Gestión de Materias</h2>
                  <p className="text-xs text-slate-500">Asignaturas y profesores sincronizados con Google Sheets y Google Drive</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    if (playClickSound) playClickSound();
                    setDirectTablePrintType('materias');
                    setIsDirectTablePrintModalOpen(true);
                  }}
                  className="bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                  title="Imprimir plan general de materias"
                >
                  <Printer size={18} />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button 
                  onClick={exportMateriasToCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                  title="Exportar materias a Excel"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Exportar a Excel</span>
                </button>
                <button 
                  onClick={handleOpenCreateMateria}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Nueva Materia</span>
                </button>
              </div>
            </div>

            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar por materia, profesor o clave..."
                  value={materiaSearchQuery}
                  onChange={(e) => setMateriaSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Total Materias en Plan de Estudios: <span className="font-bold text-slate-800">{materiasList.length}</span> (Sincronizado con Drive & Sheets)
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Clave</th>
                    <th className="py-3 px-4">Materia / Asignatura</th>
                    <th className="py-3 px-4">Grado Escolar</th>
                    <th className="py-3 px-4">Profesor Asignado</th>
                    <th className="py-3 px-4">Créditos</th>
                    <th className="py-3 px-4">Área / Nivel</th>
                    <th className="py-3 px-4">Estatus</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {materiasList
                    .filter(m => `${m.nombre} ${m.profesor} ${m.clave || ''} ${m.area || ''} ${m.grado || ''}`.toLowerCase().includes(materiaSearchQuery.toLowerCase()))
                    .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          {item.clave || `MAT-${item.id.slice(-4)}`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0 border border-indigo-100">
                            <BookOpen size={16} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{item.nombre}</div>
                            <div className="text-[11px] text-slate-400">{item.area || 'Tronco Común'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold ${
                          item.grado && item.grado !== 'Todos'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {item.grado || 'Todos los grados'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
                            <TeacherIcon size={13} />
                          </div>
                          <span className="text-slate-700 font-medium text-xs">{item.profesor || 'Sin asignar'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {item.creditos} Créditos
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {item.area || 'Tronco Común'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.estatus || 'Activa'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditMateria(item)}
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar materia"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteMateria(item.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar del plan"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {materiasList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        No hay materias registradas en el plan de estudios.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal para Nueva / Edición de Materia */}
            {isMateriaModalOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <BookOpen size={20} className="text-blue-600" />
                      {editingMateria ? 'Edición de Materia' : 'Nueva Materia'}
                    </h4>
                    <button
                      onClick={() => setIsMateriaModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveMateria} className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>ID / Código de Materia</span>
                        <span className="text-[10px] text-blue-600 font-normal capitalize">(Manual / Personalizable)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. MAT-101"
                        value={formIdMateria}
                        onChange={(e) => setFormIdMateria(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Clave de Materia
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. MAT-101"
                          value={formClaveMateria}
                          onChange={(e) => setFormClaveMateria(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Créditos Académicos
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          required
                          value={formCreditos}
                          onChange={(e) => setFormCreditos(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Nombre de la Materia
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Cálculo Diferencial e Integral"
                        value={formNombreMateria}
                        onChange={(e) => setFormNombreMateria(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Grado Escolar
                      </label>
                      <select
                        value={formGradoMateria}
                        onChange={(e) => setFormGradoMateria(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-800"
                      >
                        <option value="Todos">Todos los grados</option>
                        <option value="1ero">1ero (Primer Grado)</option>
                        <option value="2do">2do (Segundo Grado)</option>
                        <option value="3ro">3ro (Tercer Grado)</option>
                        <option value="4to">4to (Cuarto Grado)</option>
                        <option value="5to">5to (Quinto Grado)</option>
                        <option value="6to">6to (Sexto Grado)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Profesor Asignado
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Prof. Carlos Mendoza"
                        value={formProfesor}
                        onChange={(e) => setFormProfesor(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Área / Departamento
                      </label>
                      <select
                        value={formAreaMateria}
                        onChange={(e) => setFormAreaMateria(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="Ciencias Exactas">Ciencias Exactas</option>
                        <option value="Humanidades y Ciencias Sociales">Humanidades y Ciencias Sociales</option>
                        <option value="Lenguas y Comunicación">Lenguas y Comunicación</option>
                        <option value="Tecnología e Informática">Tecnología e Informática</option>
                        <option value="Artes y Educación Física">Artes y Educación Física</option>
                        <option value="Tronco Común">Tronco Común</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsMateriaModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm cursor-pointer"
                      >
                        {editingMateria ? 'Guardar Cambios' : 'Registrar Materia'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      case 'calificaciones':
        const solicitudesPendientes = solicitudesCambioList.filter(s => s.estado === 'pendiente');
        const isControlEscolarOrAdmin = sessionUser?.role === 'Control Escolar' || sessionUser?.role === 'Administrador' || sessionUser?.role === 'Directivo';
        const isTeacherUser = sessionUser?.role === 'Maestros' || sessionUser?.role === 'Docente';

        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Hoja de Calificaciones (Google Sheets Sincronizado)</h2>
                  <p className="text-xs text-slate-500">Registro oficial de calificaciones por alumno, materia y período</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button 
                  type="button"
                  onClick={handleOpenCreateCalif}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Nueva Calificación</span>
                </button>
              </div>
            </div>

            {/* Panel de Solicitudes de Cambio de Calificación Pendientes (Visibles a Control Escolar y Admin) */}
            {isControlEscolarOrAdmin && solicitudesPendientes.length > 0 && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 shadow-xs animate-in fade-in duration-200 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-950 text-base">
                      Solicitudes de Cambio de Calificación Pendientes ({solicitudesPendientes.length})
                    </h3>
                    <p className="text-xs text-amber-800">
                      Los profesores han expuesto motivos para modificar calificaciones en las que alcanzaron el límite de edición. Revisa y decide si apruebas o rechazas.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {solicitudesPendientes.map((sol) => (
                    <div key={sol.id} className="bg-white rounded-xl p-4 border border-amber-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">{sol.maestroNombre}</span>
                          <span>•</span>
                          <span>{sol.fechaSolicitud}</span>
                        </div>
                        <div className="text-sm font-bold text-slate-800">
                          Alumno: {sol.alumno} <span className="font-normal text-slate-600">({sol.materia} - {sol.parcial})</span>
                        </div>
                        <div className="text-xs text-slate-700 flex items-center gap-2 pt-0.5">
                          <span>Calificación registrada: <strong className="line-through text-slate-400">{sol.calificacionAnterior.toFixed(1)}</strong></span>
                          <span>➔</span>
                          <span>Propuesta: <strong className="text-emerald-700 text-sm font-bold">{sol.calificacionPropuesta.toFixed(1)}</strong></span>
                        </div>
                        <div className="text-xs text-slate-700 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 mt-1 italic">
                          <strong>Motivo del cambio:</strong> "{sol.motivo}"
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleAprobarSolicitud(sol.id)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle size={15} />
                          <span>Aprobar y Cambiar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRechazarSolicitud(sol.id)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle size={15} />
                          <span>Rechazar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar por alumno o materia..."
                  value={califSearchQuery}
                  onChange={(e) => setCalifSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Total Registros: <span className="font-bold text-slate-800">{calificacionesList.length}</span> (Sincronizado con Drive)
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Alumno</th>
                    <th className="py-3 px-4">Materia</th>
                    <th className="py-3 px-4">Parcial / Período</th>
                    <th className="py-3 px-4">Calificación</th>
                    <th className="py-3 px-4">Estado / Edición</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {calificacionesList
                    .filter(c => c.alumno.toLowerCase().includes(califSearchQuery.toLowerCase()) || c.materia.toLowerCase().includes(califSearchQuery.toLowerCase()))
                    .map((item) => {
                      const editCount = item.modificacionesCount || 0;
                      const isLockedForTeacher = isTeacherUser && editCount >= 1;
                      const hasPendingReq = item.solicitudPendiente && item.solicitudPendiente.estado === 'pendiente';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-800">{item.alumno}</td>
                          <td className="py-3 px-4 text-slate-600">{item.materia}</td>
                          <td className="py-3 px-4 text-slate-600">{item.parcial}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${item.calificacion >= 9 ? 'bg-emerald-50 text-emerald-700' : item.calificacion >= 7 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                              {item.calificacion.toFixed(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {hasPendingReq ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-lg border border-amber-200">
                                <Clock size={12} />
                                <span>Solicitud enviada a Control Escolar</span>
                              </span>
                            ) : isLockedForTeacher ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-lg border border-slate-200">
                                <Lock size={12} className="text-amber-600" />
                                <span>Edición Bloqueada (1 mod. realizada)</span>
                              </span>
                            ) : editCount === 1 ? (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-md">
                                <span>1 Modificación realizada</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">Sin modificaciones</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isLockedForTeacher ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCalif(item)}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Límite alcanzado. Clic para exponer motivo y solicitar cambio a Control Escolar"
                                >
                                  <Lock size={14} className="text-amber-700" />
                                  <span>Solicitar Cambio</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCalif(item)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edición de calificación"
                                >
                                  <Edit3 size={16} />
                                </button>
                              )}

                              {isControlEscolarOrAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCalif(item.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {calificacionesList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                        No hay registros de calificaciones.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal de Solicitud de Cambio de Calificación (Maestro -> Control Escolar) */}
            {isSolicitudModalOpen && solicitudCalifTarget && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-amber-50/70 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">Solicitud de Cambio de Calificación</h3>
                        <p className="text-xs text-amber-800 font-medium">Límite de edición directa alcanzado (1 modificación realizada)</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSolicitudModalOpen(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg text-sm transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSendSolicitudCambio} className="p-6 space-y-4">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
                      <p><strong>Alumno:</strong> {solicitudCalifTarget.alumno}</p>
                      <p><strong>Materia:</strong> {solicitudCalifTarget.materia}</p>
                      <p><strong>Período:</strong> {solicitudCalifTarget.parcial}</p>
                      <p><strong>Calificación Actual:</strong> <span className="font-bold text-slate-900 text-sm">{solicitudCalifTarget.calificacion.toFixed(1)}</span></p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Nueva Calificación Propuesta (0 - 10)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        required
                        value={solicitudNuevaVal}
                        onChange={(e) => setSolicitudNuevaVal(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Motivo o Exposición del Cambio <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Explique el motivo por el cual solicita modificar la calificación (ej. revisión presencial de examen, corrección de captura, etc.)..."
                        value={solicitudMotivo}
                        onChange={(e) => setSolicitudMotivo(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Esta solicitud llegará a Control Escolar en forma de aviso prioritario para su evaluación y aprobación.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsSolicitudModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                      >
                        <Send size={16} />
                        <span>Enviar Motivo a Control Escolar</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal para Captura Manual y Captura Rápida (Excel e Imagen IA) */}
            <CalificacionesModal
              isOpen={isCalifModalOpen}
              onClose={() => setIsCalifModalOpen(false)}
              editingCalif={editingCalif}
              alumnosList={alumnosList}
              materiasList={materiasList}
              initialTab={califModalInitialTab}
              initialQuickMode={califModalInitialQuickMode}
              onSaveManual={handleSaveManualCalif}
              onSaveBatch={handleSaveBatchCalif}
              playClickSound={playClickSound}
              playSuccessSound={playSuccessSound}
              playErrorSound={playErrorSound}
            />
          </div>
        );
      case 'maestros':
        const teachersData = systemUsers.filter(u => u.role === 'Maestros' || u.role === 'Docente' || u.role === 'Directivo');
        const filteredTeachers = teachersData.filter(t => 
          `${t.name} ${t.username} ${t.email} ${t.role} ${t.id}`.toLowerCase().includes(maestroSearchQuery.toLowerCase())
        );
        
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <TeacherIcon size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Plantilla y Gestión de Maestros / Docentes</h2>
                  <p className="text-xs text-slate-500">Expedientes de profesores y asignación académica sincronizados con Google Sheets y Google Drive</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    if (playClickSound) playClickSound();
                    setDirectTablePrintType('maestros');
                    setIsDirectTablePrintModalOpen(true);
                  }}
                  className="bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                  title="Imprimir plantilla general de docentes"
                >
                  <Printer size={18} />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
                <button 
                  onClick={exportMaestrosToCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                  title="Exportar plantilla a Excel"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Exportar a Excel</span>
                </button>
                <button 
                  onClick={handleOpenCreateMaestro}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Nuevo Maestro</span>
                </button>
              </div>
            </div>

            {/* Search and stats */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar por nombre, usuario, rol o correo..."
                  value={maestroSearchQuery}
                  onChange={(e) => setMaestroSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Total Docentes Registrados: <span className="font-bold text-slate-800">{teachersData.length}</span> (Sincronizado con Drive & Sheets)
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Cédula / ID</th>
                    <th className="py-3 px-4">Maestro / Docente</th>
                    <th className="py-3 px-4">Rol / Categoría</th>
                    <th className="py-3 px-4">Contacto / Correo</th>
                    <th className="py-3 px-4">Estatus</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          DOC-{teacher.id.slice(-4)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0 border border-blue-100">
                            {teacher.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{teacher.name}</div>
                            <div className="text-[11px] text-slate-400">@{teacher.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                          {teacher.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-600 text-xs flex items-center gap-1.5">
                          <Mail size={13} className="text-slate-400" />
                          <span>{teacher.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${teacher.status === 'Activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {teacher.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditMaestro(teacher)}
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar expediente docente"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(teacher.id)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title={teacher.status === 'Activo' ? 'Desactivar acceso' : 'Activar acceso'}
                          >
                            {teacher.status === 'Activo' ? <UserCheck size={16} /> : <UserX size={16} />}
                          </button>
                          <button
                            onClick={() => handleDeleteMaestro(teacher.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar de la plantilla"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTeachers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No hay maestros o docentes registrados con el criterio de búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal para Nuevo / Editar Maestro */}
            {isMaestroModalOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <TeacherIcon size={20} className="text-blue-600" />
                      {editingMaestro ? 'Editar Perfil Docente' : 'Alta de Nuevo Maestro / Docente'}
                    </h4>
                    <button
                      onClick={() => setIsMaestroModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveMaestro} className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>ID / Clave de Maestro</span>
                        <span className="text-[10px] text-blue-600 font-normal capitalize">(Manual / Personalizable)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. MAE-101"
                        value={formMaestroId}
                        onChange={(e) => setFormMaestroId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Nombre Completo del Docente
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Prof. Carlos Mendoza Morales"
                        value={formMaestroName}
                        onChange={(e) => setFormMaestroName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Usuario (Login)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. cmendoza"
                          value={formMaestroLogin}
                          onChange={(e) => setFormMaestroLogin(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Contraseña de Acceso
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Pass123"
                          value={formMaestroPassword}
                          onChange={(e) => setFormMaestroPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Correo Electrónico Institucional
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="Ej. carlos.mendoza@escuela.edu.mx"
                        value={formMaestroEmail}
                        onChange={(e) => setFormMaestroEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Rol en el Sistema
                        </label>
                        <select
                          value={formMaestroRole}
                          onChange={(e) => setFormMaestroRole(e.target.value as any)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="Maestros">Maestros (Portal Docente)</option>
                          <option value="Directivo">Directivo (Control Escolar y Maestros)</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Directivo tiene acceso a Control Escolar y Maestros (Administrador y Kardex Alumnos apagados). Maestros solo a su portal.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Estado de la Cuenta
                        </label>
                        <select
                          value={formMaestroStatus}
                          onChange={(e) => setFormMaestroStatus(e.target.value as any)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="Activo">Activo</option>
                          <option value="Inactivo">Inactivo</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsMaestroModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm cursor-pointer"
                      >
                        {editingMaestro ? 'Guardar Cambios' : 'Registrar Maestro'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      case 'avisos':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <Bell size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Avisos y Tareas Programadas</h2>
                  <p className="text-xs text-slate-500">Gestión de comunicados y recordatorios de eventos</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleOpenCreateAviso('personal')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Mail size={18} />
                  <span>Aviso Personal</span>
                </button>
                {sessionUser?.role !== 'Maestros' && sessionUser?.role !== 'Docente' && (
                  <button 
                    onClick={() => handleOpenCreateAviso('publico')}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <Users size={18} />
                    <span>Aviso Público</span>
                  </button>
                )}
                <button 
                  onClick={() => handleOpenCreateAviso('tarea')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Calendar size={18} />
                  <span>Tarea Programada</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {avisosList.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Bell size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">No hay avisos ni tareas programadas.</p>
                </div>
              ) : (
                avisosList.map((aviso) => (
                  <div key={aviso.id} className={`p-5 rounded-xl border ${aviso.type === 'tarea' ? 'bg-amber-50 border-amber-100' : aviso.type === 'publico' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${aviso.type === 'tarea' ? 'bg-amber-100 text-amber-600' : aviso.type === 'publico' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
                          {aviso.type === 'tarea' ? <Calendar size={18} /> : aviso.type === 'publico' ? <Users size={18} /> : <Mail size={18} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${aviso.type === 'tarea' ? 'bg-amber-200 text-amber-800' : aviso.type === 'publico' ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-700'}`}>
                              {aviso.type === 'tarea' ? 'Tarea Programada' : aviso.type === 'publico' ? 'Aviso Público' : 'Aviso Personal'}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{aviso.timestamp}</span>
                          </div>
                          <p className="text-sm text-slate-800 font-medium mb-1">
                            {aviso.type === 'personal' && `De: ${aviso.senderName} Para: ${aviso.targetName || 'Desconocido'}`}
                            {aviso.type === 'publico' && `De: ${aviso.senderName} Para: Todos`}
                            {aviso.type === 'tarea' && `Fecha programada: ${aviso.date} (Por: ${aviso.senderName})`}
                          </p>
                          <p className="text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-100 mt-2">{aviso.message}</p>
                        </div>
                      </div>
                      {(sessionUser?.role === 'Administrador' || sessionUser?.role === 'Control Escolar' || sessionUser?.role === 'Directivo' || aviso.senderId === sessionUser?.id) && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button 
                            onClick={() => handleOpenEditAviso(aviso)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteAviso(aviso.id)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'reportes':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Reportes Académicos y Estadísticas</h2>
                  <p className="text-xs text-slate-500">Generación de boletines, reportes de profesores y analíticas de rendimiento</p>
                </div>
              </div>
              <button 
                onClick={() => alert('Generando reporte consolidado PDF/Excel')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <FileSpreadsheet size={18} />
                <span>Exportar Consolidado</span>
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div 
                className="p-5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group" 
                onClick={() => {
                  playClickSound();
                  setIsBoletinGeneralModalOpen(true);
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <FileSpreadsheet size={20} />
                  </div>
                  <h3 className="font-semibold text-slate-800 group-hover:text-blue-800 transition-colors">Boletín General</h3>
                </div>
                <p className="text-xs text-slate-500">Expedientes y reportes oficiales con 3 módulos: lista de alumnos, kardex de calificaciones y lista de asistencia.</p>
              </div>

              <div 
                className="p-5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group" 
                onClick={() => {
                  playClickSound();
                  setIsInformeGeneralModalOpen(true);
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg group-hover:bg-emerald-200 transition-colors">
                    <FileText size={20} />
                  </div>
                  <h3 className="font-semibold text-slate-800 group-hover:text-emerald-800 transition-colors">Informe General de Actividades</h3>
                </div>
                <p className="text-xs text-slate-500">Métricas, consolidado y reportes detallados de ciclo escolar, docentes y alumnos en tiempo real.</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-6 bg-blue-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Sincronización en la Nube</h4>
                <p className="text-xs text-slate-600 mt-0.5">Todos los reportes generados se respaldan automáticamente en Google Drive.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-medium text-slate-700">Conectado a Google Drive</span>
              </div>
            </div>
          </div>
        );
      case 'administrador':
        return (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header & Sub-Tabs Nav */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <ShieldCheck size={26} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Panel de Administrador</h2>
                    <p className="text-xs text-slate-500">Gestión de sistema, almacenamiento en la nube, usuarios y auditoría</p>
                  </div>
                </div>
                <button 
                  onClick={() => setCurrentView('avisos')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer shrink-0"
                >
                  <Bell size={18} />
                  <span>Administrar Avisos</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-2 pt-4">
                <button
                  id="tab-admin-config"
                  onClick={() => setAdminTab('config')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    adminTab === 'config'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Settings size={18} />
                  <span>Configuración & Almacenamiento</span>
                </button>

                <button
                  id="tab-admin-usuarios"
                  onClick={() => setAdminTab('usuarios')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    adminTab === 'usuarios'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <UserCog size={18} />
                  <span>Usuarios & Roles</span>
                </button>

                <button
                  id="tab-admin-seguridad"
                  onClick={() => setAdminTab('seguridad')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    adminTab === 'seguridad'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Shield size={18} />
                  <span>Seguridad & Auditoría</span>
                </button>

                <button
                  id="tab-admin-respaldos"
                  onClick={() => setAdminTab('respaldos')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    adminTab === 'respaldos'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Database size={18} />
                  <span>Respaldos</span>
                </button>

                <button
                  id="tab-admin-parametros"
                  onClick={() => setAdminTab('parametros')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    adminTab === 'parametros'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Settings size={18} />
                  <span>Parámetros Académicos</span>
                </button>

                <button
                  id="tab-admin-centro-escolar"
                  onClick={() => {
                    playClickSound();
                    setAdminTab('centro-escolar');
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    adminTab === 'centro-escolar'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <School size={18} />
                  <span>Centro Escolar</span>
                </button>
              </div>
            </div>

            {/* Sub-tab Content */}
            {adminTab === 'config' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-8 text-center border-b border-slate-100">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Settings size={28} />
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-800 mb-3">Configuración de Almacenamiento (Google Drive & Sheets)</h3>
                  <p className="text-slate-600 max-w-2xl mx-auto text-sm leading-relaxed">
                    SysAcad utiliza tu Google Drive como base de datos centralizada y repositorio de reportes. 
                    Al inicializar, se crearán las carpetas del sistema y la base de datos en Google Sheets con las tablas estructuradas.
                  </p>
                </div>

                <div className="p-8 bg-slate-50 flex flex-col items-center">
                  <div className="w-full max-w-lg space-y-6">
                    {/* Card 0: Identidad de la Institución */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <School size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">Identidad de la Institución</h4>
                            <p className="text-xs text-slate-500">Personaliza el logotipo y nombre de la escuela visible en el inicio de sesión</p>
                          </div>
                        </div>
                        {savedInstitutionNameMsg && (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5 animate-in fade-in">
                            <CheckCircle2 size={14} /> ¡Guardado!
                          </span>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                              Nombre de la Institución / Escuela
                            </label>
                            <span className="text-[10px] text-blue-600 font-semibold">
                              Aparece en inicio de sesión y reportes
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={institutionName}
                              onChange={(e) => handleInstitutionNameChange(e.target.value)}
                              placeholder="ej. Centro Educativo Villa Montessori"
                              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => handleInstitutionNameChange(institutionName)}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle2 size={15} />
                              <span>Guardar</span>
                            </button>
                          </div>

                          {/* Quick presets */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="text-[11px] text-slate-400 font-medium self-center mr-1">Opciones rápidas:</span>
                            <button
                              type="button"
                              onClick={() => handleInstitutionNameChange('Centro Educativo Villa Montessori de Morelia')}
                              className="text-[11px] px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold transition-colors cursor-pointer border border-blue-200"
                            >
                              Centro Educativo Villa Montessori de Morelia
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInstitutionNameChange('Centro Educativo Villa Montessori')}
                              className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer border border-slate-200"
                            >
                              Villa Montessori
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInstitutionNameChange('SysAcad')}
                              className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-medium transition-colors cursor-pointer border border-slate-200"
                            >
                              SysAcad (Por defecto)
                            </button>
                          </div>
                        </div>

                        {/* Live Preview Box */}
                        <div className="bg-slate-900 rounded-xl p-4 text-center border border-slate-800 shadow-inner">
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                            Vista Previa en Ventana de Inicio de Sesión
                          </p>
                          <h4 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-snug px-2 break-words">
                            {institutionName || 'Centro Educativo Villa Montessori de Morelia'}
                          </h4>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold uppercase tracking-wider mt-2">
                            <School size={13} className="text-blue-400" />
                            <span>SysAcad • Control Escolar y Académico</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Logotipo de la Institución
                          </label>
                          
                          <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
                              {institutionLogo ? (
                                <img src={institutionLogo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <GraduationCap size={24} className="text-slate-400" />
                              )}
                              <div className="logo-star">✦</div>
                            </div>

                            <div className="flex-1 space-y-2">
                              <label className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer">
                                <span>Subir Imagen</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoUpload}
                                  className="hidden"
                                />
                              </label>
                              
                              {institutionLogo && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInstitutionLogo('');
                                    localStorage.removeItem('sysacad_institution_logo');
                                    setSavedInstitutionNameMsg(true);
                                    setTimeout(() => setSavedInstitutionNameMsg(false), 2000);
                                  }}
                                  className="ml-2 inline-flex items-center px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                >
                                  Eliminar
                                </button>
                              )}
                              <p className="text-[10px] text-slate-400">PNG o JPG cuadrado. Se guardará y mostrará en login y reportes.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 1: Correo Electrónico y Conexión con Google */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <Mail size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">Correo Electrónico y Cuenta Google</h4>
                          <p className="text-xs text-slate-500">Administrador y permisos para Google Drive / Sheets</p>
                        </div>
                      </div>

                      {/* Input Correo Administrador */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                            Correo Electrónico del Administrador
                          </label>
                          {adminEmail && (
                            isGoogleEmailDomain(adminEmail) ? (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={12} /> Correo de Google
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ShieldAlert size={12} /> No es de Google
                              </span>
                            )
                          )}
                        </div>

                        <input
                          type="email"
                          value={adminEmail}
                          onChange={(e) => handleAdminEmailChange(e.target.value)}
                          onBlur={handleAdminEmailBlur}
                          placeholder="ejemplo@gmail.com"
                          className={`w-full px-4 py-3 border rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 mb-2 transition-all ${
                            adminEmail && !isGoogleEmailDomain(adminEmail)
                              ? 'bg-red-50/50 border-red-300 focus:ring-red-500/20 focus:border-red-500'
                              : 'bg-slate-50 border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                          }`}
                        />

                        {adminEmail && !isGoogleEmailDomain(adminEmail) && (
                          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center justify-between gap-2 mb-2">
                            <span>⚠️ Solo se permiten correos de Google (@gmail.com o Workspace).</span>
                            <button
                              type="button"
                              onClick={() => {
                                setInvalidEmailAttempt(adminEmail);
                                setShowNonGoogleEmailModal(true);
                              }}
                              className="underline font-bold text-red-800 cursor-pointer text-[11px] shrink-0"
                            >
                              Ver aviso
                            </button>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Este correo debe ser una cuenta de Google para respaldar carpetas en Google Drive y hojas de Google Sheets.
                        </p>
                      </div>

                      {token && user?.email ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>Sesión de Google Activa: <strong>{user.email}</strong></span>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-slate-400 shrink-0" />
                          <span>Listo para vincular con el botón de sincronización de abajo.</span>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Estado de la Base de Datos y Enlaces */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                      {status.type === 'error' && (
                        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 text-sm space-y-3">
                          <div className="flex items-start gap-2">
                            <ShieldAlert size={18} className="shrink-0 text-red-600 mt-0.5" />
                            <span className="leading-snug font-medium">{status.message}</span>
                          </div>
                          {status.message.includes('origin_mismatch') && (
                            <div className="p-3 bg-white rounded-lg border border-red-200 text-xs text-slate-700 space-y-2">
                              <p className="font-semibold text-slate-900">Origen actual de este dispositivo:</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 bg-slate-100 px-2 py-1.5 rounded font-mono text-[11px] text-blue-700 select-all break-all border border-slate-200">
                                  {typeof window !== 'undefined' ? window.location.origin : ''}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (typeof window !== 'undefined') {
                                      navigator.clipboard.writeText(window.location.origin);
                                      playSuccessSound();
                                      alert('¡Origen copiado al portapapeles! Pégalo en Google Cloud Console > Credenciales > Tu ID de Cliente OAuth > Orígenes de JavaScript autorizados.');
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shrink-0 cursor-pointer"
                                >
                                  Copiar
                                </button>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                <strong>Cómo resolverlo:</strong> En tu Google Cloud Console, ve a <em>APIs y Servicios &gt; Credenciales &gt; ID de cliente OAuth 2.0</em> y agrega la URL copiada en <strong>"Orígenes de JavaScript autorizados"</strong>.
                              </p>
                              <div className="mt-1 pt-1.5 border-t border-slate-100 text-[11px] text-emerald-700 font-medium">
                                💡 <strong>Aviso:</strong> Si ya vinculaste Google Workspace en tu computadora, la base de datos central ya sincroniza usuarios, alumnos y calificaciones entre celular y PC en tiempo real sin requerir volver a vincular en este dispositivo.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {status.type === 'success' && (
                        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 text-center flex items-center gap-3">
                          <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                          <div className="text-left">
                            <p className="font-bold text-emerald-900 text-sm">¡Almacenamiento Sincronizado!</p>
                            <p className="text-xs text-emerald-700">Carpetas en Drive y tablas en Sheets creadas correctamente.</p>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => handleSyncWorkspace()}
                          disabled={isWorkspaceSyncing || isLoggingIn}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isWorkspaceSyncing || isLoggingIn ? (
                            <Loader2 className="animate-spin" size={18} />
                          ) : (
                            <RefreshCw size={18} />
                          )}
                          <span>
                            {isLoggingIn
                              ? 'Vinculando y autenticando con Google...'
                              : isWorkspaceSyncing
                              ? 'Sincronizando todo en automático...'
                              : !token
                              ? 'Vincular y Sincronizar en Automático (Drive & Sheets)'
                              : 'Sincronizar en Automático (Drive & Sheets)'}
                          </span>
                        </button>

                        {(workspaceResult?.cycleFolderUrl || localStorage.getItem('sysacad_cycle_folder_link')) && (
                          <a 
                            href={workspaceResult?.cycleFolderUrl || localStorage.getItem('sysacad_cycle_folder_link')!} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-white transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <Calendar className="text-indigo-500" size={20} />
                              <div className="text-left">
                                <p className="font-semibold text-slate-800 text-xs">
                                  Carpeta del Ciclo Activo ({ciclosList.find(c => c.estatus === 'Activo')?.nombre || 'CICLO ESCOLAR 2026 - 2027'})
                                </p>
                                <p className="text-[10px] text-slate-500">Google Drive (Subcarpetas y expedientes)</p>
                              </div>
                            </div>
                            <ExternalLink size={16} className="text-slate-400 group-hover:text-indigo-600" />
                          </a>
                        )}

                        {(workspaceResult?.rootFolderUrl || folderLink) && (
                          <a 
                            href={workspaceResult?.rootFolderUrl || folderLink!} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-white transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <Folder className="text-blue-500" size={20} />
                              <div className="text-left">
                                <p className="font-semibold text-slate-800 text-xs">Carpeta Principal SysAcad</p>
                                <p className="text-[10px] text-slate-500">Google Drive</p>
                              </div>
                            </div>
                            <ExternalLink size={16} className="text-slate-400 group-hover:text-blue-600" />
                          </a>
                        )}
                        
                        {(workspaceResult?.spreadsheetUrl || sheetLink) && (
                          <a 
                            href={workspaceResult?.spreadsheetUrl || sheetLink!} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-white transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <FileSpreadsheet className="text-emerald-500" size={20} />
                              <div className="text-left">
                                <p className="font-semibold text-slate-800 text-xs">Base de Datos Central (11 Tablas)</p>
                                <p className="text-[10px] text-slate-500">Google Sheets (Alumnos, Maestros, Asistencias, Calificaciones...)</p>
                              </div>
                            </div>
                            <ExternalLink size={16} className="text-slate-400 group-hover:text-emerald-600" />
                          </a>
                        )}

                        {/* List of Synchronized Google Drive Subfolders */}
                        {workspaceResult?.subfolders && workspaceResult.subfolders.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                              <span>Estructura de Carpetas en Google Drive</span>
                              <span className="text-[11px] font-normal text-slate-500">{workspaceResult.subfolders.length} carpetas</span>
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                              {workspaceResult.subfolders.map((sf, idx) => (
                                <a
                                  key={sf.id || idx}
                                  href={sf.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/40 transition-all text-xs group"
                                  title={`Abrir carpeta ${sf.name} en Google Drive`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Folder size={14} className="text-blue-500 shrink-0" />
                                    <span className="font-medium text-slate-700 truncate">{sf.name.replace(/^\d+_/, '').replace(/_/g, ' ')}</span>
                                  </div>
                                  <ExternalLink size={12} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Configuración y Asistente Google OAuth 2.0 (Para Vercel y Producción) */}
                  <div className="mt-6 bg-slate-50/70 border border-slate-200 rounded-2xl p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-200/80">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                          <Settings size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">Configuración de Google OAuth 2.0 (Vercel / Producción)</h4>
                          <p className="text-xs text-slate-500">Resuelve el error "Error 400: origin_mismatch" al registrar tu dominio y Client ID</p>
                        </div>
                      </div>
                      <a 
                        href="https://console.cloud.google.com/apis/credentials" 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        <span>Abrir Google Cloud Console</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      {/* Subcard A: Origen actual a registrar */}
                      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">1. Tu Origen Actual en el Navegador</span>
                          <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">URI Origen</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Copia esta URL exacta y agrégala en <strong>Orígenes de JavaScript autorizados</strong> dentro de tu ID de cliente en Google Cloud Console:
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={typeof window !== 'undefined' ? window.location.origin : ''}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 select-all"
                          />
                          <button
                            type="button"
                            onClick={handleCopyCurrentOrigin}
                            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                              copiedOrigin 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                          >
                            {copiedOrigin ? (
                              <>
                                <CheckCircle2 size={14} />
                                <span>¡Copiado!</span>
                              </>
                            ) : (
                              <>
                                <ClipboardList size={14} />
                                <span>Copiar Origen</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Subcard B: Client ID Personalizado */}
                      <form onSubmit={handleSaveCustomClientId} className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">2. ID de Cliente de Google (OAuth Client ID)</span>
                          {savedClientIdMsg && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={12} /> Guardado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Pega aquí tu propio Client ID creado en Google Cloud (terminado en <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.apps.googleusercontent.com</code>):
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={customClientIdInput}
                            onChange={(e) => setCustomClientIdInput(e.target.value)}
                            placeholder="65019795...apps.googleusercontent.com"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                          <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            Guardar ID
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
                      <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong className="text-slate-800">Pasos rápidos para Google Cloud Console:</strong>
                        <ol className="list-decimal list-inside mt-1 space-y-0.5 text-slate-600">
                          <li>Entra a <strong>Google Cloud Console &gt; API y servicios &gt; Credenciales</strong>.</li>
                          <li>Haz clic en tu <strong>ID de cliente de OAuth 2.0 (Aplicación web)</strong>.</li>
                          <li>En <strong>Orígenes de JavaScript autorizados</strong>, pega el origen copiado arriba (ej. <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono text-[11px]">{typeof window !== 'undefined' ? window.location.origin : 'https://tu-proyecto.vercel.app'}</code>).</li>
                          <li>Haz clic en <strong>Guardar</strong> y espera 2 a 3 minutos para que Google propague los cambios.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'usuarios' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                        <UserCog size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Gestión de Usuarios, Inscripciones y Roles</h3>
                        <p className="text-xs text-slate-500">Altas, bajas, contraseñas y enlace sincronizado con Celular / Google Sheets</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">


                      <button
                        onClick={handleForceCloudSync}
                        disabled={isSyncingUsers}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-medium py-2.5 px-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-60"
                        title="Sincronizar y respaldar usuarios con el servidor central y celular"
                      >
                        <RefreshCw size={18} className={isSyncingUsers ? 'animate-spin text-blue-600' : ''} />
                        <span>{isSyncingUsers ? 'Sincronizando...' : 'Sincronizar Nube'}</span>
                      </button>

                      <button
                        onClick={handleOpenCreateUser}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer text-sm"
                      >
                        <Plus size={18} />
                        <span>Nuevo Usuario (Alta)</span>
                      </button>
                    </div>
                  </div>

                  {/* Multi-Device Cloud Sync Banner */}
                  <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-100/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5 sm:mt-0 shadow-sm">
                        <Smartphone size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Puente Nube PC ⟷ Celular Activo
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {systemUsers.length} cuentas disponibles en todos tus dispositivos
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Los docentes y usuarios registrados aquí se sincronizan automáticamente con tu celular. Pueden iniciar sesión directamente desde su teléfono sin necesidad de vincular Google Sheets.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {workspaceResult?.spreadsheetId && (
                        <button
                          onClick={handleManualSyncUsers}
                          disabled={isSyncingUsers}
                          className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="Guardar una copia de estos usuarios en Google Sheets (pestaña Usuarios_Sistema)"
                        >
                          <FileSpreadsheet size={15} className="text-emerald-600" />
                          <span>Respaldar en Sheet</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {syncFeedbackMessage && (
                    <div className="mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>{syncFeedbackMessage}</span>
                    </div>
                  )}

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                      <p className="text-xs text-slate-500 font-medium">Total Cuentas</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{systemUsers.length}</p>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-xl bg-emerald-50/50 border-emerald-100">
                      <p className="text-xs text-emerald-700 font-medium">Activos</p>
                      <p className="text-2xl font-bold text-emerald-900 mt-1">{systemUsers.filter(u => u.status === 'Activo').length}</p>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-xl bg-amber-50/50 border-amber-100">
                      <p className="text-xs text-amber-700 font-medium">Inactivos (Bajas)</p>
                      <p className="text-2xl font-bold text-amber-900 mt-1">{systemUsers.filter(u => u.status === 'Inactivo').length}</p>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-xl bg-blue-50/50 border-blue-100">
                      <p className="text-xs text-blue-700 font-medium">Control Escolar / Docentes</p>
                      <p className="text-2xl font-bold text-blue-900 mt-1">{systemUsers.filter(u => u.role !== 'Administrador').length}</p>
                    </div>
                  </div>

                  {/* Filters & Search */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, usuario o correo..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div className="sm:w-56">
                      <select
                        value={userRoleFilter}
                        onChange={(e) => setUserRoleFilter(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="todos">Todos los Roles</option>
                        <option value="administrador">Administrador</option>
                        <option value="control escolar">Control Escolar</option>
                        <option value="maestros">Maestros</option>
                        <option value="directivo">Directivo</option>
                      </select>
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                            <th className="py-3 px-4">Usuario / Nombre</th>
                            <th className="py-3 px-4">Credenciales</th>
                            <th className="py-3 px-4">Rol Asignado</th>
                            <th className="py-3 px-4">Estado</th>
                            <th className="py-3 px-4">Último Acceso</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                                No se encontraron usuarios con los filtros seleccionados.
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0 border border-blue-200">
                                      {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-slate-800">{u.name}</p>
                                      <p className="text-xs text-slate-500 flex items-center gap-1">
                                        <Mail size={12} /> {u.email}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-mono text-xs space-y-0.5">
                                    <div className="text-slate-800"><span className="text-slate-400">User:</span> <strong>{u.username}</strong></div>
                                    <div className="text-slate-500"><span className="text-slate-400">Pass:</span> {u.password || '••••••'}</div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                    u.role === 'Administrador' ? 'bg-purple-100 text-purple-800' :
                                    u.role === 'Control Escolar' ? 'bg-blue-100 text-blue-800' :
                                    u.role === 'Directivo' ? 'bg-indigo-100 text-indigo-800' :
                                    'bg-teal-100 text-teal-800'
                                  }`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                    u.status === 'Activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Activo' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                    {u.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-500">
                                  {u.lastAccess || 'Nunca'}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditUser(u)}
                                      title="Editar perfil y credenciales"
                                      className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleUserStatus(u.id)}
                                      title={u.status === 'Activo' ? 'Dar de baja (Inactivar)' : 'Activar usuario'}
                                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                        u.status === 'Activo' 
                                          ? 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600' 
                                          : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600'
                                      }`}
                                    >
                                      {u.status === 'Activo' ? <UserX size={16} /> : <UserCheck size={16} />}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      title="Eliminar usuario"
                                      className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Alta / Edición User Modal */}
                {isUserModalOpen && (
                  <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 text-lg">
                          {editingUser ? 'Editar Perfil y Credenciales' : 'Alta de Nuevo Usuario / Inscribir'}
                        </h4>
                        <button
                          onClick={() => setIsUserModalOpen(false)}
                          className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                            <span>ID de Usuario (Sistema)</span>
                            <span className="text-[10px] text-blue-600 font-normal capitalize">(Manual / Personalizable)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. USR-101"
                            value={formUserId}
                            onChange={(e) => setFormUserId(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                            Nombre Completo
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Prof. María Rodríguez"
                            value={formUserName}
                            onChange={(e) => setFormUserName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                              Usuario (Login)
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="ej. m_rodriguez"
                              value={formUserLogin}
                              onChange={(e) => setFormUserLogin(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                              Contraseña
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="••••••"
                              value={formUserPassword}
                              onChange={(e) => setFormUserPassword(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                            Correo Electrónico
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="usuario@sysacad.edu"
                            value={formUserEmail}
                            onChange={(e) => setFormUserEmail(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                              Rol Asignado
                            </label>
                            <select
                              value={formUserRole}
                              onChange={(e) => setFormUserRole(e.target.value as any)}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <option value="Administrador">Administrador (Acceso Total)</option>
                              <option value="Directivo">Directivo (Control Escolar y Maestros)</option>
                              <option value="Control Escolar">Control Escolar (Solo Control Escolar)</option>
                              <option value="Maestros">Maestros (Portal Docente)</option>
                            </select>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Directivo: control de Control Escolar y Maestros (Administrador y Kardex Alumnos apagados). Control Escolar: solo Control Escolar. Maestros: solo Maestros.
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                              Estado
                            </label>
                            <select
                              value={formUserStatus}
                              onChange={(e) => setFormUserStatus(e.target.value as any)}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                              <option value="Activo">Activo</option>
                              <option value="Inactivo">Inactivo (Baja)</option>
                            </select>
                          </div>
                        </div>

                        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setIsUserModalOpen(false)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm cursor-pointer"
                          >
                            {editingUser ? 'Guardar Cambios' : 'Registrar Alta'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {adminTab === 'seguridad' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Seguridad y Auditoría</h3>
                    <p className="text-xs text-slate-500">Historial de accesos, modificaciones y control de sesiones</p>
                  </div>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-600">
                  <p className="font-medium text-slate-800 mb-1">Estado de Seguridad: Óptimo</p>
                  <p className="text-xs text-slate-500">Autenticación OAuth 2.0 y Firebase Auth activadas para control de acceso.</p>
                </div>
              </div>
            )}

            {adminTab === 'respaldos' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Respaldos y Mantenimiento de Base de Datos</h3>
                    <p className="text-xs text-slate-500">Copias de seguridad, exportación y limpieza general del sistema</p>
                  </div>
                </div>

                {/* Status summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alumnos</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{alumnosList.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Materias</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{materiasList.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calificaciones</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{calificacionesList.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuarios Sistema</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{systemUsers.length}</p>
                  </div>
                </div>

                {/* Backup JSON Card */}
                <div className="p-5 border border-slate-200 rounded-xl bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Copia de Seguridad Completa (JSON)</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Descarga una copia completa de toda la información estructurada del sistema escolar.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadJSONBackup}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <Download size={16} />
                    <span>Descargar Respaldo JSON</span>
                  </button>
                </div>

                {/* Danger Zone: Purge & Reset Database */}
                <div className="p-5 border border-red-200 rounded-xl bg-red-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-red-800 text-sm flex items-center gap-2">
                      <ShieldAlert size={16} /> Limpiar y Vaciar Todos los Registros
                    </h4>
                    <p className="text-xs text-red-600/90 mt-0.5 max-w-xl">
                      Elimina permanentemente todos los alumnos, calificaciones, materias, avisos y usuarios secundarios. El sistema se reiniciará en blanco conservando únicamente la cuenta del <strong>Administrador Principal</strong>.
                    </p>
                  </div>
                  <button
                    onClick={handlePurgeAllSystemData}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <Trash2 size={16} />
                    <span>Vaciar Base de Datos</span>
                  </button>
                </div>
              </div>
            )}

            {adminTab === 'parametros' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                    <Settings size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Parámetros del Ciclo Lectivo</h3>
                    <p className="text-xs text-slate-500">Configuración de períodos académicos, notas mínimas y ponderaciones</p>
                  </div>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-600">
                  <p className="font-medium text-slate-800 mb-1">Período Académico Actual: Activo</p>
                  <p className="text-xs text-slate-500">Módulo para configurar períodos bimestrales/semestrales y escalas evaluativas.</p>
                </div>
              </div>
            )}

            {adminTab === 'centro-escolar' && (
              <div className="pt-2">
                <CentroEscolarView
                  initialData={centroEscolar}
                  onSave={updateCentroEscolar}
                  playSuccessSound={playSuccessSound}
                  playClickSound={playClickSound}
                  onOpenFormatsPreview={() => {
                    setIsBoletinGeneralModalOpen(true);
                  }}
                />
              </div>
            )}
          </div>
        );
      case 'usuario':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-4xl mx-auto flex flex-col items-center">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-24 h-24 rounded-full mb-4 shadow-sm" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500 mb-4 shadow-sm">
                {user?.displayName?.charAt(0) || user?.email?.charAt(0)}
              </div>
            )}
            <h2 className="text-2xl font-semibold text-slate-800 mb-1">{user?.displayName || 'Usuario'}</h2>
            <p className="text-slate-500 mb-8">{user?.email}</p>
            
            <button 
              onClick={handleLogout}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-medium py-3 px-8 rounded-xl transition-all shadow-sm flex items-center gap-2 border border-red-200 cursor-pointer"
            >
              <LogOut size={20} />
              Cerrar Sesión
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Real-time sync feedback toast */}
      {incomingSyncToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] max-w-lg w-[92%] bg-emerald-600 text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-emerald-400 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 size={22} className="shrink-0 mt-0.5 text-emerald-100" />
          <div className="flex-1 text-xs font-semibold leading-relaxed">{incomingSyncToast}</div>
          <button onClick={() => setIncomingSyncToast(null)} className="p-1 hover:bg-white/20 rounded-lg cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Manual sync modal (usable from login screen or anywhere) */}
      {isManualSyncModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                  <Smartphone size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Sincronizar Usuarios en este Dispositivo</h3>
                  <p className="text-xs text-blue-100">Importa tus docentes y usuarios registrados desde la PC</p>
                </div>
              </div>
              <button
                onClick={() => {
                  playClickSound();
                  setIsManualSyncModalOpen(false);
                  setManualSyncFeedback(null);
                }}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status of current device users */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Usuarios disponibles en este celular:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {systemUsers.length} {systemUsers.length === 1 ? 'cuenta' : 'cuentas'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                  {systemUsers.map((u) => (
                    <span
                      key={u.id || u.username}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800/80 border border-slate-700 text-slate-200 flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <strong>{u.username}</strong>
                      <span className="text-[10px] text-slate-400 font-sans">({u.role})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Feedback message */}
              {manualSyncFeedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-medium flex items-start gap-2.5 ${
                    manualSyncFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border border-red-500/30 text-red-300'
                  }`}
                >
                  {manualSyncFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
                  )}
                  <span>{manualSyncFeedback.message}</span>
                </div>
              )}

              {/* Option 1: Paste Sync Code or URL */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Opción 1: Pegar Código o Enlace desde tu PC
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  En tu PC, abre el botón <strong>"Vincular con Celular"</strong> y pulsa <em>"Copiar Código"</em> o <em>"Copiar Enlace"</em>. Pégalo aquí abajo:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSyncCodeInput}
                    onChange={(e) => setManualSyncCodeInput(e.target.value)}
                    placeholder="Pega aquí el enlace o código (ej. eyJ1c2V...)..."
                    className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-600 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => {
                      playClickSound();
                      handleApplyManualSyncCode(manualSyncCodeInput);
                    }}
                    disabled={!manualSyncCodeInput.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer shrink-0"
                  >
                    Importar
                  </button>
                </div>
              </div>

              {/* Option 2: Fetch from server */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Opción 2: Consultar Servidor Central / Nube
                </label>
                <div className="flex items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">
                    Descarga los usuarios registrados en el servidor central:
                  </span>
                  <button
                    onClick={async () => {
                      playClickSound();
                      setIsSyncingUsers(true);
                      try {
                        const res = await fetchWithBridgeFallback('/api/system-store');
                        if (res.ok) {
                          const json = await res.json();
                          if (json.success && json.data && Array.isArray(json.data.systemUsers)) {
                            const serverUsers = json.data.systemUsers;
                            const normalizedServerUsers = serverUsers.map((u: SystemUser) => ((u.role as string) === 'Docente' ? { ...u, role: 'Maestros' as const } : u));
                            setSystemUsers(normalizedServerUsers);
                            localStorage.setItem('sysacad_system_users_v2', JSON.stringify(normalizedServerUsers));
                            playSuccessSound();
                            setManualSyncFeedback({
                              type: 'success',
                              message: `¡Servidor consultado! Se sincronizaron ${serverUsers.length} cuentas registradas.`
                            });
                            return;
                          }
                        }
                        throw new Error('El servidor no devolvió usuarios adicionales.');
                      } catch (err: any) {
                        playErrorSound();
                        setManualSyncFeedback({
                          type: 'error',
                          message: err.message || 'No se pudo conectar con el servidor central.'
                        });
                      } finally {
                        setIsSyncingUsers(false);
                      }
                    }}
                    disabled={isSyncingUsers}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isSyncingUsers ? 'animate-spin text-blue-400' : ''} />
                    <span>{isSyncingUsers ? 'Consultando...' : 'Descargar'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  playClickSound();
                  setIsManualSyncModalOpen(false);
                  setManualSyncFeedback(null);
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!sessionUser ? (
          <motion.div
          key="login-view"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-500/30 font-sans relative overflow-hidden"
        >
          {/* Sound FX Toggle in Login */}
          <div className="absolute top-5 right-5 z-20">
            <button
              onClick={handleToggleSound}
              type="button"
              className="p-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2 text-xs font-semibold hover:scale-105 active:scale-95"
              title={muted ? "Activar efectos de sonido" : "Silenciar efectos de sonido"}
            >
              {muted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-emerald-400" />}
              <span className="hidden sm:inline">{muted ? "Sonido Desactivado" : "Efectos Activos"}</span>
            </button>
          </div>

          {/* Decorative Grid or Background */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-950 to-slate-950 -z-10" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10 opacity-30" />

          {/* Brand Header */}
          <div className="flex flex-col items-center mb-6 sm:mb-8 text-center px-4 animate-in fade-in slide-in-from-top-4 duration-500 w-full max-w-xl">
            <div className="relative bg-blue-600 text-white p-3 rounded-2xl shadow-xl shadow-blue-600/10 mb-3 border border-blue-500/20 flex items-center justify-center overflow-hidden w-16 h-16 sm:w-20 sm:h-20 shrink-0">
              {institutionLogo ? (
                <img src={institutionLogo} alt="Logo" className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
              ) : (
                <GraduationCap size={36} />
              )}
              <div className="logo-star">✦</div>
            </div>
            
            {/* Full Institution Name as Main Display */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug px-2 break-words">
              {institutionName || 'Centro Educativo Villa Montessori de Morelia'}
            </h1>
            
            {/* Sub-Brand Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] sm:text-xs font-bold mt-2.5 uppercase tracking-wider shadow-sm text-center">
              <School size={14} className="text-blue-400 shrink-0" />
              <span>SysAcad • Control Escolar y Académico</span>
            </div>
          </div>

          {/* Card Main */}
          <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
            
            {/* Custom Tabs */}
            {loginMode !== 'register' && loginMode !== 'forgot' && loginMode !== 'first-login-change-password' && (
              <div className="flex bg-slate-950/80 p-1 rounded-xl mb-6 border border-slate-800/60">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setLoginMode('login');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                    loginMode === 'login'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Personal Institucional
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    playLoginSuccessSound();
                    const studentUser: SystemUser = {
                      id: Date.now().toString(),
                      username: 'alumno_consulta',
                      name: 'Alumno Consulta',
                      email: '',
                      role: 'Alumno',
                      status: 'Activo',
                      lastAccess: 'Ahora'
                    };
                    setSessionUser(studentUser);
                    localStorage.setItem('sysacad_session_user', JSON.stringify(studentUser));
                    sessionStorage.setItem('sysacad_active_session_flag', 'true');
                    lastActivityRef.current = Date.now();
                    setCurrentView('kardex-alumnos');
                  }}
                  className="flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] text-slate-400 hover:text-white"
                >
                  Ingreso de Alumnos
                </button>
              </div>
            )}

            {/* Form Content */}
            {loginMode === 'login' && (
              <form onSubmit={handleLocalLoginSubmit} className="space-y-5 animate-in fade-in duration-300">
                <div className="text-center mb-1">
                  <h2 className="text-xl font-bold text-white">Inicio de Sesión</h2>
                  <p className="text-xs text-blue-400 font-semibold mt-1">
                    Portal Institucional • {institutionName || 'SysAcad'}
                  </p>
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs font-medium flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                {loginSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3.5 text-xs font-medium flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    <span>{loginSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Usuario</label>
                  <div className="metallic-ring-wrapper">
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="admin, control, maestro..."
                      className="metallic-ring-content w-full px-4 py-3 text-sm font-semibold text-white transition-all placeholder:text-slate-600"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Contraseña</label>
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setLoginError('');
                        setLoginSuccess('');
                        setLoginMode('forgot');
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="metallic-ring-wrapper">
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="metallic-ring-content w-full px-4 py-3 text-sm font-semibold text-white transition-all placeholder:text-slate-600"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                {/* CAPTCHA Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold uppercase tracking-wider text-slate-400">
                      Código de Seguridad
                    </label>
                    <span className="text-[10px] text-blue-400 font-semibold lowercase">
                      imagen captcha
                    </span>
                  </div>
                  <div className="flex gap-2.5 items-stretch h-[56px] sm:h-[60px]">
                    {/* Large Image Captcha Box */}
                    <div className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl p-1 flex items-center justify-between shadow-inner relative group overflow-hidden">
                      <div className="flex-1 min-w-0 h-full flex items-center justify-center overflow-hidden">
                        <canvas
                          ref={captchaCanvasRef}
                          width={260}
                          height={54}
                          className="w-full h-full max-h-[50px] object-contain rounded-lg shadow-sm bg-slate-950 cursor-pointer transition-opacity group-hover:opacity-90 block"
                          onClick={() => {
                            playClickSound();
                            generateCaptcha();
                          }}
                          title="Haz clic para actualizar la imagen de seguridad"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          generateCaptcha();
                        }}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
                        title="Generar nueva imagen de seguridad"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>

                    {/* Compact Code Input Box */}
                    <div className="metallic-ring-wrapper shrink-0 w-20 sm:w-24">
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="Código"
                        value={loginCaptchaInput}
                        onChange={(e) => setLoginCaptchaInput(e.target.value.toUpperCase())}
                        className="metallic-ring-content w-full h-full text-center px-1 text-sm sm:text-base font-extrabold uppercase font-mono tracking-wider text-white transition-all placeholder:text-slate-600 overflow-x-auto whitespace-nowrap"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck="false"
                      />
                    </div>
                  </div>
                </div>

                <div className="metallic-ring-wrapper button-wrapper">
                  <button
                    type="submit"
                    className="metallic-ring-content w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Lock size={16} />
                    <span>Iniciar Sesión</span>
                  </button>
                </div>

                {/* Informative Notice regarding enrollment */}
                <div className="pt-3 border-t border-slate-800/60 text-center text-xs text-slate-400">
                  <span className="leading-relaxed block">
                    ℹ️ El alta e inscripción de usuarios y alumnos se gestiona internamente desde el menú de <strong>Administrador</strong> o <strong>Control Escolar</strong> de {institutionName || 'la institución'}.
                  </span>
                </div>
              </form>
            )}

            {/* First Login Change Password Required Form */}
            {loginMode === 'first-login-change-password' && (
              <form onSubmit={handleFirstLoginPasswordChangeSubmit} className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center mb-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-2">
                    <KeyRound size={24} />
                  </div>
                  <h2 className="text-lg font-extrabold text-white">Cambio de Contraseña Obligatorio</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Es su primer inicio de sesión en <strong className="text-blue-400">{institutionName || 'la institución'}</strong>. Por seguridad institucional, configure una nueva contraseña.
                  </p>
                </div>

                {/* User details badge */}
                {pendingChangePasswordUser && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <UserCircle size={18} className="text-blue-400 shrink-0" />
                      <div>
                        <div className="font-bold text-white leading-tight">{pendingChangePasswordUser.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">@{pendingChangePasswordUser.username}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 border border-blue-500/30 text-blue-300">
                      {pendingChangePasswordUser.role}
                    </span>
                  </div>
                )}

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs font-medium flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* New Password Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nueva Contraseña
                  </label>
                  <div className="metallic-ring-wrapper relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 8 caracteres (a-z, A-Z, 0-9, @._)"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="metallic-ring-content w-full px-4 py-2.5 pr-10 text-sm font-semibold text-white transition-all placeholder:text-slate-600"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
                      title={showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Meter Component */}
                <PasswordStrengthMeter password={newPasswordInput} />

                {/* Confirm New Password Input */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Confirmar Nueva Contraseña
                  </label>
                  <div className="metallic-ring-wrapper relative">
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      required
                      placeholder="Repita su nueva contraseña"
                      value={confirmNewPasswordInput}
                      onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                      className="metallic-ring-content w-full px-4 py-2.5 pr-10 text-sm font-semibold text-white transition-all placeholder:text-slate-600"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
                      title={showConfirmNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmNewPasswordInput && (
                    <div className="text-[11px] font-semibold flex items-center gap-1.5 mt-1">
                      {newPasswordInput === confirmNewPasswordInput ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={13} /> Las contraseñas coinciden
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1">
                          <ShieldAlert size={13} /> Las contraseñas aún no coinciden
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="metallic-ring-wrapper button-wrapper pt-2">
                  <button
                    type="submit"
                    className="metallic-ring-content w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={18} />
                    <span>Guardar y Entrar al Sistema</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setLoginError('');
                    setLoginSuccess('');
                    setPendingChangePasswordUser(null);
                    setNewPasswordInput('');
                    setConfirmNewPasswordInput('');
                    setLoginMode('login');
                  }}
                  className="w-full text-center text-xs text-slate-400 hover:text-white font-semibold transition-colors mt-2 cursor-pointer"
                >
                  Cancelar y Volver al Inicio
                </button>
              </form>
            )}

            {loginMode === 'forgot' && (
              <form onSubmit={handleLocalForgotSubmit} className="space-y-4 animate-in fade-in duration-300">
                <div className="text-center mb-1">
                  <h2 className="text-xl font-bold text-white">Recuperación de Contraseña</h2>
                  <p className="text-xs text-slate-400 mt-1">Escriba su correo para actualizar su contraseña de forma instantánea</p>
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs font-medium flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Correo o Usuario Registrado</label>
                  <div className="metallic-ring-wrapper">
                    <input
                      type="text"
                      required
                      placeholder="ejemplo@sysacad.edu o usuario"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="metallic-ring-content w-full px-4 py-3 text-sm font-semibold text-white transition-all placeholder:text-slate-600"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Nueva Contraseña</label>
                  <div className="metallic-ring-wrapper relative">
                    <input
                      type={showForgotNewPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 8 caracteres (a-z, A-Z, 0-9, @._)"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="metallic-ring-content w-full px-4 py-2.5 pr-10 text-sm font-semibold text-white transition-all placeholder:text-slate-600"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
                      title={showForgotNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Meter for Forgot Password */}
                <PasswordStrengthMeter password={forgotNewPassword} />

                <div className="metallic-ring-wrapper button-wrapper pt-1">
                  <button
                    type="submit"
                    className="metallic-ring-content w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Unlock size={16} />
                    <span>Actualizar Contraseña</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setLoginError('');
                    setLoginSuccess('');
                    setLoginMode('login');
                  }}
                  className="w-full text-center text-xs text-slate-400 hover:text-white font-semibold transition-colors mt-2 cursor-pointer"
                >
                  Volver al Inicio de Sesión
                </button>
              </form>
            )}

            {loginMode === 'student' && (
              <form onSubmit={handleStudentSubmit} className="space-y-5 animate-in fade-in duration-300">
                <div className="text-center mb-1">
                  <h2 className="text-xl font-bold text-white">Portal del Alumno</h2>
                  <p className="text-xs text-slate-400 mt-1">Consulte su Kardex de calificaciones directamente en el sistema</p>
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs font-medium flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Nombre Completo del Alumno</label>
                  <div className="metallic-ring-wrapper">
                    <input
                      type="text"
                      required
                      placeholder="ej. Juan Pérez García"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="metallic-ring-content w-full px-4 py-3 text-sm font-semibold text-white transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-2.5">
                    🛡️ No es necesario ingresar correo electrónico ni contraseña para alumnos. Solo ingrese su nombre para acceder al historial de calificaciones de su kardex.
                  </p>
                </div>

                <div className="metallic-ring-wrapper button-wrapper">
                  <button
                    type="submit"
                    className="metallic-ring-content w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <GraduationCap size={18} />
                    <span>Ingresar al Sistema</span>
                  </button>
                </div>
              </form>
            )}

          </div>

          {/* Footer in Login Screen */}
          <footer className="mt-8 text-center text-xs font-medium animate-in fade-in duration-500">
            <p className="flex items-center justify-center gap-1.5 text-slate-400">
              {institutionLogo ? (
                <div className="relative">
                  <img src={institutionLogo} alt="Logo" className="w-5 h-5 object-contain shrink-0" referrerPolicy="no-referrer" />
                  <div className="logo-star small">✦</div>
                </div>
              ) : (
                <div className="relative">
                  <GraduationCap size={16} className="text-blue-500" />
                  <div className="logo-star small" style={{ color: '#60a5fa' }}>✦</div>
                </div>
              )}
              <span className="font-extrabold text-slate-200">SysAcad</span> — Sistema de Administración Académica y Control Escolar
            </p>
            <p className="text-slate-500 text-[11px] mt-1">© 2026 {institutionName || 'SysAcad'}. Todos los derechos reservados.</p>
          </footer>
        </motion.div>
      ) : (
        <motion.div
          key="dashboard-view"
          initial={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans selection:bg-blue-200"
        >
      
      {/* Sidebar - Fixed Width */}
      <aside 
        className={`bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col relative z-20 overflow-hidden transition-[width] duration-300 ease-in-out ${
          isSidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div 
          className="w-64 h-full flex flex-col relative shrink-0"
        >
          <div className="p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 truncate min-w-0">
              <div className="relative bg-blue-600 text-white p-2 rounded-lg shadow-sm shrink-0 flex items-center justify-center overflow-hidden w-9 h-9">
                {institutionLogo ? (
                  <img src={institutionLogo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <GraduationCap size={20} />
                )}
                <div className="logo-star small">✦</div>
              </div>
              <div className="truncate min-w-0">
                <h1 className="text-lg font-bold text-white leading-tight truncate">SysAcad</h1>
                <p className="text-xs text-slate-400 font-medium truncate">Control Académico</p>
              </div>
            </div>
            <button
              id="sidebar-hide-btn"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
              title="Ocultar menú lateral"
              aria-label="Ocultar menú"
            >
              <PanelLeftClose size={20} />
            </button>
          </div>
          
          <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto overflow-x-hidden sidebar-scrollbar">
            <button 
              id="nav-admin-btn"
              onClick={() => {
                if (isMenuAllowed('administrador')) {
                  playNavigateSound();
                  setCurrentView('administrador');
                }
              }}
              disabled={!isMenuAllowed('administrador')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-left ${
                !isMenuAllowed('administrador')
                  ? 'opacity-30 cursor-not-allowed select-none text-slate-500 bg-slate-900/40'
                  : currentView === 'administrador'
                  ? 'bg-blue-600 text-white shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                  : 'hover:bg-slate-800 hover:text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <ShieldCheck size={20} className={`shrink-0 ${!isMenuAllowed('administrador') ? 'text-slate-600' : 'text-slate-300'}`} />
              <span className="font-medium truncate flex-1">Administrador</span>
              {!isMenuAllowed('administrador') && <Lock size={14} className="text-slate-600 shrink-0" />}
            </button>
            
            {/* Control Escolar with submenus: Alumnos, Materias, Reportes */}
            <div className={`space-y-1 transition-opacity ${!isMenuAllowed('control-escolar') ? 'opacity-30 select-none' : ''}`}>
              <button 
                onClick={() => {
                  if (isMenuAllowed('control-escolar')) {
                    playClickSound();
                    setIsControlEscolarSubOpen(!isControlEscolarSubOpen);
                  }
                }}
                disabled={!isMenuAllowed('control-escolar')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all text-left ${
                  !isMenuAllowed('control-escolar')
                    ? 'cursor-not-allowed text-slate-500 bg-slate-900/40'
                    : currentView === 'control-escolar' || currentView === 'alumnos' || currentView === 'ciclo-escolar' || currentView === 'materias' || currentView === 'maestros' || currentView === 'reportes' || currentView === 'avisos' || currentView === 'centro-escolar'
                    ? 'bg-slate-800/80 text-white font-medium cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                    : 'hover:bg-slate-800 hover:text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <ClipboardList size={20} className={`shrink-0 ${!isMenuAllowed('control-escolar') ? 'text-slate-600' : 'text-blue-400'}`} />
                  <span className="font-medium truncate">Control Escolar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isMenuAllowed('control-escolar') ? (
                    <Lock size={14} className="text-slate-600 shrink-0" />
                  ) : (
                    <span className="text-slate-400">
                      {isControlEscolarSubOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                  )}
                </div>
              </button>
              {isControlEscolarSubOpen && isMenuAllowed('control-escolar') && (
                <div className="pl-6 space-y-1 pt-1 border-l border-slate-800 ml-4 animate-in fade-in duration-200">
                  <button 
                    id="nav-alumnos-btn"
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('alumnos');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'alumnos' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Users size={16} className="shrink-0" />
                    <span className="truncate">Alumnos</span>
                  </button>
                  <button 
                    id="nav-ciclo-escolar-btn"
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('ciclo-escolar');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'ciclo-escolar' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Calendar size={16} className="shrink-0" />
                    <span className="truncate">Ciclo Escolar</span>
                  </button>
                  <button 
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('materias');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'materias' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <BookOpen size={16} className="shrink-0" />
                    <span className="truncate">Materias</span>
                  </button>
                  <button 
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('maestros');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'maestros' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <TeacherIcon size={16} className="shrink-0" />
                    <span className="truncate">Maestros</span>
                  </button>
                  <button 
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('reportes');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'reportes' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <FileText size={16} className="shrink-0" />
                    <span className="truncate">Reportes</span>
                  </button>
                  <button 
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('avisos');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'avisos' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Bell size={16} className="shrink-0" />
                    <span className="truncate">Avisos y Tareas</span>
                  </button>
                  <button 
                    id="nav-centro-escolar-btn"
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('centro-escolar');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'centro-escolar' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <School size={16} className="shrink-0" />
                    <span className="truncate">Centro Escolar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Maestros with submenu: Calificaciones */}
            <div className={`space-y-1 pt-1 transition-opacity ${!isMenuAllowed('maestros') ? 'opacity-30 select-none' : ''}`}>
              <button 
                onClick={() => {
                  if (isMenuAllowed('maestros')) {
                    playClickSound();
                    setIsMaestrosSubOpen(!isMaestrosSubOpen);
                    if (sessionUser?.role === 'Maestros' || sessionUser?.role === 'Docente') {
                      if (currentView !== 'calificaciones' && currentView !== 'avisos') {
                        setCurrentView('calificaciones');
                      }
                    }
                  }
                }}
                disabled={!isMenuAllowed('maestros')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all text-left ${
                  !isMenuAllowed('maestros')
                    ? 'cursor-not-allowed text-slate-500 bg-slate-900/40'
                    : currentView === 'calificaciones' || currentView === 'avisos'
                    ? 'bg-slate-800/80 text-white font-medium cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                    : 'hover:bg-slate-800 hover:text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <TeacherIcon size={20} className={`shrink-0 ${!isMenuAllowed('maestros') ? 'text-slate-600' : 'text-indigo-400'}`} />
                  <span className="font-medium truncate">Maestros</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isMenuAllowed('maestros') ? (
                    <Lock size={14} className="text-slate-600 shrink-0" />
                  ) : (
                    <span className="text-slate-400">
                      {isMaestrosSubOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                  )}
                </div>
              </button>
              {isMaestrosSubOpen && isMenuAllowed('maestros') && (
                <div className="pl-6 space-y-1.5 pt-1 border-l border-slate-800 ml-4 animate-in fade-in duration-200">
                  <button 
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('calificaciones');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'calificaciones' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <FileSpreadsheet size={16} className="shrink-0" />
                    <span className="truncate">Calificaciones</span>
                  </button>

                  <a 
                    href="https://planeador-escolar-nem.ai.studio"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      playClickSound();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <ClipboardList size={16} className="shrink-0 text-emerald-400" />
                      <span className="truncate">Planeaciones</span>
                    </div>
                    <ExternalLink size={12} className="text-slate-500 shrink-0" />
                  </a>
                  <button 
                    onClick={() => {
                      playNavigateSound();
                      setCurrentView('avisos');
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98] ${currentView === 'avisos' ? 'bg-blue-600 text-white shadow-sm font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Bell size={16} className="shrink-0" />
                    <span className="truncate">Avisos y Tareas</span>
                  </button>
                </div>
              )}
            </div>

            {/* Kardex Alumnos (nuevo menú abajo de maestros) */}
            <button 
              onClick={() => {
                if (isMenuAllowed('kardex-alumnos')) {
                  playNavigateSound();
                  setCurrentView('kardex-alumnos');
                }
              }}
              disabled={!isMenuAllowed('kardex-alumnos')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-left ${
                !isMenuAllowed('kardex-alumnos')
                  ? 'opacity-30 cursor-not-allowed select-none text-slate-500 bg-slate-900/40'
                  : currentView === 'kardex-alumnos'
                  ? 'bg-blue-600 text-white shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                  : 'hover:bg-slate-800 hover:text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <FileText size={20} className={`shrink-0 ${!isMenuAllowed('kardex-alumnos') ? 'text-slate-600' : 'text-cyan-400'}`} />
              <span className="font-medium truncate flex-1">Kardex Alumnos</span>
              {!isMenuAllowed('kardex-alumnos') && <Lock size={14} className="text-slate-600 shrink-0" />}
            </button>
          </nav>
          
          {sessionUser && (
            <div className="p-4 border-t border-slate-800/60 shrink-0 bg-slate-950/40">
              <div className="flex items-center gap-2.5 mb-3 px-1">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/10 shrink-0">
                  {sessionUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="truncate min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate">{sessionUser.username}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{sessionUser.role}</p>
                </div>
              </div>
              <button 
                onClick={handleLocalLogout}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 shadow-sm flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {!isSidebarOpen && (
              <button 
                id="sidebar-show-btn"
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shrink-0"
                title="Mostrar menú lateral"
                aria-label="Mostrar menú"
              >
                <Menu size={22} />
              </button>
            )}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative bg-blue-600 text-white p-2 rounded-xl shadow-sm shrink-0 flex items-center justify-center overflow-hidden w-9 h-9">
                {institutionLogo ? (
                  <img src={institutionLogo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <GraduationCap size={20} />
                )}
                <div className="logo-star small">✦</div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-black text-slate-900 tracking-tight text-base shrink-0">SysAcad</span>
                  <span className="text-slate-300 font-light shrink-0">|</span>
                  <h1 className="text-sm font-bold text-slate-800 truncate">
                    {currentView === 'administrador' ? 'Panel de Administrador' :
                     currentView === 'control-escolar' ? 'Control Escolar y Matrícula' :
                     currentView === 'alumnos' ? 'Gestión de Alumnos' :
                     currentView === 'ciclo-escolar' ? 'Gestión de Ciclos Escolares' :
                     currentView === 'kardex-alumnos' ? 'Kardex de Alumnos' :
                     currentView === 'maestros' ? 'Gestión de Maestros' :
                     currentView === 'materias' ? 'Gestión de Materias' :
                     currentView === 'calificaciones' ? 'Registro de Calificaciones' :
                     currentView === 'reportes' ? 'Reportes de Profesores' :
                     currentView === 'usuario' ? 'Perfil de Usuario' : currentView}
                  </h1>
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block truncate">
                  Sistema de Administración Académica y Control Escolar
                </p>
                {(institutionLogo || institutionName) && (
                  <div className="flex items-center gap-1.5 mt-0.5 animate-in fade-in duration-300">
                    {institutionLogo && <img src={institutionLogo} alt="Logo" className="w-3.5 h-3.5 object-contain" referrerPolicy="no-referrer" />}
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">{institutionName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct button to open QR / Mobile connection modal */}


            {/* Sound FX Button Toggle */}
            <button
              onClick={handleToggleSound}
              type="button"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-2 text-xs font-semibold hover:scale-105 active:scale-95"
              title={muted ? "Activar efectos de sonido" : "Silenciar efectos de sonido"}
            >
              {muted ? <VolumeX size={17} className="text-red-500" /> : <Volume2 size={17} className="text-emerald-600" />}
              <span className="hidden lg:inline">{muted ? "Sonido Mudo" : "Efectos Activos"}</span>
            </button>

            {sessionUser && (
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl shrink-0">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {sessionUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{sessionUser.username}</p>
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{sessionUser.role}</p>
                </div>
              </div>
            )}

            {sessionUser && (
              <button
                onClick={handleLocalLogout}
                type="button"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5 text-xs font-semibold"
                title="Cerrar sesión actual o cambiar de usuario"
              >
                <LogOut size={16} />
                <span className="hidden md:inline">Salir</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="bg-white border-t border-slate-200 px-6 py-3 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 z-10 shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <GraduationCap size={16} className="text-blue-600 shrink-0" />
            <span className="font-bold text-slate-800">SysAcad</span>
            <span className="text-slate-400 font-normal hidden sm:inline">— Sistema de Administración Académica y Control Escolar</span>
          </div>
          <div className="text-slate-400 text-[11px] font-medium">
            © 2026 {institutionName || 'SysAcad'}. Todos los derechos reservados.
          </div>
        </footer>
      </div>

      {/* Modal Emergente de Integridad de Datos: Registro Duplicado */}
      {duplicateWarning && duplicateWarning.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-amber-300 overflow-hidden text-slate-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 p-6 text-white text-center relative">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-xs rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-white/30">
                <AlertTriangle size={36} className="text-white animate-bounce" />
              </div>
              <h3 className="text-xl font-black tracking-tight">{duplicateWarning.title || '¡El Registro ya Existe!'}</h3>
              <p className="text-amber-100 text-xs font-semibold mt-1 uppercase tracking-wider">
                Control de Integridad y Duplicidad de Datos
              </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
                <p className="text-base font-extrabold text-amber-950 leading-snug">
                  {duplicateWarning.message}
                </p>
                {duplicateWarning.detail && (
                  <p className="text-xs text-amber-900 mt-2 font-medium">
                    {duplicateWarning.detail}
                  </p>
                )}
              </div>

              {duplicateWarning.existingRecordSummary && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Registro Existente Encontrado:</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 text-xs">
                    {duplicateWarning.existingRecordSummary}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                {duplicateWarning.onModify && (
                  <button
                    type="button"
                    onClick={() => {
                      duplicateWarning.onModify?.();
                    }}
                    className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-md cursor-pointer text-sm flex items-center justify-center gap-2"
                  >
                    <Edit3 size={18} />
                    <span>Modificar Registro Existente</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="w-full sm:w-auto px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all text-sm cursor-pointer"
                >
                  Entendido / Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso: Solo Cuentas de Google */}
      {showNonGoogleEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
            <div className="bg-amber-500 p-6 text-white text-center relative">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-xs rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <AlertTriangle size={36} className="text-white animate-bounce" />
              </div>
              <h3 className="text-xl font-black tracking-tight">Solo Correos de Google Permitidos</h3>
              <p className="text-amber-100 text-xs font-medium mt-1">
                Integración con Google Drive & Google Sheets
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-800 flex items-start gap-3">
                <ShieldAlert size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900 mb-1">
                    {invalidEmailAttempt ? `"${invalidEmailAttempt}" no es un correo de Google` : 'Correo no permitido'}
                  </p>
                  <p className="leading-relaxed text-slate-700">
                    Para vincular las carpetas en <strong>Google Drive</strong> y las tablas en <strong>Google Sheets</strong>, únicamente se admiten cuentas de correo de <strong>Google (@gmail.com o Google Workspace)</strong>. No se permiten proveedores externos como Hotmail, Outlook, Yahoo, etc.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-blue-950">
                  <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                  <span>Cuentas Admitidas:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                  <li>Cuentas personales: <strong>usuario@gmail.com</strong></li>
                  <li>Cuentas institucionales: <strong>Google Workspace (@escuela.edu.mx)</strong></li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowNonGoogleEmailModal(false);
                  if (invalidEmailAttempt && adminEmail === invalidEmailAttempt) {
                    if (user?.email) {
                      handleAdminEmailChange(user.email);
                    } else {
                      handleAdminEmailChange('');
                    }
                  }
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-5 rounded-2xl transition-all shadow-md cursor-pointer text-sm flex items-center justify-center gap-2"
              >
                <span>Entendido, ingresar correo de Google</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Emergente: Informe General de Actividades con KPIs Ejecutivos */}
      <InformesGeneralModal
        isOpen={isInformeGeneralModalOpen}
        onClose={() => setIsInformeGeneralModalOpen(false)}
        institutionName={institutionName}
        institutionLogo={institutionLogo}
        ciclosList={ciclosList}
        alumnosList={alumnosList}
        materiasList={materiasList}
        systemUsers={systemUsers}
        sheetLink={sheetLink}
        folderLink={folderLink}
        workspaceResult={workspaceResult}
        playClickSound={playClickSound}
        playSuccessSound={playSuccessSound}
        centroEscolar={centroEscolar}
      />

      {/* Modal Emergente: Boletín General con las 3 opciones (Lista de alumnos, Kardex de calificaciones, Lista de asistencia) */}
      <BoletinGeneralModal
        isOpen={isBoletinGeneralModalOpen}
        onClose={() => setIsBoletinGeneralModalOpen(false)}
        institutionName={institutionName}
        institutionLogo={institutionLogo}
        alumnosList={alumnosList}
        calificacionesList={calificacionesList}
        materiasList={materiasList}
        ciclosList={ciclosList}
        systemUsers={systemUsers}
        sheetLink={sheetLink}
        folderLink={folderLink}
        workspaceResult={workspaceResult}
        playClickSound={playClickSound}
        playSuccessSound={playSuccessSound}
        centroEscolar={centroEscolar}
      />

      {/* Modal Emergente: Impresión Directa de Tablas (Alumnos, Maestros, Materias) */}
      <DirectTablePrintModal
        isOpen={isDirectTablePrintModalOpen}
        onClose={() => setIsDirectTablePrintModalOpen(false)}
        type={directTablePrintType}
        institutionName={institutionName}
        institutionLogo={institutionLogo}
        alumnosList={alumnosList}
        materiasList={materiasList}
        systemUsers={systemUsers}
        ciclosList={ciclosList}
        calificacionesList={calificacionesList}
        sheetLink={sheetLink}
        folderLink={folderLink}
        workspaceResult={workspaceResult}
        playClickSound={playClickSound}
        playSuccessSound={playSuccessSound}
        centroEscolar={centroEscolar}
      />

      {/* Modal de Advertencia por Inactividad (10 minutos) */}
      <AnimatePresence>
        {isIdleWarningOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5"
            >
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400 animate-pulse">
                <Clock size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">¿Desea seguir trabajando?</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Ha transcurrido más de <span className="font-semibold text-amber-400">10 minutos sin actividad</span> en el sistema SysAcad.
                </p>
                <p className="text-xs text-slate-400">
                  Por seguridad, su sesión se cerrará automáticamente si no confirma su presencia.
                </p>
              </div>

              {/* Temporizador de Cuenta Regresiva */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-slate-200">
                <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                <span className="text-xs font-medium">Cierre automático en:</span>
                <span className="text-base font-extrabold text-amber-400 font-mono w-10 text-center">
                  {idleCountdown}s
                </span>
              </div>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStayLoggedIn}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <CheckCircle2 size={18} />
                  <span>Sí, seguir trabajando</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleLocalLogout}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <LogOut size={16} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
