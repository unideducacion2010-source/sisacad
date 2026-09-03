export interface SubfolderInfo {
  name: string;
  id: string;
  url: string;
}

export interface WorkspaceSetupData {
  rootFolderId?: string;
  rootFolderUrl?: string;
  cycleFolderId?: string;
  cycleFolderUrl?: string;
  cycleFolderName?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  subfolders?: SubfolderInfo[];
}

export type DriveCategory = 
  | 'alumnos' 
  | 'maestros' 
  | 'docentes' 
  | 'materias' 
  | 'calificaciones' 
  | 'kardex' 
  | 'asistencia' 
  | 'asistencias'
  | 'credenciales'
  | 'carnets'
  | 'informes'
  | 'estadisticas'
  | 'usuarios'
  | 'avisos'
  | 'tareas'
  | 'respaldos'
  | 'ciclo' 
  | 'control-escolar' 
  | 'reportes'
  | 'general';

export interface DriveLinkResolution {
  url: string;
  folderName: string;
  buttonLabel: string;
  tooltip: string;
  isSpecificFolder: boolean;
}

/**
 * Resolves the most specific Google Drive folder URL for any active window/tab.
 */
export function resolveDriveFolderLink(
  category: DriveCategory,
  workspaceResult?: WorkspaceSetupData | null,
  folderLink?: string | null,
  sheetLink?: string | null
): DriveLinkResolution {
  // If workspaceResult is not passed in props, check localStorage
  let ws: WorkspaceSetupData | null = workspaceResult || null;
  if (!ws) {
    try {
      const saved = localStorage.getItem('sysacad_workspace_result');
      if (saved) {
        ws = JSON.parse(saved);
      }
    } catch (e) {
      ws = null;
    }
  }

  const subfolders = ws?.subfolders || [];

  // Search matching subfolder
  if (subfolders.length > 0) {
    let matched: SubfolderInfo | undefined;

    switch (category) {
      case 'alumnos':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('01_') || n.includes('alumno') || n.includes('expediente');
        });
        break;

      case 'maestros':
      case 'docentes':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('02_') || n.includes('maestro') || n.includes('docente') || n.includes('profesor');
        });
        break;

      case 'materias':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('03_') || n.includes('materia') || n.includes('plan');
        });
        break;

      case 'calificaciones':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('04_') || n.includes('calificaci') || n.includes('acta');
        });
        break;

      case 'asistencia':
      case 'asistencias':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('10_') || n.includes('asistencia') || n.includes('lista');
        }) || subfolders.find(f => f.name.toLowerCase().includes('05_') || f.name.toLowerCase().includes('control'));
        break;

      case 'credenciales':
      case 'carnets':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('11_') || n.includes('credencial') || n.includes('formato') || n.includes('carnet');
        }) || subfolders.find(f => f.name.toLowerCase().includes('01_') || f.name.toLowerCase().includes('alumno'));
        break;

      case 'informes':
      case 'estadisticas':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('12_') || n.includes('informe') || n.includes('estadistica');
        }) || subfolders.find(f => f.name.toLowerCase().includes('06_') || f.name.toLowerCase().includes('reporte'));
        break;

      case 'usuarios':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('07_') || n.includes('usuario');
        });
        break;

      case 'avisos':
      case 'tareas':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('08_') || n.includes('aviso') || n.includes('tarea');
        });
        break;

      case 'respaldos':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('09_') || n.includes('respaldo');
        });
        break;

      case 'control-escolar':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('05_') || n.includes('control');
        }) || subfolders.find(f => f.name.toLowerCase().includes('06_') || f.name.toLowerCase().includes('kardex'));
        break;

      case 'kardex':
      case 'reportes':
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('06_') || n.includes('kardex') || n.includes('reporte');
        }) || subfolders.find(f => f.name.toLowerCase().includes('04_') || f.name.toLowerCase().includes('calificaci'));
        break;

      case 'ciclo':
      case 'general':
      default:
        matched = subfolders.find(f => {
          const n = f.name.toLowerCase();
          return n.includes('06_') || n.includes('reporte') || n.includes('control');
        });
        break;
    }

    if (matched && matched.url) {
      const cleanName = matched.name.replace(/^\d+_/, '').replace(/_/g, ' ');
      return {
        url: matched.url,
        folderName: cleanName,
        buttonLabel: 'Abrir',
        tooltip: `Abrir carpeta oficial de Google Drive: "${cleanName}" para consultar o imprimir reportes`,
        isSpecificFolder: true
      };
    }
  }

  // Fallback 1: Active Cycle Folder
  const cycleUrl = ws?.cycleFolderUrl || localStorage.getItem('sysacad_cycle_folder_link');
  if (cycleUrl) {
    const cycleName = ws?.cycleFolderName || 'Ciclo Escolar Activo';
    return {
      url: cycleUrl,
      folderName: cycleName,
      buttonLabel: 'Abrir',
      tooltip: `Abrir carpeta en Google Drive de "${cycleName}"`,
      isSpecificFolder: true
    };
  }

  // Fallback 2: Root SysAcad Folder
  const rootUrl = ws?.rootFolderUrl || folderLink || localStorage.getItem('sysacad_root_folder_link');
  if (rootUrl) {
    return {
      url: rootUrl,
      folderName: 'Carpeta Principal Drive',
      buttonLabel: 'Abrir',
      tooltip: 'Abrir carpeta principal institucional en Google Drive',
      isSpecificFolder: true
    };
  }

  // Fallback 3: Google Sheets database
  const sheetsUrl = ws?.spreadsheetUrl || sheetLink || localStorage.getItem('sysacad_sheet_link');
  if (sheetsUrl) {
    return {
      url: sheetsUrl,
      folderName: 'Google Sheets',
      buttonLabel: 'Abrir',
      tooltip: 'Abrir hoja de cálculo institucional vinculada en Google Sheets',
      isSpecificFolder: false
    };
  }

  // Fallback 4: General Drive
  return {
    url: 'https://drive.google.com/drive/my-drive',
    folderName: 'Google Drive',
    buttonLabel: 'Abrir',
    tooltip: 'Abrir Google Drive en una nueva pestaña',
    isSpecificFolder: false
  };
}
