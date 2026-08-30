export const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
export const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface WorkspaceSetupResult {
  rootFolderId: string;
  rootFolderUrl: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  subfolders: { name: string; id: string; url: string }[];
}

export async function createDriveFolder(token: string, folderName: string, parentId?: string) {
  const body: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  
  if (parentId) {
    body.parents = [parentId];
  }

  const response = await fetch(DRIVE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const err = await response.text();
    console.error('Error al crear la carpeta en Drive:', err);
    throw new Error('Error al crear la carpeta en Drive: ' + err);
  }
  return response.json();
}

export async function searchDriveFiles(token: string, query: string) {
  const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=20`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) return { files: [] };
  return response.json();
}

export async function createSpreadsheet(token: string, title: string) {
  return createFullMasterSpreadsheet(token, title);
}

export async function writeSheetHeaders(token: string, spreadsheetId: string) {
  return writeAllMasterHeaders(token, spreadsheetId);
}

export async function createFullMasterSpreadsheet(token: string, title: string) {
  const response = await fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Alumnos' } },
        { properties: { title: 'Maestros' } },
        { properties: { title: 'Materias' } },
        { properties: { title: 'Calificaciones' } },
        { properties: { title: 'Control_Escolar' } },
        { properties: { title: 'Kardex' } },
        { properties: { title: 'Usuarios_Sistema' } },
        { properties: { title: 'Avisos_y_Tareas' } },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Error al crear la hoja de cálculo:', err);
    throw new Error('Error al crear la base de datos en Google Sheets: ' + err);
  }
  return response.json();
}

export async function moveFileToFolder(token: string, fileId: string, folderId: string) {
  try {
    const getFileResponse = await fetch(`${DRIVE_API_URL}/${fileId}?fields=parents`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const fileData = await getFileResponse.json();
    const previousParents = fileData.parents ? fileData.parents.join(',') : '';

    const response = await fetch(
      `${DRIVE_API_URL}/${fileId}?addParents=${folderId}&removeParents=${previousParents}`, 
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error('Error al mover el archivo a la carpeta');
    return response.json();
  } catch (err) {
    console.warn('Advertencia al mover archivo a la carpeta:', err);
  }
}

export async function writeAllMasterHeaders(token: string, spreadsheetId: string) {
  const headersData = [
    {
      range: 'Alumnos!A1:I1',
      values: [['ID', 'Matrícula', 'Nombres', 'Apellidos', 'Grado / Grupo', 'Carrera / Nivel', 'Correo Electrónico', 'Estatus', 'Fecha de Registro']]
    },
    {
      range: 'Maestros!A1:F1',
      values: [['ID', 'Nombre Completo', 'Especialidad', 'Correo Electrónico', 'Teléfono', 'Estatus']]
    },
    {
      range: 'Materias!A1:F1',
      values: [['ID', 'Clave', 'Nombre de Materia', 'Grado / Semestre', 'Créditos', 'Maestro Asignado']]
    },
    {
      range: 'Calificaciones!A1:G1',
      values: [['ID', 'Alumno', 'Materia', 'Parcial / Periodo', 'Calificación', 'Estatus', 'Fecha de Registro']]
    },
    {
      range: 'Control_Escolar!A1:F1',
      values: [['ID Registro', 'Ciclo Escolar', 'Periodo', 'Turno', 'Inscritos Totales', 'Estatus']]
    },
    {
      range: 'Kardex!A1:F1',
      values: [['ID Kardex', 'Alumno', 'Promedio General', 'Materias Cursadas', 'Créditos Acumulados', 'Estatus Académico']]
    },
    {
      range: 'Usuarios_Sistema!A1:H1',
      values: [['ID Usuario', 'Usuario (Login)', 'Contraseña', 'Nombre Completo', 'Correo Electrónico', 'Rol / Función', 'Estado', 'Fecha Registro']]
    },
    {
      range: 'Avisos_y_Tareas!A1:G1',
      values: [['ID Aviso', 'Tipo', 'Emisor', 'Destinatario', 'Mensaje / Tarea', 'Fecha Programada', 'Fecha y Hora de Publicación']]
    }
  ];

  const response = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: headersData,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Error al escribir los encabezados:', err);
    throw new Error('Error al escribir los encabezados en la hoja de Google Sheets');
  }
  return response.json();
}

export async function syncAllDataToSheets(token: string, spreadsheetId: string, appData: any) {
  const {
    studentsList = [],
    teachersList = [],
    materiasList = [],
    calificacionesList = [],
    controlRecords = [],
    kardexList = [],
    systemUsers = [],
    avisosList = []
  } = appData;

  const alumnosRows = studentsList.map((s: any) => [
    s.id || '',
    s.matricula || `MAT-${s.id?.slice(-4) || '001'}`,
    s.nombres || s.nombre || '',
    s.apellidos || '',
    s.grado || s.grupo || '1er Grado',
    s.carrera || s.nivel || 'General',
    s.email || '',
    s.estatus || 'Activo',
    s.fechaRegistro || s.fechaInscripcion || new Date().toISOString().split('T')[0]
  ]);

  const maestrosRows = teachersList.map((m: any) => [
    m.id || '',
    m.name || m.nombre || '',
    m.especialidad || m.role || 'Docente',
    m.email || '',
    m.telefono || '',
    m.status || m.estatus || 'Activo'
  ]);

  const materiasRows = materiasList.map((mat: any) => [
    mat.id || '',
    mat.clave || `MAT-${mat.id?.slice(-3) || '101'}`,
    mat.nombre || '',
    mat.grado || mat.semestre || '1er Grado',
    mat.creditos !== undefined ? mat.creditos : 6,
    mat.profesor || mat.maestro || 'Por Asignar'
  ]);

  const calificacionesRows = calificacionesList.map((c: any) => [
    c.id || '',
    c.alumno || '',
    c.materia || '',
    c.parcial || 'Primer Parcial',
    c.calificacion !== undefined ? c.calificacion : 0,
    (Number(c.calificacion) >= 6 ? 'Aprobado' : 'Reprobado'),
    c.fecha || new Date().toISOString().split('T')[0]
  ]);

  const controlRows = controlRecords.map((cr: any) => [
    cr.id || '',
    cr.cicloEscolar || '2026-1',
    cr.periodo || 'Enero - Junio 2026',
    cr.turno || 'Matutino',
    cr.inscritos !== undefined ? cr.inscritos : studentsList.length,
    cr.estatus || 'Activo'
  ]);

  const kardexRows = kardexList.map((k: any) => [
    k.id || '',
    k.alumno || '',
    k.promedioGeneral || '9.0',
    k.materiasCursadas || materiasList.length,
    k.creditosAcumulados || materiasList.reduce((acc: number, m: any) => acc + (Number(m.creditos) || 0), 0),
    k.estatusAcademico || 'Regular'
  ]);

  const usuariosRows = systemUsers.map((u: any) => [
    u.id || '',
    u.username || (u.name ? u.name.toLowerCase().replace(/\s+/g, '_') : ''),
    u.password || '123456',
    u.name || u.nombre || '',
    u.email || '',
    u.role || 'Control Escolar',
    u.status || 'Activo',
    u.fechaRegistro || u.lastAccess || new Date().toISOString().split('T')[0]
  ]);

  const avisosRows = avisosList.map((a: any) => [
    a.id || '',
    a.type === 'tarea' ? 'Tarea Programada' : a.type === 'publico' ? 'Aviso Público' : 'Aviso Personal',
    a.senderName || 'Sistema',
    a.targetName || (a.type === 'publico' ? 'Todos' : 'General'),
    a.message || '',
    a.date || 'N/A',
    a.timestamp || new Date().toLocaleString()
  ]);

  // First clear old data A2:Z1000 in each sheet
  const clearRanges = [
    'Alumnos!A2:I200',
    'Maestros!A2:F200',
    'Materias!A2:F200',
    'Calificaciones!A2:G200',
    'Control_Escolar!A2:F200',
    'Kardex!A2:F200',
    'Usuarios_Sistema!A2:H200',
    'Avisos_y_Tareas!A2:G200'
  ];

  await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ranges: clearRanges })
  }).catch(e => console.warn('Clear non-fatal error:', e));

  const dataToUpdate = [
    { range: 'Alumnos!A2', values: alumnosRows.length ? alumnosRows : [['', '', '', '', '', '', '', '', '']] },
    { range: 'Maestros!A2', values: maestrosRows.length ? maestrosRows : [['', '', '', '', '', '']] },
    { range: 'Materias!A2', values: materiasRows.length ? materiasRows : [['', '', '', '', '', '']] },
    { range: 'Calificaciones!A2', values: calificacionesRows.length ? calificacionesRows : [['', '', '', '', '', '', '']] },
    { range: 'Control_Escolar!A2', values: controlRows.length ? controlRows : [['', '', '', '', '', '']] },
    { range: 'Kardex!A2', values: kardexRows.length ? kardexRows : [['', '', '', '', '', '']] },
    { range: 'Usuarios_Sistema!A2', values: usuariosRows.length ? usuariosRows : [['', '', '', '', '', '', '', '']] },
    { range: 'Avisos_y_Tareas!A2', values: avisosRows.length ? avisosRows : [['', '', '', '', '', '', '']] }
  ];

  const response = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: dataToUpdate,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Error al sincronizar datos en Sheets:', err);
    throw new Error('Error al sincronizar los datos en las hojas de Google Sheets');
  }

  return response.json();
}

export async function setupSysAcadWorkspace(token: string, appData: any): Promise<WorkspaceSetupResult> {
  const rootFolderName = 'SysAcad - Almacenamiento y Control Escolar';
  let rootFolderId = '';
  let rootFolderUrl = '';

  // 1. Check if Root Folder already exists
  const existingFolders = await searchDriveFiles(token, `name='${rootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  if (existingFolders.files && existingFolders.files.length > 0) {
    rootFolderId = existingFolders.files[0].id;
    rootFolderUrl = existingFolders.files[0].webViewLink || `https://drive.google.com/drive/folders/${rootFolderId}`;
  } else {
    const rootFolder = await createDriveFolder(token, rootFolderName);
    rootFolderId = rootFolder.id;
    rootFolderUrl = rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolderId}`;
  }

  // 2. Create/Verify Subfolders for storage
  const subfolderNames = [
    '01_Alumnos_Expedientes',
    '02_Maestros_y_Docentes',
    '03_Materias_y_Planes',
    '04_Calificaciones_y_Actas',
    '05_Control_Escolar',
    '06_Kardex_y_Reportes',
    '07_Usuarios_Sistema',
    '08_Avisos_y_Tareas_Programadas',
    '09_Respaldos_del_Sistema'
  ];

  const subfoldersList: { name: string; id: string; url: string }[] = [];

  for (const name of subfolderNames) {
    const existing = await searchDriveFiles(token, `name='${name}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    if (existing.files && existing.files.length > 0) {
      const f = existing.files[0];
      subfoldersList.push({ name: f.name, id: f.id, url: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}` });
    } else {
      const created = await createDriveFolder(token, name, rootFolderId);
      subfoldersList.push({ name, id: created.id, url: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}` });
    }
  }

  // 3. Create or Search Master Spreadsheet
  const spreadsheetTitle = 'SysAcad - Base de Datos Central.xlsx';
  let spreadsheetId = '';
  let spreadsheetUrl = '';

  const existingSheet = await searchDriveFiles(token, `name='${spreadsheetTitle}' and trashed=false`);
  if (existingSheet.files && existingSheet.files.length > 0) {
    spreadsheetId = existingSheet.files[0].id;
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  } else {
    const sheetObj = await createFullMasterSpreadsheet(token, spreadsheetTitle);
    spreadsheetId = sheetObj.spreadsheetId;
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    
    // Move spreadsheet into root Drive folder
    await moveFileToFolder(token, spreadsheetId, rootFolderId);
  }

  // 4. Write Headers for all 8 sheets
  await writeAllMasterHeaders(token, spreadsheetId);

  // 5. Sync all current data from app state into the sheets
  await syncAllDataToSheets(token, spreadsheetId, appData);

  return {
    rootFolderId,
    rootFolderUrl,
    spreadsheetId,
    spreadsheetUrl,
    subfolders: subfoldersList
  };
}

