import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit3, 
  UploadCloud, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Download, 
  HelpCircle,
  FileText,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Key,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface CalificacionItem {
  id: string;
  alumno: string;
  materia: string;
  parcial: string;
  calificacion: number;
  fecha: string;
}

export interface AlumnoItem {
  id: string;
  nombres: string;
  apellidos: string;
  matricula?: string;
  grado: string;
  grupo?: string;
}

export interface MateriaItem {
  id: string;
  clave?: string;
  nombre: string;
  profesor?: string;
}

interface CalificacionesModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCalif: CalificacionItem | null;
  alumnosList: AlumnoItem[];
  materiasList: MateriaItem[];
  initialTab?: 'manual' | 'rapida';
  initialQuickMode?: 'excel' | 'imagen';
  onSaveManual: (calif: {
    alumno: string;
    materia: string;
    parcial: string;
    calificacion: number;
  }) => void;
  onSaveBatch: (calificaciones: Omit<CalificacionItem, 'id' | 'fecha'>[]) => void;
  playClickSound?: () => void;
  playSuccessSound?: () => void;
  playErrorSound?: () => void;
}

export const CalificacionesModal: React.FC<CalificacionesModalProps> = ({
  isOpen,
  onClose,
  editingCalif,
  alumnosList,
  materiasList,
  initialTab = 'manual',
  initialQuickMode = 'excel',
  onSaveManual,
  onSaveBatch,
  playClickSound,
  playSuccessSound,
  playErrorSound,
}) => {
  // Main Tab State: 'manual' vs 'rapida'
  const [activeTab, setActiveTab] = useState<'manual' | 'rapida'>(initialTab);
  
  // Quick Capture Sub-mode: 'excel' vs 'imagen'
  const [quickMode, setQuickMode] = useState<'excel' | 'imagen'>(initialQuickMode);

  // Manual Form States
  const [formAlumno, setFormAlumno] = useState(
    editingCalif ? editingCalif.alumno : (alumnosList[0] ? `${alumnosList[0].nombres} ${alumnosList[0].apellidos}` : '')
  );
  const [formMateria, setFormMateria] = useState(
    editingCalif ? editingCalif.materia : (materiasList[0] ? materiasList[0].nombre : '')
  );
  const [formParcial, setFormParcial] = useState(
    editingCalif ? editingCalif.parcial : 'Primer Parcial'
  );
  const [formCalificacion, setFormCalificacion] = useState(
    editingCalif ? editingCalif.calificacion.toString() : '9.0'
  );

  // Excel Upload States (Ephemeral - Not saved to storage, only in-memory parsing)
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelPreviewData, setExcelPreviewData] = useState<Array<{
    alumno: string;
    materia: string;
    parcial: string;
    calificacion: number;
    valido: boolean;
    errorMsg?: string;
  }>>([]);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccessCount, setExcelSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image Upload & AI Processing States (Ephemeral - processed in memory, not saved to storage)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSuccessCount, setImageSuccessCount] = useState<number | null>(null);
  const [imageDefaultParcial, setImageDefaultParcial] = useState('Primer Parcial');
  const [imageDefaultMateria, setImageDefaultMateria] = useState('');
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('sysacad_gemini_api_key') || '');
  const [showApiKeySettings, setShowApiKeySettings] = useState(false);
  const [savedApiKeyNotice, setSavedApiKeyNotice] = useState(false);
  const [imagePreviewData, setImagePreviewData] = useState<Array<{
    alumno: string;
    materia: string;
    parcial: string;
    calificacion: number;
    valido: boolean;
    errorMsg?: string;
  }>>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingCalif) {
        setActiveTab('manual');
      } else {
        if (initialTab) setActiveTab(initialTab);
        if (initialQuickMode) setQuickMode(initialQuickMode);
      }
    }
  }, [isOpen, editingCalif, initialTab, initialQuickMode]);

  // Clean-up and close handler
  const handleModalClose = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setExcelFile(null);
    setExcelPreviewData([]);
    setImageFile(null);
    setImagePreviewUrl(null);
    setImagePreviewData([]);
    setImageError(null);
    setImageSuccessCount(null);
    setExcelError(null);
    setExcelSuccessCount(null);
    onClose();
  };

  if (!isOpen) return null;

  // Manual Submit
  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAlumno.trim() || !formMateria.trim()) {
      playErrorSound?.();
      return;
    }
    const val = parseFloat(formCalificacion);
    if (isNaN(val) || val < 0 || val > 10) {
      playErrorSound?.();
      alert('La calificación debe ser un valor numérico entre 0 y 10.');
      return;
    }

    onSaveManual({
      alumno: formAlumno.trim(),
      materia: formMateria.trim(),
      parcial: formParcial,
      calificacion: val,
    });
  };

  // Handle Excel File Selection & Parse
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setIsProcessingExcel(true);
    setExcelError(null);
    setExcelSuccessCount(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Look for a sheet named 'Calificaciones' or use first sheet
      const sheetName = workbook.SheetNames.includes('Calificaciones') 
        ? 'Calificaciones' 
        : workbook.SheetNames[0];
      
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!json || json.length === 0) {
        setExcelError('El archivo no contiene filas o está vacío.');
        setIsProcessingExcel(false);
        return;
      }

      // Parse and normalize columns
      const parsed = json.map((row) => {
        // Look for common headers
        const alumno = row['Alumno'] || row['alumno'] || row['Estudiante'] || row['Nombre'] || row['Nombre del Alumno'] || row['ALUMNO'] || '';
        const materia = row['Materia'] || row['materia'] || row['Asignatura'] || row['MATERIA'] || formMateria || '';
        const parcial = row['Parcial'] || row['parcial'] || row['Periodo'] || row['Período'] || formParcial || 'Primer Parcial';
        const califRaw = row['Calificacion'] || row['calificacion'] || row['Calificación'] || row['Nota'] || row['Promedio'] || row['CALIFICACION'] || '';
        
        const numVal = parseFloat(String(califRaw).replace(',', '.'));
        const isValValid = !isNaN(numVal) && numVal >= 0 && numVal <= 10;
        const isAlumnoValid = String(alumno).trim().length > 0;
        const isMateriaValid = String(materia).trim().length > 0;

        let errorMsg = '';
        if (!isAlumnoValid) errorMsg = 'Falta nombre de alumno';
        else if (!isMateriaValid) errorMsg = 'Falta materia';
        else if (!isValValid) errorMsg = 'Calificación inválida (debe ser 0-10)';

        return {
          alumno: String(alumno).trim(),
          materia: String(materia).trim(),
          parcial: String(parcial).trim(),
          calificacion: isValValid ? numVal : 0,
          valido: isAlumnoValid && isMateriaValid && isValValid,
          errorMsg: errorMsg || undefined
        };
      });

      setExcelPreviewData(parsed);
      playSuccessSound?.();
    } catch (err: any) {
      console.error('Error al leer Excel:', err);
      setExcelError('No se pudo procesar el archivo Excel. Asegúrate de que sea un formato .xlsx o .csv válido.');
      playErrorSound?.();
    } finally {
      setIsProcessingExcel(false);
    }
  };

  // Import Valid Excel Records
  const handleImportExcelData = () => {
    const validRows = excelPreviewData.filter(r => r.valido);
    if (validRows.length === 0) {
      alert('No hay registros válidos para importar.');
      return;
    }

    onSaveBatch(validRows.map(r => ({
      alumno: r.alumno,
      materia: r.materia,
      parcial: r.parcial,
      calificacion: r.calificacion
    })));

    setExcelSuccessCount(validRows.length);
    playSuccessSound?.();
  };

  // Handle Image Selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewData([]);
    setImageError(null);
    setImageSuccessCount(null);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    playClickSound?.();
  };

  // Helper: compress image to lightweight base64 (preserves OCR legibility while reducing size ~95%)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(readerEvent.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('No se pudo cargar la imagen para optimizar.'));
        img.src = readerEvent.target?.result as string;
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
      reader.readAsDataURL(file);
    });
  };

  // Process Image with Gemini AI
  const handleProcessImageWithAI = async () => {
    if (!imageFile) return;
    setIsProcessingImage(true);
    setImageError(null);
    setImageSuccessCount(null);
    playClickSound?.();

    try {
      const compressedBase64 = await compressImage(imageFile);

      const alumnosReferencia = alumnosList.map(a => `${a.apellidos} ${a.nombres}`);
      const materiasReferencia = materiasList.map(m => m.nombre);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (customApiKey.trim()) {
        headers['x-gemini-key'] = customApiKey.trim();
      }

      const response = await fetch('/api/extract-calificaciones', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: compressedBase64,
          mimeType: 'image/jpeg',
          alumnosReferencia,
          materiasReferencia,
          parcialDefault: imageDefaultParcial || 'Primer Parcial',
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudieron extraer las calificaciones de la imagen.');
      }

      if (!result.records || !Array.isArray(result.records) || result.records.length === 0) {
        throw new Error('La IA no detectó filas de calificaciones legibles en la imagen. Intenta con una imagen más nítida o con mejor iluminación.');
      }

      const defaultSubject = imageDefaultMateria || (materiasList[0] ? materiasList[0].nombre : 'Materia General');

      const parsed = result.records.map((row: any) => {
        const rawAlumno = row.alumno || '';
        const rawMateria = row.materia || defaultSubject;
        const rawParcial = row.parcial || imageDefaultParcial || 'Primer Parcial';
        const numVal = typeof row.calificacion === 'number' ? row.calificacion : parseFloat(row.calificacion);

        const isValValid = !isNaN(numVal) && numVal >= 0 && numVal <= 10;
        const isAlumnoValid = String(rawAlumno).trim().length > 0;
        const isMateriaValid = String(rawMateria).trim().length > 0;

        let errorMsg = '';
        if (!isAlumnoValid) errorMsg = 'Falta nombre de alumno';
        else if (!isMateriaValid) errorMsg = 'Falta materia';
        else if (!isValValid) errorMsg = 'Calificación inválida (debe ser 0-10)';

        return {
          alumno: String(rawAlumno).trim(),
          materia: String(rawMateria).trim(),
          parcial: String(rawParcial).trim(),
          calificacion: isValValid ? numVal : 0,
          valido: isAlumnoValid && isMateriaValid && isValValid,
          errorMsg: errorMsg || undefined
        };
      });

      setImagePreviewData(parsed);
      playSuccessSound?.();
    } catch (err: any) {
      console.error('Error al procesar imagen con IA:', err);
      setImageError(err?.message || 'Error al procesar la imagen con Gemini IA.');
      playErrorSound?.();
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Import Valid Image Records
  const handleImportImageData = () => {
    const validRows = imagePreviewData.filter(r => r.valido);
    if (validRows.length === 0) {
      alert('No hay registros válidos para importar.');
      return;
    }

    onSaveBatch(validRows.map(r => ({
      alumno: r.alumno,
      materia: r.materia,
      parcial: r.parcial,
      calificacion: r.calificacion
    })));

    setImageSuccessCount(validRows.length);
    playSuccessSound?.();
  };

  // Save custom Gemini API key to localStorage
  const handleSaveCustomApiKey = (key: string) => {
    setCustomApiKey(key);
    localStorage.setItem('sysacad_gemini_api_key', key.trim());
    setSavedApiKeyNotice(true);
    setTimeout(() => setSavedApiKeyNotice(false), 2500);
  };

  // Template Downloader helper
  const downloadExcelTemplate = () => {
    const templateData = [
      { 'Alumno': 'Pérez García Juan Carlos', 'Materia': 'Matemáticas', 'Parcial': 'Primer Parcial', 'Calificación': 9.5 },
      { 'Alumno': 'Hernández López María Elena', 'Materia': 'Matemáticas', 'Parcial': 'Primer Parcial', 'Calificación': 8.8 },
      { 'Alumno': 'Rodríguez Solís Santiago', 'Materia': 'Matemáticas', 'Parcial': 'Primer Parcial', 'Calificación': 10.0 }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');
    XLSX.writeFile(wb, 'Plantilla_Captura_Calificaciones.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header with Title and Mode Switcher */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-xs ${
              activeTab === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {activeTab === 'manual' ? <Edit3 size={22} /> : <Sparkles size={22} />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {editingCalif ? 'Edición de Calificación' : 'Registro y Captura de Calificaciones'}
              </h3>
              <p className="text-xs text-slate-500">
                Selecciona entre captura manual tradicional o captura rápida automatizada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Main Tabs: Captura Manual vs Captura Rápida */}
            {!editingCalif && (
              <div className="flex items-center p-1 bg-slate-200/70 rounded-xl border border-slate-300/60">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound?.();
                    setActiveTab('manual');
                  }}
                  className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'manual'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 size={14} />
                  <span>Captura Manual</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound?.();
                    setActiveTab('rapida');
                  }}
                  className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'rapida'
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Captura Rápida</span>
                </button>
              </div>
            )}

            <button
              onClick={handleModalClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-colors cursor-pointer ml-1"
              title="Cerrar ventana"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* ============================================================== */}
          {/* TAB 1: CAPTURA MANUAL (Diseño Original y Elementos Solicitados) */}
          {/* ============================================================== */}
          {activeTab === 'manual' && (
            <form onSubmit={handleSubmitManual} className="space-y-4 max-w-xl mx-auto">
              <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl text-xs text-blue-800 flex items-start gap-2.5 mb-2">
                <FileText size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Formulario de Captura Individual:</span> Ingresa los datos del alumno, materia y período para registrar la calificación individual en el sistema y sincronizar con Google Sheets.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Alumno
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez García"
                  list="alumnos-datalist"
                  value={formAlumno}
                  onChange={(e) => setFormAlumno(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <datalist id="alumnos-datalist">
                  {alumnosList.map(a => (
                    <option key={a.id} value={`${a.nombres} ${a.apellidos}`} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Materia
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Matemáticas Avanzadas"
                  list="materias-datalist"
                  value={formMateria}
                  onChange={(e) => setFormMateria(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <datalist id="materias-datalist">
                  {materiasList.map(m => (
                    <option key={m.id} value={m.nombre} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Período / Parcial
                  </label>
                  <select
                    value={formParcial}
                    onChange={(e) => setFormParcial(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Primer Parcial">Primer Parcial</option>
                    <option value="Segundo Parcial">Segundo Parcial</option>
                    <option value="Tercer Parcial">Tercer Parcial</option>
                    <option value="Cuarto Parcial">Cuarto Parcial</option>
                    <option value="Examen Ordinario">Examen Ordinario</option>
                    <option value="Examen Final">Examen Final</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Calificación (0 - 10)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    required
                    value={formCalificacion}
                    onChange={(e) => setFormCalificacion(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                >
                  {editingCalif ? 'Guardar Cambios' : 'Registrar Calificación'}
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* TAB 2: CAPTURA RÁPIDA (Subir Archivo Excel o Imagen con IA)    */}
          {/* ============================================================== */}
          {activeTab === 'rapida' && (
            <div className="space-y-6">
              {/* Secondary Sub-menu Pill: Subir Archivo Excel vs Imagen */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound?.();
                      setQuickMode('excel');
                    }}
                    className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      quickMode === 'excel'
                        ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet size={16} className={quickMode === 'excel' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span>Subir Archivo Excel (.xlsx / .csv)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClickSound?.();
                      setQuickMode('imagen');
                    }}
                    className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      quickMode === 'imagen'
                        ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon size={16} className={quickMode === 'imagen' ? 'text-purple-600' : 'text-slate-400'} />
                    <span>Imagen (Lectura Inteligente IA)</span>
                  </button>
                </div>

                {quickMode === 'excel' && (
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer"
                    title="Descargar archivo Excel de ejemplo con las columnas necesarias"
                  >
                    <Download size={14} />
                    <span>Descargar Plantilla Excel</span>
                  </button>
                )}
              </div>

              {/* OPTION A: SUBIR ARCHIVO EXCEL */}
              {quickMode === 'excel' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Drag and Drop Zone */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/30 hover:bg-emerald-50/60 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleExcelFileChange}
                      accept=".xlsx, .xls, .csv" 
                      className="hidden" 
                    />
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <UploadCloud size={28} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        {excelFile ? excelFile.name : 'Haz clic o arrastra tu archivo Excel aquí'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Formatos soportados: <strong className="text-emerald-700">.XLSX, .XLS o .CSV</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white/80 px-3 py-1 rounded-full border border-slate-200/80">
                      <span>Columnas requeridas: <strong>Alumno, Materia, Parcial, Calificación</strong></span>
                    </div>
                  </div>

                  {/* Processing / Error Feedback */}
                  {isProcessingExcel && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-3 text-xs text-slate-600">
                      <RefreshCw size={16} className="animate-spin text-emerald-600" />
                      <span>Leyendo archivo Excel y extrayendo calificaciones...</span>
                    </div>
                  )}

                  {excelError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-700">
                      <AlertCircle size={18} className="shrink-0" />
                      <span>{excelError}</span>
                    </div>
                  )}

                  {excelSuccessCount !== null && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                        <span><strong>¡Excelente!</strong> Se importaron con éxito <strong>{excelSuccessCount}</strong> calificaciones.</span>
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors"
                      >
                        Finalizar
                      </button>
                    </div>
                  )}

                  {/* Preview Table of Extracted Excel Data */}
                  {excelPreviewData.length > 0 && excelSuccessCount === null && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">
                          Vista Previa de Datos Extraídos ({excelPreviewData.length} registros encontrados):
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          {excelPreviewData.filter(r => r.valido).length} listos para importar
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Estado</th>
                              <th className="py-2.5 px-3">Alumno</th>
                              <th className="py-2.5 px-3">Materia</th>
                              <th className="py-2.5 px-3">Parcial</th>
                              <th className="py-2.5 px-3 text-right">Calificación</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {excelPreviewData.map((row, idx) => (
                              <tr key={idx} className={row.valido ? 'hover:bg-slate-50/80' : 'bg-rose-50/50'}>
                                <td className="py-2 px-3">
                                  {row.valido ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      ✓ Correcto
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800" title={row.errorMsg}>
                                      ✕ {row.errorMsg || 'Error'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-800">{row.alumno}</td>
                                <td className="py-2 px-3 text-slate-600">{row.materia}</td>
                                <td className="py-2 px-3 text-slate-500">{row.parcial}</td>
                                <td className="py-2 px-3 text-right font-bold text-slate-800">
                                  <span className={`px-2 py-0.5 rounded-full ${
                                    row.calificacion >= 9 ? 'bg-emerald-50 text-emerald-700' :
                                    row.calificacion >= 7 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {row.calificacion.toFixed(1)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setExcelFile(null);
                            setExcelPreviewData([]);
                          }}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                        >
                          Limpiar
                        </button>
                        <button
                          type="button"
                          onClick={handleImportExcelData}
                          disabled={excelPreviewData.filter(r => r.valido).length === 0}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                        >
                          <CheckCircle size={15} />
                          <span>Importar {excelPreviewData.filter(r => r.valido).length} Calificaciones al Sistema</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OPTION B: SUBIR IMAGEN (Lectura Inteligente IA) */}
              {quickMode === 'imagen' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* AI Banner */}
                  <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-purple-100 text-purple-700 rounded-xl shrink-0 mt-0.5">
                      <Sparkles size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                          Extracción Inteligente de Calificaciones desde Imagen (OCR & IA)
                        </h4>
                        {/* Optional Personal Gemini API Key Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound?.();
                            setShowApiKeySettings(!showApiKeySettings);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-200/60 hover:bg-purple-200 text-purple-900 transition-colors cursor-pointer w-fit"
                          title="Configurar clave de API personal (opcional)"
                        >
                          <Key size={12} />
                          <span>{customApiKey ? 'Clave Gemini Personal Activa' : 'Configurar Clave Gemini (Opcional)'}</span>
                        </button>
                      </div>
                      <p className="text-xs text-purple-700 mt-1 leading-relaxed">
                        Sube una fotografía o escaneo de tu lista de calificaciones en papel, acta física o pizarrón. La Inteligencia Artificial extraerá automáticamente el <strong>Alumno</strong>, <strong>Materia</strong>, <strong>Período</strong> y <strong>Calificación</strong> para cargarlos directamente en el sistema.
                      </p>
                    </div>
                  </div>

                  {/* Expandable Optional API Key Panel (Like Planeaciones) */}
                  {showApiKeySettings && (
                    <div className="p-3.5 bg-slate-50 border border-purple-200 rounded-xl space-y-2 text-xs animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Key size={13} className="text-purple-600" />
                          <span>Clave de API Gemini Personal (Opcional)</span>
                        </label>
                        {savedApiKeyNotice && (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                            <Check size={12} /> ¡Guardada!
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Si dejas este campo vacío, se utilizará la clave del sistema. Si prefieres usar tu propia clave gratuita de Google AI Studio (como en la app de Planeaciones), ingrésala aquí:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={customApiKey}
                          onChange={(e) => handleSaveCustomApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-purple-500"
                        />
                        {customApiKey && (
                          <button
                            type="button"
                            onClick={() => handleSaveCustomApiKey('')}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Context Preferences: Default Period and Subject */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Período / Parcial por defecto:
                      </label>
                      <select
                        value={imageDefaultParcial}
                        onChange={(e) => setImageDefaultParcial(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                      >
                        <option value="Primer Parcial">Primer Parcial</option>
                        <option value="Segundo Parcial">Segundo Parcial</option>
                        <option value="Tercer Parcial">Tercer Parcial</option>
                        <option value="Examen Final">Examen Final</option>
                        <option value="Extraordinario">Extraordinario</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Materia (si la imagen no especifica):
                      </label>
                      <select
                        value={imageDefaultMateria}
                        onChange={(e) => setImageDefaultMateria(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Auto-detectar o usar primera materia</option>
                        {materiasList.map((m) => (
                          <option key={m.id} value={m.nombre}>
                            {m.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Drag and Drop Zone for Image */}
                  <div 
                    onClick={() => imageInputRef.current?.click()}
                    className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/20 hover:bg-purple-50/50 rounded-2xl p-5 sm:p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
                  >
                    <input 
                      type="file" 
                      ref={imageInputRef}
                      onChange={handleImageFileChange}
                      accept="image/png, image/jpeg, image/webp, image/jpg" 
                      className="hidden" 
                    />
                    
                    {imagePreviewUrl ? (
                      <div className="relative max-h-48 rounded-xl overflow-hidden border border-purple-200 shadow-sm bg-slate-900/5">
                        <img 
                          src={imagePreviewUrl} 
                          alt="Lista de Calificaciones" 
                          className="max-h-48 object-contain mx-auto"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          Haz clic para cambiar imagen
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                          <ImageIcon size={28} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">
                            Haz clic o arrastra tu fotografía o escaneo de calificaciones
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Formatos soportados: <strong className="text-purple-700">JPG, PNG, WEBP</strong> (se comprime en el navegador antes de enviar)
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Image Processing Action Button */}
                  {imageFile && imagePreviewData.length === 0 && imageSuccessCount === null && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Archivo seleccionado: <strong>{imageFile.name}</strong></span>
                        <span className="text-slate-400">{(imageFile.size / 1024).toFixed(1)} KB original</span>
                      </div>
                      
                      <button
                        type="button"
                        disabled={isProcessingImage}
                        onClick={handleProcessImageWithAI}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-75 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                      >
                        {isProcessingImage ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Analizando lista con Gemini IA... Extrayendo alumnos y notas...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} />
                            <span>Analizar y Extraer Calificaciones con IA</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Error Notification */}
                  {imageError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in duration-150">
                      <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-bold block">No se pudo completar el análisis:</span>
                        <p className="mt-0.5 text-rose-700">{imageError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleProcessImageWithAI}
                        disabled={isProcessingImage}
                        className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}

                  {/* Success Notification */}
                  {imageSuccessCount !== null && (
                    <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in duration-200">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle size={26} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900">¡Calificaciones Importadas con Éxito!</h4>
                        <p className="text-xs text-emerald-700 mt-1">
                          Se han registrado <strong>{imageSuccessCount} calificaciones</strong> extraídas por IA y están sincronizadas con el sistema y Google Sheets.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreviewUrl(null);
                            setImagePreviewData([]);
                            setImageSuccessCount(null);
                          }}
                          className="px-4 py-2 bg-white border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl hover:bg-emerald-50 cursor-pointer shadow-xs"
                        >
                          Escanear otra imagen
                        </button>
                        <button
                          type="button"
                          onClick={handleModalClose}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                        >
                          Finalizar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preview Table of Extracted Image Data */}
                  {imagePreviewData.length > 0 && imageSuccessCount === null && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <Sparkles size={14} className="text-purple-600" />
                          <span>Calificaciones detectadas por IA ({imagePreviewData.length} alumnos):</span>
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          {imagePreviewData.filter(r => r.valido).length} listos para importar
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Estado</th>
                              <th className="py-2.5 px-3">Alumno</th>
                              <th className="py-2.5 px-3">Materia</th>
                              <th className="py-2.5 px-3">Parcial</th>
                              <th className="py-2.5 px-3 text-right">Calificación</th>
                              <th className="py-2.5 px-3 text-center">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {imagePreviewData.map((row, idx) => (
                              <tr key={idx} className={row.valido ? 'hover:bg-slate-50/80' : 'bg-rose-50/50'}>
                                <td className="py-2 px-3">
                                  {row.valido ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                      ✓ Correcto
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800" title={row.errorMsg}>
                                      ✕ {row.errorMsg || 'Error'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-800">
                                  <input
                                    type="text"
                                    value={row.alumno}
                                    onChange={(e) => {
                                      const updated = [...imagePreviewData];
                                      updated[idx].alumno = e.target.value;
                                      updated[idx].valido = e.target.value.trim().length > 0 && updated[idx].calificacion >= 0 && updated[idx].calificacion <= 10;
                                      setImagePreviewData(updated);
                                    }}
                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white px-1 py-0.5 rounded outline-none"
                                  />
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  <input
                                    type="text"
                                    value={row.materia}
                                    onChange={(e) => {
                                      const updated = [...imagePreviewData];
                                      updated[idx].materia = e.target.value;
                                      setImagePreviewData(updated);
                                    }}
                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white px-1 py-0.5 rounded outline-none"
                                  />
                                </td>
                                <td className="py-2 px-3 text-slate-500">{row.parcial}</td>
                                <td className="py-2 px-3 text-right">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={row.calificacion}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      const updated = [...imagePreviewData];
                                      updated[idx].calificacion = isNaN(val) ? 0 : val;
                                      updated[idx].valido = !isNaN(val) && val >= 0 && val <= 10 && updated[idx].alumno.trim().length > 0;
                                      setImagePreviewData(updated);
                                    }}
                                    className="w-16 text-right px-2 py-0.5 font-bold border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-purple-500"
                                  />
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setImagePreviewData(imagePreviewData.filter((_, i) => i !== idx));
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                                    title="Eliminar fila"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreviewUrl(null);
                            setImagePreviewData([]);
                          }}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 cursor-pointer w-full sm:w-auto"
                        >
                          Limpiar / Nueva Imagen
                        </button>
                        <button
                          type="button"
                          onClick={handleImportImageData}
                          disabled={imagePreviewData.filter(r => r.valido).length === 0}
                          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          <CheckCircle size={15} />
                          <span>Importar {imagePreviewData.filter(r => r.valido).length} Calificaciones al Sistema</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Los archivos e imágenes sólo se procesan en memoria para extraer calificaciones y <strong>no se almacenan</strong> en Drive ni el servidor.</span>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-colors cursor-pointer text-xs"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
