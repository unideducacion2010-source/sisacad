import React, { useState } from 'react';
import { 
  School, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  UserCheck, 
  Award, 
  FileText, 
  CheckCircle2, 
  Save, 
  RefreshCw, 
  Eye, 
  Sparkles, 
  Image as ImageIcon, 
  ShieldCheck, 
  Compass, 
  Info,
  Clock,
  Printer
} from 'lucide-react';
import { motion } from 'motion/react';

export interface CentroEscolarData {
  nombre: string;
  lema: string;
  cct: string;
  nivelEducativo: string;
  turno: string;
  zonaEscolar: string;
  sector: string;
  domicilio: string;
  colonia: string;
  municipio: string;
  estado: string;
  codigoPostal: string;
  telefono: string;
  correo: string;
  director: string;
  cargoDirector: string;
  subdirector?: string;
  logoUrl?: string;
}

export const DEFAULT_CENTRO_ESCOLAR: CentroEscolarData = {
  nombre: 'CENTRO EDUCATIVO "VILLA MONTESSORI DE MORELIA"',
  lema: 'Comunidad Educativa',
  cct: '16PPR0123Z',
  nivelEducativo: 'SECUNDARIA GENERAL / PRIMARIA',
  turno: 'MATUTINO',
  zonaEscolar: 'ZONA 014',
  sector: 'SECTOR 02',
  domicilio: 'CALLE CENTRAL NORTE S/N',
  colonia: 'DR. MANUEL VELASCO SUAREZ',
  municipio: 'MORELIA',
  estado: 'MICHOACÁN',
  codigoPostal: '58000',
  telefono: '(443) 314-5566',
  correo: 'c.e.v.montessori@gmail.com',
  director: 'LIC. PATRICIA RAMÍREZ GUZMÁN',
  cargoDirector: 'DIRECTORA GENERAL',
  subdirector: '',
  logoUrl: ''
};

interface CentroEscolarViewProps {
  initialData?: Partial<CentroEscolarData>;
  onSave: (data: CentroEscolarData) => void;
  playSuccessSound?: () => void;
  playClickSound?: () => void;
  onOpenFormatsPreview?: () => void;
}