export async function loadFullDataFromSheets(token: string, spreadsheetId: string): Promise<any | null> {
  try {
    const ranges = [
      'Alumnos!A2:I200',
      'Maestros!A2:F200',
      'Materias!A2:F200',
      'Calificaciones!A2:G200',
      'Usuarios_Sistema!A2:H200',
      'Avisos_y_Tareas!A2:G200'
    ];

    const url = `${SHEETS_API_URL}/${spreadsheetId}/values:batchGet?ranges=${ranges.map(r => encodeURIComponent(r)).join('&ranges=')}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return null;
    const json = await res.json();
    const valueRanges = json.valueRanges || [];

    const alumnosRows = valueRanges[0]?.values || [];
    const materiasRows = valueRanges[2]?.values || [];
    const calificacionesRows = valueRanges[3]?.values || [];
    const usuariosRows = valueRanges[4]?.values || [];
    const avisosRows = valueRanges[5]?.values || [];

    const loadedAlumnos = alumnosRows
      .filter((r: any[]) => r && r[2])
      .map((r: any[], idx: number) => ({
        id: r[0] || `a-${Date.now()}-${idx}`,
        nombres: r[2] || '',
        apellidos: r[3] || '',
        grado: r[4] || '1er Grado',
        email: r[6] || '',
        fechaInscripcion: r[8] || new Date().toISOString().split('T')[0]
      }));

    const loadedMaterias = materiasRows
      .filter((r: any[]) => r && r[2])
      .map((r: any[], idx: number) => ({
        id: r[0] || `m-${Date.now()}-${idx}`,
        nombre: r[2] || '',
        profesor: r[5] || '',
        creditos: parseInt(r[4], 10) || 6
      }));

    const loadedCalificaciones = calificacionesRows
      .filter((r: any[]) => r && r[1] && r[2])
      .map((r: any[], idx: number) => ({
        id: r[0] || `c-${Date.now()}-${idx}`,
        alumno: r[1] || '',
        materia: r[2] || '',
        parcial: r[3] || 'Primer Parcial',
        calificacion: parseFloat(r[4]) || 0,
        fecha: r[6] || new Date().toISOString().split('T')[0]
      }));

    const loadedUsers = usuariosRows
      .filter((r: any[]) => r && (r[1] || r[3]))
      .map((r: any[], idx: number) => ({
        id: r[0] || `${Date.now()}-${idx}`,
        username: r[1] || `user_${idx + 1}`,
        password: r[2] || '123456',
        name: r[3] || r[1] || 'Usuario',
        email: r[4] || '',
        role: r[5] || 'Control Escolar',
        status: r[6] || 'Activo',
        lastAccess: r[7] || 'Reciente'
      }));

    const loadedAvisos = avisosRows
      .filter((r: any[]) => r && r[4])
      .map((r: any[], idx: number) => ({
        id: r[0] || `av-${Date.now()}-${idx}`,
        type: r[1] === 'Tarea Programada' ? 'tarea' : r[1] === 'Aviso Público' ? 'publico' : 'personal',
        senderId: 'sistema',
        senderName: r[2] || 'Sistema',
        targetName: r[3] || '',
        message: r[4] || '',
        date: r[5] !== 'N/A' ? r[5] : undefined,
        timestamp: r[6] || new Date().toLocaleString()
      }));

    return {
      alumnos: loadedAlumnos,
      materias: loadedMaterias,
      calificaciones: loadedCalificaciones,
      users: loadedUsers,
      avisos: loadedAvisos
    };
  } catch (e) {
    console.warn('Could not load all tables from sheets:', e);
    return null;
  }
}

export async function fetchUsersFromSheets(token: string, spreadsheetId: string): Promise<any[]> {
  try {
    const url = `${SHEETS_API_URL}/${spreadsheetId}/values/Usuarios_Sistema!A2:H200`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return [];
    const data = await response.json();
    const rows = data.values || [];
    return rows
      .filter((r: any[]) => r && r.length > 0 && (r[1] || r[3]))
      .map((r: any[], idx: number) => ({
        id: r[0] || `${Date.now()}-${idx}`,
        username: r[1] || `user_${idx + 1}`,
        password: r[2] || '123456',
        name: r[3] || r[1] || 'Usuario',
        email: r[4] || '',
        role: r[5] || 'Control Escolar',
        status: r[6] || 'Activo',
        lastAccess: r[7] || 'Reciente'
      }));
  } catch (err) {
    console.warn('Error fetching users from sheet:', err);
    return [];
  }
}

export async function syncUsersToSheet(token: string, spreadsheetId: string, users: any[]) {
  const rows = users.map((u: any) => [
    u.id || '',
    u.username || (u.name ? u.name.toLowerCase().replace(/\s+/g, '_') : ''),
    u.password || '123456',
    u.name || u.nombre || '',
    u.email || '',
    u.role || 'Control Escolar',
    u.status || 'Activo',
    u.fechaRegistro || u.lastAccess || new Date().toISOString().split('T')[0]
  ]);

  await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ranges: ['Usuarios_Sistema!A2:H200'] })
  }).catch(() => {});

  const response = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/Usuarios_Sistema!A2?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: rows.length ? rows : [['', '', '', '', '', '', '', '']] })
  });

  if (!response.ok) {
    throw new Error('Error al sincronizar usuarios en Google Sheets');
  }
  return response.json();
}


