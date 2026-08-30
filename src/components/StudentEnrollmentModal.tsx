import React, { useState, useEffect } from 'react';
import { 
  User, 
  MapPin, 
  PhoneCall, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  X, 
  Upload, 
  Calendar, 
  GraduationCap, 
  Users, 
  Receipt, 
  DollarSign, 
  FileText, 
  Save, 
  Printer, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface StudentFormData {
  id?: string;
  matricula: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  genero: string;
  fechaNacimiento: string;
  lugarNacimiento: string;
  nacionalidad: string;
  curp: string;
  clave: string;
  // Domicilio
  calleNumero: string;
  colonia: string;
  codigoPostal: string;
  entreCalles: string;
  municipio: string;
  estado: string;
  // Contacto
  email: string;
  celular: string;
  telefonoCasa: string;
  // Familia
  nombrePadreTutor: string;
  nombreMadre: string;
  parentescoTutor: string;
  ocupacionTutor: string;
  telefonoEmergencia: string;
  emailTutor: string;
  // Académicos
  nivel: string;
  grado: string;
  grupo: string;
  turno: string;
  escuelaProcedencia: string;
  promedioAnterior: string;
  // Facturación
  razonSocial: string;
  rfc: string;
  regimenFiscal: string;
  usoCfdi: string;
  emailFacturacion: string;
  // Conceptos
  cuotaInscripcion: string;
  colegiaturaMensual: string;
  porcentajeBeca: string;
  diaLimitePago: string;
  // Documentos
  docActaNacimiento: boolean;
  docCurp: boolean;
  docCertificadoMedico: boolean;
  docCartaConducta: boolean;
  docComprobanteDomicilio: boolean;
  docFotos: boolean;
  docComprobantePago: boolean;
  // Foto
  fotoUrl?: string;
  fechaInscripcion?: string;
  estatus?: string;
}

interface StudentEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: StudentFormData) => boolean | void;
  initialData?: StudentFormData | null;
  institutionName?: string;
  cicloEscolar?: string;
}