export const CentroEscolarView: React.FC<CentroEscolarViewProps> = ({
  initialData,
  onSave,
  playSuccessSound,
  playClickSound,
  onOpenFormatsPreview
}) => {
  const [formData, setFormData] = useState<CentroEscolarData>(() => ({
    ...DEFAULT_CENTRO_ESCOLAR,
    ...(initialData || {})
  }));

  const [activeTab, setActiveTab] = useState<'general' | 'ubicacion' | 'directivos' | 'preview'>('general');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleChange = (field: keyof CentroEscolarData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData);
    if (playSuccessSound) playSuccessSound();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('¿Desea restablecer los campos con los valores predeterminados de la institución?')) {
      setFormData(DEFAULT_CENTRO_ESCOLAR);
      if (playClickSound) playClickSound();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
              <School size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800">Centro Escolar</h2>
                <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-800 rounded-full">
                  Datos Generales Oficiales
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configuración del plantel, CCT, domicilio, autoridades y logotipo para su uso automático en todos los formatos y boletas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              title="Restablecer valores originales"
            >
              <RefreshCw size={14} />
              <span>Restablecer</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Save size={16} />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </div>

        {/* Saved Success Toast Alert */}
        {savedSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-xs font-medium"
          >
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <div className="flex-1">
              <strong>¡Datos de Centro Escolar guardados con éxito!</strong> Los cambios se han sincronizado con la base de datos y se reflejan inmediatamente en las boletas, listas y constancias escolares.
            </div>
          </motion.div>
        )}

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-2 pt-4">
          <button
            onClick={() => { setActiveTab('general'); if (playClickSound) playClickSound(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 size={15} />
            <span>1. Identificación Oficial</span>
          </button>

          <button
            onClick={() => { setActiveTab('ubicacion'); if (playClickSound) playClickSound(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ubicacion'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <MapPin size={15} />
            <span>2. Domicilio & Zona</span>
          </button>

          <button
            onClick={() => { setActiveTab('directivos'); if (playClickSound) playClickSound(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'directivos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <UserCheck size={15} />
            <span>3. Directivos & Contacto</span>
          </button>

          <button
            onClick={() => { setActiveTab('preview'); if (playClickSound) playClickSound(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Eye size={15} />
            <span>4. Vista Previa en Formatos</span>
          </button>
        </div>
      </div>

      {/* Main Content Sections */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: IDENTIFICACIÓN OFICIAL */}
        {activeTab === 'general' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Building2 size={17} className="text-blue-600" />
                  <span>Identificación Oficial del Plantel</span>
                </h3>
                <p className="text-xs text-slate-500">Datos registrados ante la Secretaría de Educación Pública (SEP).</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Nombre Oficial */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Oficial de la Escuela (según catálogo CCT) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  placeholder="Ej. CENTRO EDUCATIVO VILLA MONTESSORI DE MORELIA"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Este nombre se imprimirá en el encabezado de las boletas oficiales, listas de asistencia y kardex.
                </span>
              </div>

              {/* CCT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Clave de Centro de Trabajo (CCT) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.cct}
                  onChange={(e) => handleChange('cct', e.target.value.toUpperCase())}
                  placeholder="Ej. 16PPR0123Z o 07ETV1188Q"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                />
              </div>

              {/* Lema o Subtítulo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lema Institucional / Subtítulo
                </label>
                <input
                  type="text"
                  value={formData.lema}
                  onChange={(e) => handleChange('lema', e.target.value)}
                  placeholder="Ej. Comunidad Educativa"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Nivel Educativo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nivel Educativo / Modalidad
                </label>
                <input
                  type="text"
                  value={formData.nivelEducativo}
                  onChange={(e) => handleChange('nivelEducativo', e.target.value)}
                  placeholder="Ej. Secundaria General / Primaria"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase"
                />
              </div>

              {/* Turno */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Turno Predeterminado
                </label>
                <select
                  value={formData.turno}
                  onChange={(e) => handleChange('turno', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase cursor-pointer"
                >
                  <option value="MATUTINO">MATUTINO</option>
                  <option value="VESPERTINO">VESPERTINO</option>
                  <option value="MIXTO">MIXTO</option>
                  <option value="COMPLETO">JORNADA COMPLETA</option>
                </select>
              </div>

              {/* Logotipo URL */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL del Logotipo Institucional
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formData.logoUrl || ''}
                    onChange={(e) => handleChange('logoUrl', e.target.value)}
                    placeholder="https://... o deje vacío para usar el logo predeterminado de Villa Montessori"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {formData.logoUrl && (
                    <img 
                      src={formData.logoUrl} 
                      alt="Logo preview" 
                      className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-white p-1 shrink-0" 
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UBICACIÓN Y DOMICILIO */}
        {activeTab === 'ubicacion' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <MapPin size={17} className="text-emerald-600" />
                <span>Domicilio y Ubicación Geográfica</span>
              </h3>
              <p className="text-xs text-slate-500">Dirección oficial requerida para constancias, actas y formatos de supervisión.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Domicilio (Calle y Número) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Calle y Número Oficial
                </label>
                <input
                  type="text"
                  value={formData.domicilio}
                  onChange={(e) => handleChange('domicilio', e.target.value)}
                  placeholder="Ej. Calle Central Norte S/N"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase"
                />
              </div>

              {/* Colonia / Localidad */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Colonia o Localidad *
                </label>
                <input
                  type="text"
                  required
                  value={formData.colonia}
                  onChange={(e) => handleChange('colonia', e.target.value)}
                  placeholder="Ej. Dr. Manuel Velasco Suárez"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase"
                />
              </div>

              {/* Municipio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Municipio o Alcaldía *
                </label>
                <input
                  type="text"
                  required
                  value={formData.municipio}
                  onChange={(e) => handleChange('municipio', e.target.value)}
                  placeholder="Ej. Morelia"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase"
                />
              </div>

              {/* Entidad Federativa / Estado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Entidad Federativa (Estado) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.estado}
                  onChange={(e) => handleChange('estado', e.target.value)}
                  placeholder="Ej. Michoacán"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase"
                />
              </div>

              {/* Código Postal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Código Postal (C.P.)
                </label>
                <input
                  type="text"
                  value={formData.codigoPostal}
                  onChange={(e) => handleChange('codigoPostal', e.target.value)}
                  placeholder="Ej. 58000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Zona Escolar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Zona Escolar
                </label>
                <input
                  type="text"
                  value={formData.zonaEscolar}
                  onChange={(e) => handleChange('zonaEscolar', e.target.value)}
                  placeholder="Ej. Zona 014"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase"
                />
              </div>

              {/* Sector Escolar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sector Escolar
                </label>
                <input
                  type="text"
                  value={formData.sector}
                  onChange={(e) => handleChange('sector', e.target.value)}
                  placeholder="Ej. Sector 02"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIRECTIVOS & CONTACTO */}
        {activeTab === 'directivos' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <UserCheck size={17} className="text-purple-600" />
                <span>Autoridades Escolares y Contacto</span>
              </h3>
              <p className="text-xs text-slate-500">Firmas oficiales para boletas, constancias y canales de atención.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Director(a) Nombre */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Director(a) / Titular *
                </label>
                <input
                  type="text"
                  required
                  value={formData.director}
                  onChange={(e) => handleChange('director', e.target.value)}
                  placeholder="Ej. LIC. PATRICIA RAMÍREZ GUZMÁN"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 uppercase"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Aparecerá en el bloque oficial de "FIRMA DEL DIRECTOR(A)".
                </span>
              </div>

              {/* Cargo Oficial */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cargo del Titular
                </label>
                <input
                  type="text"
                  value={formData.cargoDirector}
                  onChange={(e) => handleChange('cargoDirector', e.target.value)}
                  placeholder="Ej. DIRECTORA GENERAL o DIRECTOR DEL PLANTEL"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 uppercase"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Teléfono Escolar
                </label>
                <input
                  type="text"
                  value={formData.telefono}
                  onChange={(e) => handleChange('telefono', e.target.value)}
                  placeholder="Ej. (443) 314-5566"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              {/* Correo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Correo Electrónico Institucional
                </label>
                <input
                  type="email"
                  value={formData.correo}
                  onChange={(e) => handleChange('correo', e.target.value)}
                  placeholder="Ej. c.e.v.montessori@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: VISTA PREVIA EN FORMATOS */}
        {activeTab === 'preview' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Eye size={17} className="text-amber-600" />
                  <span>Vista Previa de los Datos en Formatos Oficiales</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Así se visualizarán los datos del Centro Escolar en las boletas, listas y kardex generados.
                </p>
              </div>
            </div>

            {/* Mock Header SEP Boleta */}
            <div className="border-2 border-slate-300 rounded-xl p-5 bg-slate-50 space-y-3">
              <span className="text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                Formato 1: Encabezado Oficial SEP (Boleta de Calificaciones / Kardex Final)
              </span>

              <div className="bg-white border border-black rounded-lg p-3 text-[11px] space-y-1.5">
                <div className="flex justify-between items-end border-b border-dotted border-slate-300 pb-1.5">
                  <div>
                    <p className="font-extrabold uppercase text-black text-sm">{formData.nombre || 'NOMBRE DE LA ESCUELA'}</p>
                    <p className="text-[8px] text-slate-500 uppercase">NOMBRE OFICIAL DE LA ESCUELA SEGÚN CATÁLOGO DE CENTRO DE TRABAJO</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold uppercase text-black text-xs">{formData.cct || '16PPR0123Z'}</p>
                    <p className="text-[8px] text-slate-500 uppercase">CLAVE SEGÚN CCT</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[9.5px] pt-1 text-slate-800">
                  <div>
                    <span className="font-bold uppercase">COLONIA O LOCALIDAD: </span>
                    <span className="uppercase">{formData.colonia || 'CENTRO'}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase">MUNICIPIO: </span>
                    <span className="uppercase">{formData.municipio || 'MORELIA'}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold uppercase">ENTIDAD: </span>
                    <span className="uppercase">{formData.estado || 'MICHOACÁN'}</span>
                  </div>
                </div>
              </div>

              {/* Signatures Preview */}
              <div className="bg-white border border-black rounded-lg p-3 text-[10px]">
                <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Bloque de Validación y Firmas Oficiales:</p>
                <div className="grid grid-cols-3 gap-4 text-center pt-2">
                  <div>
                    <div className="border-t border-black w-4/5 mx-auto pt-1 font-bold uppercase text-[8.5px]">FIRMA DEL MAESTRO(A)</div>
                  </div>
                  <div>
                    <div className="border-t border-black w-4/5 mx-auto pt-1 font-bold uppercase text-[8.5px]">
                      {formData.director || 'NOMBRE DEL DIRECTOR(A)'}
                    </div>
                    <div className="text-[7.5px] text-slate-600 uppercase mt-0.5">NOMBRE Y FIRMA DEL DIRECTOR(A)</div>
                  </div>
                  <div>
                    <div className="border-t border-black w-4/5 mx-auto pt-1 font-bold uppercase text-[8.5px]">FIRMA PADRE / TUTOR</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Header Villa Montessori Reporte Temporal */}
            <div className="border-2 border-amber-300 rounded-xl p-5 bg-amber-50/50 space-y-3">
              <span className="text-[10px] font-extrabold uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                Formato 2: Reporte de Calificaciones Villa Montessori (Temporal)
              </span>

              <div className="bg-white border-2 border-[#ca9a2c] rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-serif font-black text-xl text-slate-900">{formData.nombre}</h4>
                  <p className="font-semibold text-xs text-amber-900">{formData.lema || 'Comunidad Educativa'}</p>
                  <p className="text-[10px] text-slate-600 mt-1 uppercase font-mono">
                    CCT: {formData.cct} • {formData.municipio}, {formData.estado}
                  </p>
                </div>
                <div className="text-right bg-amber-100/80 border border-amber-400 px-3 py-1.5 rounded-md">
                  <span className="font-extrabold text-[11px] text-amber-950 uppercase block">NIVEL SECUNDARIA</span>
                  <span className="text-[9.5px] font-bold text-amber-900 block">TURNO {formData.turno}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>Los cambios surten efecto de manera inmediata en todos los reportes y dispositivos vinculados.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Save size={16} />
              <span>Guardar Información del Centro Escolar</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