export const StudentEnrollmentModal: React.FC<StudentEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  institutionName = 'VILLA MONTESSORI DE MORELIA',
  cicloEscolar = 'CICLO ESCOLAR 2026-2027'
}) => {
  const [formData, setFormData] = useState<StudentFormData>({
    matricula: '',
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    genero: '',
    fechaNacimiento: '',
    lugarNacimiento: '',
    nacionalidad: 'Mexicana',
    curp: '',
    clave: '',
    calleNumero: '',
    colonia: '',
    codigoPostal: '',
    entreCalles: '',
    municipio: 'Morelia',
    estado: 'Michoacán',
    email: '',
    celular: '',
    telefonoCasa: '',
    nombrePadreTutor: '',
    nombreMadre: '',
    parentescoTutor: 'Padre',
    ocupacionTutor: '',
    telefonoEmergencia: '',
    emailTutor: '',
    nivel: 'Primaria',
    grado: '1er Grado',
    grupo: 'Grupo A',
    turno: 'Matutino',
    escuelaProcedencia: '',
    promedioAnterior: '9.0',
    razonSocial: '',
    rfc: '',
    regimenFiscal: '605 - Sueldos y Salarios',
    usoCfdi: 'D10 - Pagos por servicios educativos (colegiaturas)',
    emailFacturacion: '',
    cuotaInscripcion: '3500',
    colegiaturaMensual: '4200',
    porcentajeBeca: '0',
    diaLimitePago: '10',
    docActaNacimiento: true,
    docCurp: true,
    docCertificadoMedico: false,
    docCartaConducta: false,
    docComprobanteDomicilio: true,
    docFotos: false,
    docComprobantePago: true,
    fotoUrl: '',
    estatus: 'Activo'
  });

  // Accordion toggle states
  const [openSection, setOpenSection] = useState<{ [key: string]: boolean }>({
    familia: false,
    academicos: false,
    facturacion: false,
    conceptos: false,
    documentacion: false
  });

  const [activeTab, setActiveTab] = useState<'formulario' | 'vistaPrevia'>('formulario');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        matricula: initialData.matricula || initialData.clave || String(Math.floor(100 + Math.random() * 900)),
        nacionalidad: initialData.nacionalidad || 'Mexicana',
        municipio: initialData.municipio || 'Morelia',
        estado: initialData.estado || 'Michoacán',
        nivel: initialData.nivel || 'Primaria',
        grado: initialData.grado || '1er Grado',
        grupo: initialData.grupo || 'Grupo A',
        turno: initialData.turno || 'Matutino'
      });
    } else {
      const randomMatricula = String(Math.floor(100 + Math.random() * 900));
      setFormData({
        matricula: randomMatricula,
        nombres: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        genero: '',
        fechaNacimiento: '2018-05-14',
        lugarNacimiento: 'Morelia, Michoacán',
        nacionalidad: 'Mexicana',
        curp: '',
        clave: `ALU-${randomMatricula}`,
        calleNumero: '',
        colonia: '',
        codigoPostal: '',
        entreCalles: '',
        municipio: 'Morelia',
        estado: 'Michoacán',
        email: '',
        celular: '',
        telefonoCasa: '',
        nombrePadreTutor: '',
        nombreMadre: '',
        parentescoTutor: 'Padre',
        ocupacionTutor: '',
        telefonoEmergencia: '',
        emailTutor: '',
        nivel: 'Primaria',
        grado: '1er Grado',
        grupo: 'Grupo A',
        turno: 'Matutino',
        escuelaProcedencia: '',
        promedioAnterior: '9.0',
        razonSocial: '',
        rfc: '',
        regimenFiscal: '605 - Sueldos y Salarios',
        usoCfdi: 'D10 - Pagos por servicios educativos (colegiaturas)',
        emailFacturacion: '',
        cuotaInscripcion: '3500',
        colegiaturaMensual: '4200',
        porcentajeBeca: '0',
        diaLimitePago: '10',
        docActaNacimiento: true,
        docCurp: true,
        docCertificadoMedico: false,
        docCartaConducta: false,
        docComprobanteDomicilio: true,
        docFotos: false,
        docComprobantePago: true,
        fotoUrl: '',
        estatus: 'Activo'
      });
    }
  }, [initialData, isOpen]);

  const toggleSection = (key: string) => {
    setOpenSection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleInputChange = (field: keyof StudentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, fotoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombres.trim() || !formData.apellidoPaterno.trim()) {
      alert('Por favor ingrese al menos el Nombre y el Apellido Paterno del alumno.');
      return;
    }

    const res = onSave({
      ...formData,
      fechaInscripcion: formData.fechaInscripcion || new Date().toISOString().split('T')[0]
    });
    if (res !== false) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-auto overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Top App Bar Header like Innovat1 / SysAcad */}
        <div className="bg-[#0284c7] text-white px-6 py-4 flex items-center justify-between shadow-md relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white text-sm">
              SA
            </div>
            <div>
              <h3 className="font-bold text-base tracking-wide flex items-center gap-2">
                <span>{institutionName}</span>
                <span className="text-xs bg-amber-400/90 text-amber-950 font-bold px-2 py-0.5 rounded-full uppercase">
                  SysAcad Pro
                </span>
              </h3>
              <p className="text-xs text-sky-100 font-medium">Módulo de Control Escolar & Inscripciones</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-sky-800/60 px-3 py-1.5 rounded-xl text-xs font-semibold text-sky-100">
              <ShieldCheck size={14} className="text-sky-300" />
              <span>Sincronizado con Google Sheets</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('formulario')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'formulario'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              INSCRIPCIÓN / REINSCRIPCIÓN
            </button>
            <button
              onClick={() => setActiveTab('vistaPrevia')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'vistaPrevia'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer size={13} />
              <span>FICHA IMPRIMIBLE</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-semibold hidden md:inline">
            {cicloEscolar}
          </span>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto flex-1 p-0">
          {activeTab === 'formulario' ? (
            <form onSubmit={handleSubmit} className="space-y-6 pb-8">
              
              {/* Blue Profile Banner matching Innovat style */}
              <div className="bg-gradient-to-r from-[#0284c7] to-[#0369a1] text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 shadow-inner">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative group">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/20 border-4 border-white flex items-center justify-center overflow-hidden shadow-lg bg-slate-100 text-slate-400">
                      {formData.fotoUrl ? (
                        <img 
                          src={formData.fotoUrl} 
                          alt="Foto Alumno" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User size={64} className="text-slate-300" />
                      )}
                    </div>
                    <label 
                      htmlFor="avatar-upload" 
                      className="absolute bottom-0 right-0 p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-full cursor-pointer shadow-md transition-transform transform hover:scale-105"
                      title="Subir fotografía del alumno"
                    >
                      <Upload size={14} />
                      <input 
                        id="avatar-upload" 
                        type="file" 
                        accept="image/*" 
                        onChange={handlePhotoUpload} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="text-center sm:text-left">
                    <h2 className="text-2xl font-bold tracking-tight">
                      {formData.nombres ? `${formData.nombres} ${formData.apellidoPaterno} ${formData.apellidoMaterno}` : 'Nuevo Alumno'}
                    </h2>
                    <p className="text-sky-100 text-sm font-medium mt-0.5">
                      {formData.grado} • {formData.nivel} • {formData.grupo}
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                      <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-md font-semibold">
                        Turno {formData.turno}
                      </span>
                      <span className="bg-emerald-500/80 text-white text-xs px-2.5 py-0.5 rounded-md font-semibold">
                        {formData.estatus || 'Activo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
                  <span className="text-xs uppercase tracking-widest text-sky-200 font-bold">
                    Inscripción / Reinscripción
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {cicloEscolar}
                  </span>
                  <div className="mt-3 bg-white text-sky-900 font-extrabold text-lg px-6 py-1.5 rounded-full shadow-sm border border-sky-200 flex items-center gap-2">
                    <span className="text-xs text-sky-600 font-semibold uppercase">Matrícula:</span>
                    <span>{formData.matricula || '---'}</span>
                  </div>
                </div>
              </div>

              <div className="px-6 sm:px-10 space-y-8">
                
                {/* SECCIÓN 1: Información básica del alumno */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                      <User size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">Información básica del alumno</h4>
                      <p className="text-xs text-slate-500">Datos personales y de registro ante el sistema escolar</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nombre*
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Juan Carlos"
                        value={formData.nombres}
                        onChange={(e) => handleInputChange('nombres', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Apellido paterno*
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Pérez"
                        value={formData.apellidoPaterno}
                        onChange={(e) => handleInputChange('apellidoPaterno', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Apellido materno
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Hernández"
                        value={formData.apellidoMaterno}
                        onChange={(e) => handleInputChange('apellidoMaterno', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Género*
                      </label>
                      <select
                        value={formData.genero}
                        onChange={(e) => handleInputChange('genero', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none cursor-pointer"
                      >
                        <option value="">Seleccione...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="No binario">No binario</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Fecha de nacimiento*
                      </label>
                      <input
                        type="date"
                        value={formData.fechaNacimiento}
                        onChange={(e) => handleInputChange('fechaNacimiento', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Lugar de nacimiento
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Morelia, Michoacán"
                        value={formData.lugarNacimiento}
                        onChange={(e) => handleInputChange('lugarNacimiento', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nacionalidad
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Mexicana"
                        value={formData.nacionalidad}
                        onChange={(e) => handleInputChange('nacionalidad', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        CURP
                      </label>
                      <input
                        type="text"
                        placeholder="Clave Única de Registro de Población"
                        value={formData.curp}
                        onChange={(e) => handleInputChange('curp', e.target.value.toUpperCase())}
                        maxLength={18}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm uppercase font-mono text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Clave de Alumno
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. ALU-2026-0439"
                        value={formData.clave}
                        onChange={(e) => handleInputChange('clave', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 2: Domicilio */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">Domicilio y Ubicación</h4>
                      <p className="text-xs text-slate-500">Dirección particular para expedientes y emergencias</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Calle y número
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Av. Camelinas #1450 Int. 4"
                        value={formData.calleNumero}
                        onChange={(e) => handleInputChange('calleNumero', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Colonia
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Bosques de las Lomas"
                        value={formData.colonia}
                        onChange={(e) => handleInputChange('colonia', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Código postal
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. 58000"
                        value={formData.codigoPostal}
                        onChange={(e) => handleInputChange('codigoPostal', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Entre Calles
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Entre Pino y Roble"
                        value={formData.entreCalles}
                        onChange={(e) => handleInputChange('entreCalles', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Municipio
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Morelia"
                        value={formData.municipio}
                        onChange={(e) => handleInputChange('municipio', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Estado
                      </label>
                      <select
                        value={formData.estado}
                        onChange={(e) => handleInputChange('estado', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none cursor-pointer"
                      >
                        <option value="Michoacán">Michoacán</option>
                        <option value="Aguascalientes">Aguascalientes</option>
                        <option value="Baja California">Baja California</option>
                        <option value="Ciudad de México">Ciudad de México</option>
                        <option value="Guanajuato">Guanajuato</option>
                        <option value="Jalisco">Jalisco</option>
                        <option value="México">Estado de México</option>
                        <option value="Nuevo León">Nuevo León</option>
                        <option value="Puebla">Puebla</option>
                        <option value="Querétaro">Querétaro</option>
                        <option value="Yucatán">Yucatán</option>
                        <option value="Otro">Otro Estado</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 3: Contacto */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                      <PhoneCall size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">Información de Contacto</h4>
                      <p className="text-xs text-slate-500">Canales de comunicación institucional</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Email Institucional / Personal
                      </label>
                      <input
                        type="email"
                        placeholder="alumno@sysacad.edu.mx"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Celular
                      </label>
                      <input
                        type="tel"
                        placeholder="443 123 4567"
                        value={formData.celular}
                        onChange={(e) => handleInputChange('celular', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Teléfono casa
                      </label>
                      <input
                        type="tel"
                        placeholder="443 312 0000"
                        value={formData.telefonoCasa}
                        onChange={(e) => handleInputChange('telefonoCasa', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border-b-2 border-slate-300 focus:border-sky-600 focus:bg-white text-sm text-slate-800 rounded-t-lg transition-colors outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* ACCORDION SECTIONS (Matching Image 3) */}
                <div className="space-y-3 pt-2">
                  
                  {/* 1. Datos de la familia */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('familia')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Datos de la familia</span>
                      </div>
                      <div className="text-slate-400">
                        {openSection.familia ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {openSection.familia && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-4"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Nombre del Padre o Tutor Principal
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. Roberto Pérez Flores"
                                value={formData.nombrePadreTutor}
                                onChange={(e) => handleInputChange('nombrePadreTutor', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Nombre de la Madre
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. María Elena Hernández"
                                value={formData.nombreMadre}
                                onChange={(e) => handleInputChange('nombreMadre', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Parentesco
                              </label>
                              <select
                                value={formData.parentescoTutor}
                                onChange={(e) => handleInputChange('parentescoTutor', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              >
                                <option value="Padre">Padre</option>
                                <option value="Madre">Madre</option>
                                <option value="Tutor Legal">Tutor Legal</option>
                                <option value="Abuelo/a">Abuelo/a</option>
                                <option value="Familiar">Familiar</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Ocupación / Empresa
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. Ingeniero Civil / Constructora"
                                value={formData.ocupacionTutor}
                                onChange={(e) => handleInputChange('ocupacionTutor', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Teléfono de Emergencia
                              </label>
                              <input
                                type="tel"
                                placeholder="443 987 6543"
                                value={formData.telefonoEmergencia}
                                onChange={(e) => handleInputChange('telefonoEmergencia', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Correo Electrónico del Tutor
                              </label>
                              <input
                                type="email"
                                placeholder="tutor@gmail.com"
                                value={formData.emailTutor}
                                onChange={(e) => handleInputChange('emailTutor', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 2. Datos académicos */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('academicos')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Datos académicos</span>
                      </div>
                      <div className="text-slate-400">
                        {openSection.academicos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {openSection.academicos && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-4"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Nivel Educativo
                              </label>
                              <select
                                value={formData.nivel}
                                onChange={(e) => handleInputChange('nivel', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              >
                                <option value="Maternal">Maternal</option>
                                <option value="Preescolar">Preescolar</option>
                                <option value="Primaria">Primaria</option>
                                <option value="Secundaria">Secundaria</option>
                                <option value="Bachillerato">Bachillerato</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Grado Asignado
                              </label>
                              <select
                                value={formData.grado}
                                onChange={(e) => handleInputChange('grado', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              >
                                <option value="1er Grado">1er Grado</option>
                                <option value="2do Grado">2do Grado</option>
                                <option value="3er Grado">3er Grado</option>
                                <option value="4to Grado">4to Grado</option>
                                <option value="5to Grado">5to Grado</option>
                                <option value="6to Grado">6to Grado</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Grupo
                              </label>
                              <select
                                value={formData.grupo}
                                onChange={(e) => handleInputChange('grupo', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              >
                                <option value="Grupo A">Grupo A</option>
                                <option value="Grupo B">Grupo B</option>
                                <option value="Grupo C">Grupo C</option>
                                <option value="Único">Único</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Turno
                              </label>
                              <select
                                value={formData.turno}
                                onChange={(e) => handleInputChange('turno', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              >
                                <option value="Matutino">Matutino (07:30 - 14:00)</option>
                                <option value="Vespertino">Vespertino (14:00 - 19:30)</option>
                                <option value="Completo">Horario Extendido</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Escuela de Procedencia
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. Instituto Morelia"
                                value={formData.escuelaProcedencia}
                                onChange={(e) => handleInputChange('escuelaProcedencia', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Promedio Ciclo Anterior
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="5"
                                max="10"
                                placeholder="9.5"
                                value={formData.promedioAnterior}
                                onChange={(e) => handleInputChange('promedioAnterior', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 3. Datos de facturación */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('facturacion')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Datos de facturación</span>
                      </div>
                      <div className="text-slate-400">
                        {openSection.facturacion ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {openSection.facturacion && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-4"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Razón Social o Nombre Fiscal
                              </label>
                              <input
                                type="text"
                                placeholder="Nombre completo o empresa"
                                value={formData.razonSocial}
                                onChange={(e) => handleInputChange('razonSocial', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                RFC
                              </label>
                              <input
                                type="text"
                                placeholder="XAXX010101000"
                                value={formData.rfc}
                                onChange={(e) => handleInputChange('rfc', e.target.value.toUpperCase())}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm uppercase font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Régimen Fiscal
                              </label>
                              <select
                                value={formData.regimenFiscal}
                                onChange={(e) => handleInputChange('regimenFiscal', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              >
                                <option value="605 - Sueldos y Salarios">605 - Sueldos y Salarios</option>
                                <option value="612 - Personas Físicas con Actividades Empresariales">612 - Actividades Empresariales</option>
                                <option value="626 - Régimen Simplificado de Confianza (RESICO)">626 - RESICO</option>
                                <option value="601 - General de Ley Personas Morales">601 - General de Ley Personas Morales</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Uso de CFDI
                              </label>
                              <select
                                value={formData.usoCfdi}
                                onChange={(e) => handleInputChange('usoCfdi', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              >
                                <option value="D10 - Pagos por servicios educativos (colegiaturas)">D10 - Pagos por servicios educativos (colegiaturas)</option>
                                <option value="G03 - Gastos en general">G03 - Gastos en general</option>
                                <option value="CP01 - Pagos">CP01 - Pagos</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Correo para Envío de Facturas (CFDI XML y PDF)
                              </label>
                              <input
                                type="email"
                                placeholder="facturacion@familia.com"
                                value={formData.emailFacturacion}
                                onChange={(e) => handleInputChange('emailFacturacion', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 4. Asignación de conceptos */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('conceptos')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Asignación de conceptos y colegiaturas</span>
                      </div>
                      <div className="text-slate-400">
                        {openSection.conceptos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {openSection.conceptos && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-4"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Cuota Inscripción ($)
                              </label>
                              <input
                                type="number"
                                placeholder="3500"
                                value={formData.cuotaInscripcion}
                                onChange={(e) => handleInputChange('cuotaInscripcion', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Colegiatura Mensual ($)
                              </label>
                              <input
                                type="number"
                                placeholder="4200"
                                value={formData.colegiaturaMensual}
                                onChange={(e) => handleInputChange('colegiaturaMensual', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                % Beca / Descuento
                              </label>
                              <select
                                value={formData.porcentajeBeca}
                                onChange={(e) => handleInputChange('porcentajeBeca', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800"
                              >
                                <option value="0">0% (Sin beca)</option>
                                <option value="10">10% Convenio</option>
                                <option value="15">15% Hermanos</option>
                                <option value="25">25% Académica</option>
                                <option value="50">50% Media Beca</option>
                                <option value="100">100% Beca Total</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">
                                Día Límite de Pago
                              </label>
                              <select
                                value={formData.diaLimitePago}
                                onChange={(e) => handleInputChange('diaLimitePago', e.target.value)}
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800"
                              >
                                <option value="5">Día 5 de cada mes</option>
                                <option value="10">Día 10 de cada mes</option>
                                <option value="15">Día 15 de cada mes</option>
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 5. Documentación y pagos */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('documentacion')}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">Documentación y pagos entregados</span>
                      </div>
                      <div className="text-slate-400">
                        {openSection.documentacion ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {openSection.documentacion && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-100 p-5 bg-slate-50/50 space-y-3"
                        >
                          <p className="text-xs text-slate-500 mb-2">Marque los documentos físicos y digitales recibidos en el expediente del alumno:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={formData.docActaNacimiento}
                                onChange={(e) => handleInputChange('docActaNacimiento', e.target.checked)}
                                className="w-4 h-4 rounded text-sky-600"
                              />
                              <span>Acta de nacimiento (Original y Copia)</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={formData.docCurp}
                                onChange={(e) => handleInputChange('docCurp', e.target.checked)}
                                className="w-4 h-4 rounded text-sky-600"
                              />
                              <span>CURP formato actual certificado</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={formData.docCertificadoMedico}
                                onChange={(e) => handleInputChange('docCertificadoMedico', e.target.checked)}
                                className="w-4 h-4 rounded text-sky-600"
                              />
                              <span>Certificado médico y tipo de sangre</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={formData.docCartaConducta}
                                onChange={(e) => handleInputChange('docCartaConducta', e.target.checked)}
                                className="w-4 h-4 rounded text-sky-600"
                              />
                              <span>Carta de buena conducta de escuela anterior</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={formData.docComprobanteDomicilio}
                                onChange={(e) => handleInputChange('docComprobanteDomicilio', e.target.checked)}
                                className="w-4 h-4 rounded text-sky-600"
                              />
                              <span>Comprobante de domicilio reciente</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={formData.docFotos}
                                onChange={(e) => handleInputChange('docFotos', e.target.checked)}
                                className="w-4 h-4 rounded text-sky-600"
                              />
                              <span>4 Fotografías tamaño infantil</span>
                            </label>

                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 text-xs font-medium text-slate-700 sm:col-span-2">
                              <input
                                type="checkbox"
                                checked={formData.docComprobantePago}
                                onChange={(e) => handleInputChange('docComprobantePago', e.target.checked)}
                                className="w-4 h-4 rounded text-sky-600"
                              />
                              <span className="font-bold text-sky-900">Comprobante de pago de inscripción y cuota de materiales</span>
                            </label>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </div>
              </div>

              {/* Form Bottom Action bar matching Innovat (Continuar Button) */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 sm:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Los datos se guardarán localmente y se sincronizarán con la hoja 'Alumnos' de Google Sheets.</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors cursor-pointer w-full sm:w-auto"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="px-8 py-2.5 bg-[#689f38] hover:bg-[#558b2f] text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto uppercase tracking-wide"
                  >
                    <span>CONTINUAR</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Printable Preview Sheet */
            <div className="p-8 max-w-3xl mx-auto space-y-6">
              <div className="border-2 border-slate-300 p-8 rounded-xl bg-white shadow-sm print:border-none print:shadow-none space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-sky-700 text-white flex items-center justify-center font-bold text-xl">
                      SA
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 uppercase">{institutionName}</h2>
                      <p className="text-xs text-slate-600 font-semibold">CÉDULA OFICIAL DE INSCRIPCIÓN / REINSCRIPCIÓN</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-bold uppercase">{cicloEscolar}</p>
                    <p className="text-sm font-extrabold text-sky-800 mt-1">MATRÍCULA: {formData.matricula || 'PENDIENTE'}</p>
                  </div>
                </div>

                {/* Main Student Data */}
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="col-span-2 space-y-2">
                    <p><strong className="text-slate-700">Nombre del Alumno:</strong> <span className="font-semibold text-slate-900">{formData.nombres} {formData.apellidoPaterno} {formData.apellidoMaterno}</span></p>
                    <p><strong className="text-slate-700">CURP:</strong> <span className="font-mono text-slate-900">{formData.curp || '---'}</span></p>
                    <p><strong className="text-slate-700">Fecha de Nacimiento:</strong> {formData.fechaNacimiento || '---'} ({formData.lugarNacimiento || '---'})</p>
                    <p><strong className="text-slate-700">Nivel / Grado / Grupo:</strong> {formData.nivel} • {formData.grado} • {formData.grupo} ({formData.turno})</p>
                    <p><strong className="text-slate-700">Domicilio:</strong> {formData.calleNumero || '---'}, {formData.colonia || '---'}, {formData.municipio}, {formData.estado}</p>
                  </div>

                  <div className="border border-slate-300 rounded-lg p-3 text-center flex flex-col items-center justify-center bg-slate-50">
                    <div className="w-20 h-24 border border-dashed border-slate-400 flex items-center justify-center text-slate-400 text-[10px] uppercase">
                      {formData.fotoUrl ? (
                        <img src={formData.fotoUrl} alt="Foto" className="w-full h-full object-cover" />
                      ) : (
                        'Fotografía Infantil'
                      )}
                    </div>
                  </div>
                </div>

                {/* Family & Contact */}
                <div className="border-t border-slate-200 pt-4 text-xs space-y-1.5">
                  <h4 className="font-bold text-slate-800 uppercase text-[11px]">Datos de Contacto y Familia</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <p><strong>Padre / Tutor:</strong> {formData.nombrePadreTutor || '---'}</p>
                    <p><strong>Madre:</strong> {formData.nombreMadre || '---'}</p>
                    <p><strong>Tel. Emergencia:</strong> {formData.telefonoEmergencia || formData.celular || '---'}</p>
                    <p><strong>Email Institucional:</strong> {formData.email || '---'}</p>
                  </div>
                </div>

                {/* Economic & Concept Data */}
                <div className="border-t border-slate-200 pt-4 text-xs space-y-1.5">
                  <h4 className="font-bold text-slate-800 uppercase text-[11px]">Conceptos y Pagos Asignados</h4>
                  <div className="grid grid-cols-3 gap-2 text-slate-700">
                    <p><strong>Cuota de Inscripción:</strong> ${formData.cuotaInscripcion} MXN</p>
                    <p><strong>Colegiatura Mensual:</strong> ${formData.colegiaturaMensual} MXN</p>
                    <p><strong>Beca / Descuento:</strong> {formData.porcentajeBeca}%</p>
                  </div>
                </div>

                {/* Signatures */}
                <div className="border-t border-slate-200 pt-10 grid grid-cols-2 gap-8 text-center text-xs">
                  <div>
                    <div className="border-b border-slate-800 mb-1"></div>
                    <p className="font-bold text-slate-800">Firma del Padre o Tutor</p>
                    <p className="text-[10px] text-slate-500">Aceptación de reglamento y cuotas</p>
                  </div>
                  <div>
                    <div className="border-b border-slate-800 mb-1"></div>
                    <p className="font-bold text-slate-800">Sello y Firma Control Escolar</p>
                    <p className="text-[10px] text-slate-500">SysAcad - Registro Académico</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Imprimir Ficha de Inscripción</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
