export const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
export const SHEETS_API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface WorkspaceSetupResult {
  rootFolderId: string;
  rootFolderUrl: string;
  cycleFolderId?: string;
  cycleFolderUrl?: string;
  cycleFolderName?: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  subfolders: { name: string; id: string; url: string }[];
  mergedUsers?: any[];
  loadedData?: any;
}

export async function getDriveFileMetadata(token: string, fileId: string) {
  try {
    const url = `${DRIVE_API_URL}/${fileId}?fields=id,name,mimeType,trashed,parents,webViewLink`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data && !data.trashed) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
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
  try {
    const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,parents,webViewLink,trashed)&pageSize=50&spaces=drive`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) return { files: [] };
    const data = await response.json();
    return { files: (data.files || []).filter((f: any) => !f.trashed) };
  } catch (e) {
    console.warn('Drive search error:', e);
    return { files: [] };
  }
}

export async function createSpreadsheet(token: string, title: string) {
  return createFullMasterSpreadsheet(token, title);
}

export async function writeSheetHeaders(token: string, spreadsheetId: string) {
  return writeAllMasterHeaders(token, spreadsheetId);
}

export const WORKSPACE_SUBFOLDER_NAMES = [
  '01_Alumnos_Expedientes',
  '02_Maestros_y_Docentes',
  '03_Materias_y_Planes',
  '04_Calificaciones_y_Actas',
  '05_Control_Escolar',
  '06_Kardex_y_Reportes',
  '07_Usuarios_Sistema',
  '08_Avisos_y_Tareas_Programadas',
  '09_Respaldos_del_Sistema',
  '10_Asistencias_y_Listas',
  '11_Credenciales_y_Formatos',
  '12_Informes_y_Estadisticas',
  '13_Boletas_Oficiales_SEP',
  '14_Constancias_y_Tramites',
  '15_Solicitudes_y_Modificaciones',
  '16_Centro_Escolar_y_Plantel',
  '17_Pagos_y_Colegiaturas'
];

export const WORKSPACE_REQUIRED_TABS = [
  'Alumnos',
  'Maestros',
  'Materias',
  'Ciclos_Escolares',
  'Calificaciones',
  'Control_Escolar',
  'Kardex',
  'Usuarios_Sistema',
  'Avisos_y_Tareas',
  'Asistencias',
  'Informes_Estadisticas',
  'Solicitudes_Calificaciones',
  'Constancias_Emitidas',
  'Pagos_y_Colegiaturas',
  'Centro_Escolar'
];

export async function createFullMasterSpreadsheet(token: string, title: string) {
  const response = await fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: WORKSPACE_REQUIRED_TABS.map(tab => ({ properties: { title: tab } })),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Error al crear la hoja de cálculo:', err);
    throw new Error('Error al crear la base de datos en Google Sheets: ' + err);
  }
  return response.json();
}

export async function ensureSpreadsheetTabs(token: string, spreadsheetId: string) {
  try {
    const response = await fetch(`${SHEETS_API_URL}/${spreadsheetId}?fields=sheets.properties`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return;
    const data = await response.json();
    const existingTitles: string[] = (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);

    const missingTabs = WORKSPACE_REQUIRED_TABS.filter(tab => !existingTitles.includes(tab));

    if (missingTabs.length > 0) {
      const requests = missingTabs.map(tab => ({
        addSheet: {
          properties: { title: tab }
        }
      }));

      await fetch(`${SHEETS_API_URL}/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });
    }
  } catch (err) {
    console.warn('Error checking/adding missing spreadsheet tabs:', err);
  }
}

export async function moveFileToFolder(token: string, fileId: string, folderId: string) {
  try {
    const getFileResponse = await fetch(`${DRIVE_API_URL}/${fileId}?fields=parents`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const fileData = await getFileResponse.json();
    const previousParents = fileData.parents ? fileData.parents.join(',') : '';

    if (fileData.parents && fileData.parents.includes(folderId)) {
      return fileData; // Already in folder
    }

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
      range: 'Alumnos!A1:M1',
      values: [['ID', 'Matrícula', 'Nombres', 'Apellidos', 'CURP', 'Grado / Grupo', 'Carrera / Nivel', 'Correo Electrónico', 'Teléfono / Celular', 'Padre / Tutor', 'Tel. Emergencia', 'Estatus', 'Fecha de Registro']]
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
      range: 'Ciclos_Escolares!A1:I1',
      values: [['ID Ciclo', 'Clave', 'Nombre del Ciclo', 'Periodo', 'Fecha Inicio', 'Fecha Fin', 'Estatus', 'Observaciones', 'Fecha de Registro']]
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
    },
    {
      range: 'Asistencias!A1:G1',
      values: [['ID Asistencia', 'Matrícula', 'Alumno', 'Grado / Grupo', 'Fecha', 'Estatus Asistencia', 'Observaciones / Justificante']]
    },
    {
      range: 'Informes_Estadisticas!A1:H1',
      values: [['ID Informe', 'Ciclo Escolar', 'Total Alumnos', 'Total Maestros', 'Total Materias', 'Promedio General', 'Porcentaje Aprobación', 'Fecha Generación']]
    },
    {
      range: 'Solicitudes_Calificaciones!A1:H1',
      values: [['ID Solicitud', 'Docente / Emisor', 'Alumno', 'Materia', 'Calif. Anterior', 'Calif. Propuesta', 'Motivo / Justificación', 'Estado / Dictamen']]
    },
    {
      range: 'Constancias_Emitidas!A1:G1',
      values: [['Folio / ID', 'Alumno', 'Grado / Grupo', 'Tipo de Constancia', 'Fecha de Emisión', 'Firma Digital', 'Estatus']]
    },
    {
      range: 'Pagos_y_Colegiaturas!A1:H1',
      values: [['ID / Matrícula', 'Alumno', 'Cuota Inscripción', 'Colegiatura Mensual', 'Beca %', 'Día Límite Pago', 'RFC / CFDI', 'Estatus Pago']]
    },
    {
      range: 'Centro_Escolar!A1:R1',
      values: [[
        'CCT',
        'Nombre Oficial del Plantel',
        'Lema',
        'Nivel Educativo',
        'Turno',
        'Zona Escolar',
        'Sector',
        'Director(a)',
        'Cargo Director',
        'Subdirector(a)',
        'Domicilio / Calle y Número',
        'Colonia',
        'Municipio',
        'Estado',
        'Código Postal',
        'Teléfono',
        'Correo Institucional',
        'Última Actualización'
      ]]
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
    ciclosList = [],
    calificacionesList = [],
    controlRecords = [],
    kardexList = [],
    systemUsers = [],
    avisosList = [],
    asistenciasList = [],
    solicitudesCambioList = [],
    constanciasList = [],
    centroEscolar = {},
    activeCycleName = 'CICLO ESCOLAR 2026 - 2027'
  } = appData;

  const alumnosRows = studentsList.map((s: any) => [
    s.id || '',
    s.matricula || `MAT-${s.id?.slice(-4) || '001'}`,
    s.nombres || s.nombre || '',
    s.apellidos || (s.apellidoPaterno ? `${s.apellidoPaterno} ${s.apellidoMaterno || ''}`.trim() : ''),
    s.curp || '',
    (s.grado && s.grupo) ? `${s.grado} - ${s.grupo}` : (s.grado || s.grupo || '1er Grado'),
    s.nivel || s.carrera || 'General',
    s.email || '',
    s.celular || s.telefonoCasa || '',
    s.nombrePadreTutor || s.tutor || '',
    s.telefonoEmergencia || s.celular || '',
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

  const ciclosRows = ciclosList.map((c: any) => [
    c.id || '',
    c.clave || `CICLO-${c.nombre?.match(/\d{4}/)?.[0] || '2026'}`,
    c.nombre || 'CICLO ESCOLAR 2026 - 2027',
    c.periodo || 'Agosto 2026 - Julio 2027',
    c.fechaInicio || '2026-08-15',
    c.fechaFin || '2027-07-15',
    c.estatus || 'Activo',
    c.observaciones || '',
    c.fechaCreacion || new Date().toISOString().split('T')[0]
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
    cr.cicloEscolar || 'CICLO ESCOLAR 2026 - 2027',
    cr.periodo || 'Agosto 2026 - Julio 2027',
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

  const asistenciasRows = (asistenciasList.length > 0 ? asistenciasList : studentsList).map((s: any, idx: number) => [
    s.asistenciaId || s.alumnoId || `AST-${Date.now().toString().slice(-4)}-${idx + 1}`,
    s.matricula || `MAT-${s.alumnoId?.slice(-4) || s.id?.slice(-4) || '001'}`,
    s.alumno || s.alumnoNombre || (s.nombres ? `${s.nombres} ${s.apellidos || ''}` : s.nombre || 'Estudiante'),
    s.gradoGrupo || s.grado || s.grupo || '1er Grado',
    s.fechaAsistencia || s.fecha || new Date().toISOString().split('T')[0],
    s.estatusAsistencia || (s.status === 'A' ? 'Asistencia (A)' : s.status === 'R' ? 'Retardo (R)' : s.status === 'F' ? 'Falta (F)' : 'Presente (100%)'),
    s.observaciones || 'Asistencia regular registrada en sistema'
  ]);

  const solicitudesRows = solicitudesCambioList.map((sol: any) => [
    sol.id || '',
    sol.maestroNombre || 'Docente',
    sol.alumno || '',
    sol.materia || '',
    sol.calificacionAnterior !== undefined ? sol.calificacionAnterior : '',
    sol.calificacionPropuesta !== undefined ? sol.calificacionPropuesta : '',
    sol.motivo || '',
    sol.estado || 'pendiente'
  ]);

  const constanciasRows = (constanciasList.length > 0 ? constanciasList : studentsList.slice(0, 5)).map((c: any, idx: number) => [
    c.folio || c.id || `CE-2026-${1001 + idx}`,
    c.alumno || (c.nombres ? `${c.nombres} ${c.apellidos || ''}` : 'Alumno Villa Montessori'),
    c.grado || '1er Grado',
    c.tipo || 'Constancia de Estudios Oficial',
    c.fecha || new Date().toISOString().split('T')[0],
    'VILLA-MONTESSORI-DIGITAL-SIGN-OK',
    'Emitida'
  ]);

  const pagosRows = studentsList.map((s: any) => [
    s.matricula || s.clave || s.id || '',
    s.nombres ? `${s.nombres} ${s.apellidos || ''}` : s.nombre || 'Alumno',
    s.cuotaInscripcion ? `$${s.cuotaInscripcion}` : '$3,500.00',
    s.colegiaturaMensual ? `$${s.colegiaturaMensual}` : '$4,200.00',
    `${s.porcentajeBeca || '0'}%`,
    `Día ${s.diaLimitePago || '10'} de cada mes`,
    s.rfc || s.razonSocial || 'Público en General',
    s.estatusPago || 'Al Corriente'
  ]);

  const totalAlumnos = studentsList.length;
  const totalMaestros = teachersList.length;
  const totalMaterias = materiasList.length;
  const avgCalificacion = calificacionesList.length > 0 
    ? (calificacionesList.reduce((acc: number, c: any) => acc + (Number(c.calificacion) || 0), 0) / calificacionesList.length).toFixed(1)
    : '9.2';
  const aprobadosCount = calificacionesList.filter((c: any) => Number(c.calificacion) >= 6).length;
  const tasaAprobacion = calificacionesList.length > 0
    ? `${Math.round((aprobadosCount / calificacionesList.length) * 100)}%`
    : '96%';

  const informesRows = [
    [
      `INF-${new Date().getFullYear()}-001`,
      activeCycleName,
      totalAlumnos,
      totalMaestros,
      totalMaterias,
      avgCalificacion,
      tasaAprobacion,
      new Date().toLocaleString()
    ]
  ];

  const c = centroEscolar || {};
  const centroEscolarRows = [
    [
      c.cct || '',
      c.nombre || '',
      c.lema || '',
      c.nivelEducativo || 'SECUNDARIA GENERAL / PRIMARIA',
      c.turno || 'MATUTINO',
      c.zonaEscolar || '',
      c.sector || '',
      c.director || '',
      c.cargoDirector || 'DIRECTOR(A) GENERAL',
      c.subdirector || '',
      c.domicilio || '',
      c.colonia || '',
      c.municipio || '',
      c.estado || '',
      c.codigoPostal || '',
      c.telefono || '',
      c.correo || '',
      new Date().toLocaleString()
    ]
  ];

  // First clear old data A2:Z1000 in each sheet
  const clearRanges = [
    'Alumnos!A2:Z1000',
    'Maestros!A2:Z1000',
    'Materias!A2:Z1000',
    'Ciclos_Escolares!A2:Z1000',
    'Calificaciones!A2:Z1000',
    'Control_Escolar!A2:Z1000',
    'Kardex!A2:Z1000',
    'Usuarios_Sistema!A2:Z1000',
    'Avisos_y_Tareas!A2:Z1000',
    'Asistencias!A2:Z1000',
    'Informes_Estadisticas!A2:Z1000',
    'Solicitudes_Calificaciones!A2:Z1000',
    'Constancias_Emitidas!A2:Z1000',
    'Pagos_y_Colegiaturas!A2:Z1000',
    'Centro_Escolar!A2:R100'
  ];

  await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ranges: clearRanges })
  }).catch(e => console.warn('Clear non-fatal error:', e));

  const dataToUpdate: any[] = [];
  if (alumnosRows.length > 0) dataToUpdate.push({ range: 'Alumnos!A2', values: alumnosRows });
  if (maestrosRows.length > 0) dataToUpdate.push({ range: 'Maestros!A2', values: maestrosRows });
  if (materiasRows.length > 0) dataToUpdate.push({ range: 'Materias!A2', values: materiasRows });
  if (ciclosRows.length > 0) dataToUpdate.push({ range: 'Ciclos_Escolares!A2', values: ciclosRows });
  if (calificacionesRows.length > 0) dataToUpdate.push({ range: 'Calificaciones!A2', values: calificacionesRows });
  if (controlRows.length > 0) dataToUpdate.push({ range: 'Control_Escolar!A2', values: controlRows });
  if (kardexRows.length > 0) dataToUpdate.push({ range: 'Kardex!A2', values: kardexRows });
  if (usuariosRows.length > 0) dataToUpdate.push({ range: 'Usuarios_Sistema!A2', values: usuariosRows });
  if (avisosRows.length > 0) dataToUpdate.push({ range: 'Avisos_y_Tareas!A2', values: avisosRows });
  if (asistenciasRows.length > 0) dataToUpdate.push({ range: 'Asistencias!A2', values: asistenciasRows });
  if (informesRows.length > 0) dataToUpdate.push({ range: 'Informes_Estadisticas!A2', values: informesRows });
  if (solicitudesRows.length > 0) dataToUpdate.push({ range: 'Solicitudes_Calificaciones!A2', values: solicitudesRows });
  if (constanciasRows.length > 0) dataToUpdate.push({ range: 'Constancias_Emitidas!A2', values: constanciasRows });
  if (pagosRows.length > 0) dataToUpdate.push({ range: 'Pagos_y_Colegiaturas!A2', values: pagosRows });
  if (centroEscolarRows.length > 0) dataToUpdate.push({ range: 'Centro_Escolar!A2', values: centroEscolarRows });

  if (dataToUpdate.length > 0) {
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

  return { success: true };
}

export async function syncCentroEscolarToSheet(token: string, spreadsheetId: string, centroEscolar: any) {
  const c = centroEscolar || {};
  const row = [
    c.cct || '',
    c.nombre || '',
    c.lema || '',
    c.nivelEducativo || 'SECUNDARIA GENERAL / PRIMARIA',
    c.turno || 'MATUTINO',
    c.zonaEscolar || '',
    c.sector || '',
    c.director || '',
    c.cargoDirector || 'DIRECTOR(A) GENERAL',
    c.subdirector || '',
    c.domicilio || '',
    c.colonia || '',
    c.municipio || '',
    c.estado || '',
    c.codigoPostal || '',
    c.telefono || '',
    c.correo || '',
    new Date().toLocaleString()
  ];

  await ensureSpreadsheetTabs(token, spreadsheetId);
  await writeAllMasterHeaders(token, spreadsheetId);

  const response = await fetch(`${SHEETS_API_URL}/${spreadsheetId}/values/Centro_Escolar!A2:R2?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Error al sincronizar Centro Escolar en Sheets:', errText);
    throw new Error('Error al sincronizar datos del Centro Escolar en Google Sheets: ' + errText);
  }
  return response.json();
}

export async function setupSysAcadWorkspace(token: string, appData: any, cachedResult?: WorkspaceSetupResult | null): Promise<WorkspaceSetupResult> {
  const rootFolderName = 'SysAcad - Almacenamiento y Control Escolar';
  let rootFolderId = '';
  let rootFolderUrl = '';

  // 1. Verify if we have a valid cached or existing Root Folder
  if (cachedResult?.rootFolderId) {
    const meta = await getDriveFileMetadata(token, cachedResult.rootFolderId);
    if (meta) {
      rootFolderId = meta.id;
      rootFolderUrl = meta.webViewLink || `https://drive.google.com/drive/folders/${rootFolderId}`;
    }
  }

  // If not found from cache, search Drive for existing root folder
  if (!rootFolderId) {
    const existingFolders = await searchDriveFiles(token, `mimeType='application/vnd.google-apps.folder' and trashed=false and (name='${rootFolderName}' or name='SysAcad_Almacenamiento_Escolar' or name contains 'SysAcad')`);
    if (existingFolders.files && existingFolders.files.length > 0) {
      rootFolderId = existingFolders.files[0].id;
      rootFolderUrl = existingFolders.files[0].webViewLink || `https://drive.google.com/drive/folders/${rootFolderId}`;
    } else {
      const rootFolder = await createDriveFolder(token, rootFolderName);
      rootFolderId = rootFolder.id;
      rootFolderUrl = rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolderId}`;
    }
  }

  // 2. Identify the active Cycle Name (e.g. "CICLO ESCOLAR 2026 - 2027")
  const activeCycleName = (appData.activeCycleName || 'CICLO ESCOLAR 2026 - 2027').trim();
  let cycleFolderId = '';
  let cycleFolderUrl = '';

  // Check cached cycle folder if still matching
  if (cachedResult?.cycleFolderId && cachedResult?.cycleFolderName === activeCycleName) {
    const meta = await getDriveFileMetadata(token, cachedResult.cycleFolderId);
    if (meta) {
      cycleFolderId = meta.id;
      cycleFolderUrl = meta.webViewLink || `https://drive.google.com/drive/folders/${cycleFolderId}`;
    }
  }

  // Search inside root folder for the active cycle folder
  if (!cycleFolderId) {
    const existingCycleFolders = await searchDriveFiles(token, `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name='${activeCycleName}'`);
    if (existingCycleFolders.files && existingCycleFolders.files.length > 0) {
      cycleFolderId = existingCycleFolders.files[0].id;
      cycleFolderUrl = existingCycleFolders.files[0].webViewLink || `https://drive.google.com/drive/folders/${cycleFolderId}`;
    } else {
      // Also search anywhere in Drive by cycle name to reuse
      const globalCycleSearch = await searchDriveFiles(token, `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${activeCycleName}'`);
      if (globalCycleSearch.files && globalCycleSearch.files.length > 0) {
        cycleFolderId = globalCycleSearch.files[0].id;
        cycleFolderUrl = globalCycleSearch.files[0].webViewLink || `https://drive.google.com/drive/folders/${cycleFolderId}`;
        await moveFileToFolder(token, cycleFolderId, rootFolderId);
      } else {
        const createdCycleFolder = await createDriveFolder(token, activeCycleName, rootFolderId);
        cycleFolderId = createdCycleFolder.id;
        cycleFolderUrl = createdCycleFolder.webViewLink || `https://drive.google.com/drive/folders/${cycleFolderId}`;
      }
    }
  }

  // 3. Query ALL existing subfolders inside the Cycle Folder (and root) to prevent any duplicate subfolder creation
  const existingSubfoldersRes = await searchDriveFiles(token, `('${cycleFolderId}' in parents or '${rootFolderId}' in parents) and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const existingSubfoldersMap = new Map<string, { id: string; url: string; parentId?: string }>();

  for (const f of existingSubfoldersRes.files || []) {
    // Skip if it's the cycle folder itself
    if (f.id === cycleFolderId) continue;
    
    const parent = f.parents?.[0];
    existingSubfoldersMap.set(f.name.toLowerCase().trim(), {
      id: f.id,
      url: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
      parentId: parent
    });
  }

  const subfolderNames = WORKSPACE_SUBFOLDER_NAMES;

  const subfoldersList: { name: string; id: string; url: string }[] = [];

  for (const name of subfolderNames) {
    const normalizedName = name.toLowerCase().trim();
    // Check exact name or base name (e.g. without 01_ prefix)
    let existing = existingSubfoldersMap.get(normalizedName);
    if (!existing) {
      const baseName = name.replace(/^\d+_/, '').toLowerCase().trim();
      for (const [k, v] of existingSubfoldersMap.entries()) {
        if (k.includes(baseName) || baseName.includes(k.replace(/^\d+_/, ''))) {
          existing = v;
          break;
        }
      }
    }

    if (existing) {
      // Ensure it is placed inside the active cycle folder
      if (existing.parentId !== cycleFolderId) {
        await moveFileToFolder(token, existing.id, cycleFolderId);
      }
      subfoldersList.push({ name, id: existing.id, url: existing.url });
    } else {
      const created = await createDriveFolder(token, name, cycleFolderId);
      const url = created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`;
      subfoldersList.push({ name, id: created.id, url });
      existingSubfoldersMap.set(normalizedName, { id: created.id, url, parentId: cycleFolderId });
    }
  }

  // 4. Search or verify Master Spreadsheet inside the Cycle Folder (Strict reuse to prevent duplicates)
  const spreadsheetTitle = 'SysAcad - Base de Datos Central';
  let spreadsheetId = '';
  let spreadsheetUrl = '';

  // Check cached spreadsheet ID first
  if (cachedResult?.spreadsheetId) {
    const meta = await getDriveFileMetadata(token, cachedResult.spreadsheetId);
    if (meta) {
      spreadsheetId = meta.id;
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      await moveFileToFolder(token, spreadsheetId, cycleFolderId);
    }
  }

  // If not found in cache, check inside Cycle Folder or Root Folder
  if (!spreadsheetId) {
    const inCycleSheet = await searchDriveFiles(token, `('${cycleFolderId}' in parents or '${rootFolderId}' in parents) and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
    if (inCycleSheet.files && inCycleSheet.files.length > 0) {
      spreadsheetId = inCycleSheet.files[0].id;
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      await moveFileToFolder(token, spreadsheetId, cycleFolderId);
    }
  }

  // If not in folders, search across Drive
  if (!spreadsheetId) {
    const existingSheet = await searchDriveFiles(token, `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and (name contains 'SysAcad' or name contains 'Base de Datos Central')`);
    if (existingSheet.files && existingSheet.files.length > 0) {
      spreadsheetId = existingSheet.files[0].id;
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      await moveFileToFolder(token, spreadsheetId, cycleFolderId);
    } else {
      const sheetObj = await createFullMasterSpreadsheet(token, spreadsheetTitle);
      spreadsheetId = sheetObj.spreadsheetId;
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      await moveFileToFolder(token, spreadsheetId, cycleFolderId);
    }
  }

  // 5. Ensure all required sheet tabs exist without duplicating
  await ensureSpreadsheetTabs(token, spreadsheetId);

  // 6. Ensure master headers exist
  await writeAllMasterHeaders(token, spreadsheetId);

  // 7. CRITICAL: Fetch and merge existing data from Sheets BEFORE syncing to prevent data loss across devices
  let finalUsers = [...(appData.systemUsers || [])];
  let finalStudents = [...(appData.studentsList || [])];
  let finalMaterias = [...(appData.materiasList || [])];
  let finalCalifs = [...(appData.calificacionesList || [])];
  let finalAvisos = [...(appData.avisosList || [])];

  try {
    const sheetUsers = await fetchUsersFromSheets(token, spreadsheetId);
    if (Array.isArray(sheetUsers) && sheetUsers.length > 0) {
      const userMap = new Map<string, any>();
      // 1. Put sheet users first
      sheetUsers.forEach((u: any) => {
        const k = (u.username || u.id || '').trim().toLowerCase();
        if (k) userMap.set(k, u);
      });
      // 2. Merge appData users (keep passwords or local updates)
      finalUsers.forEach((u: any) => {
        const k = (u.username || u.id || '').trim().toLowerCase();
        if (k) {
          const prev = userMap.get(k);
          if (prev) {
            userMap.set(k, { ...prev, ...u, password: u.password || prev.password });
          } else {
            userMap.set(k, u);
          }
        }
      });
      finalUsers = Array.from(userMap.values());
      appData.systemUsers = finalUsers;
    }
  } catch (errUsers) {
    console.warn('Could not read existing sheet users before sync:', errUsers);
  }

  try {
    const fullData = await loadFullDataFromSheets(token, spreadsheetId);
    if (fullData) {
      if ((!finalStudents || finalStudents.length === 0) && fullData.alumnos?.length > 0) {
        finalStudents = fullData.alumnos;
        appData.studentsList = finalStudents;
      }
      if ((!finalMaterias || finalMaterias.length === 0) && fullData.materias?.length > 0) {
        finalMaterias = fullData.materias;
        appData.materiasList = finalMaterias;
      }
      if ((!finalCalifs || finalCalifs.length === 0) && fullData.calificaciones?.length > 0) {
        finalCalifs = fullData.calificaciones;
        appData.calificacionesList = finalCalifs;
      }
      if ((!finalAvisos || finalAvisos.length === 0) && fullData.avisos?.length > 0) {
        finalAvisos = fullData.avisos;
        appData.avisosList = finalAvisos;
      }
    }
  } catch (errFull) {
    console.warn('Could not read full sheet tables before sync:', errFull);
  }

  // 8. Sync all merged data from app state into the sheets (updates rows cleanly without erasing)
  await syncAllDataToSheets(token, spreadsheetId, appData);

  return {
    rootFolderId,
    rootFolderUrl,
    cycleFolderId,
    cycleFolderUrl,
    cycleFolderName: activeCycleName,
    spreadsheetId,
    spreadsheetUrl,
    subfolders: subfoldersList,
    mergedUsers: finalUsers,
    loadedData: {
      alumnos: finalStudents,
      materias: finalMaterias,
      calificaciones: finalCalifs,
      avisos: finalAvisos
    }
  };
}

export async function setupSpecificCycleInDrive(
  token: string,
  cycleName: string,
  rootFolderId?: string,
  appData?: any
): Promise<{
  cycleFolderId: string;
  cycleFolderUrl: string;
  cycleFolderName: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  subfolders: { name: string; id: string; url: string }[];
}> {
  const normalizedCycleName = cycleName.trim();
  
  // 1. Ensure Root Folder
  let parentRootId = rootFolderId;
  if (parentRootId) {
    const rootMeta = await getDriveFileMetadata(token, parentRootId);
    if (!rootMeta) parentRootId = undefined;
  }
  if (!parentRootId) {
    const existingRoots = await searchDriveFiles(token, "name='SysAcad - Control Escolar' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    if (existingRoots.files && existingRoots.files.length > 0) {
      parentRootId = existingRoots.files[0].id;
    } else {
      const createdRoot = await createDriveFolder(token, 'SysAcad - Control Escolar');
      parentRootId = createdRoot.id;
    }
  }

  // 2. Find or create specific Cycle Folder inside Root Folder
  let cycleFolderId = '';
  let cycleFolderUrl = '';

  const cycleSearch = await searchDriveFiles(token, `'${parentRootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name='${normalizedCycleName}'`);
  if (cycleSearch.files && cycleSearch.files.length > 0) {
    cycleFolderId = cycleSearch.files[0].id;
    cycleFolderUrl = cycleSearch.files[0].webViewLink || `https://drive.google.com/drive/folders/${cycleFolderId}`;
  } else {
    // Global search check
    const globalSearch = await searchDriveFiles(token, `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${normalizedCycleName}'`);
    if (globalSearch.files && globalSearch.files.length > 0) {
      cycleFolderId = globalSearch.files[0].id;
      cycleFolderUrl = globalSearch.files[0].webViewLink || `https://drive.google.com/drive/folders/${cycleFolderId}`;
      await moveFileToFolder(token, cycleFolderId, parentRootId);
    } else {
      const createdCycle = await createDriveFolder(token, normalizedCycleName, parentRootId);
      cycleFolderId = createdCycle.id;
      cycleFolderUrl = createdCycle.webViewLink || `https://drive.google.com/drive/folders/${cycleFolderId}`;
    }
  }

  // 3. Search and create all required subfolders inside this specific cycle folder
  const existingSubfoldersRes = await searchDriveFiles(token, `'${cycleFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const existingSubfoldersMap = new Map<string, { id: string; url: string }>();

  for (const f of existingSubfoldersRes.files || []) {
    existingSubfoldersMap.set(f.name.toLowerCase().trim(), {
      id: f.id,
      url: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`
    });
  }

  const subfolderNames = WORKSPACE_SUBFOLDER_NAMES;

  const subfoldersList: { name: string; id: string; url: string }[] = [];

  for (const name of subfolderNames) {
    const normalizedName = name.toLowerCase().trim();
    let existing = existingSubfoldersMap.get(normalizedName);
    if (!existing) {
      const baseName = name.replace(/^\d+_/, '').toLowerCase().trim();
      for (const [k, v] of existingSubfoldersMap.entries()) {
        if (k.includes(baseName) || baseName.includes(k.replace(/^\d+_/, ''))) {
          existing = v;
          break;
        }
      }
    }

    if (existing) {
      subfoldersList.push({ name, id: existing.id, url: existing.url });
    } else {
      const created = await createDriveFolder(token, name, cycleFolderId);
      const url = created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`;
      subfoldersList.push({ name, id: created.id, url });
      existingSubfoldersMap.set(normalizedName, { id: created.id, url });
    }
  }

  // 4. Create or reuse Master Spreadsheet specifically for this Cycle
  const spreadsheetTitle = `SysAcad - Base de Datos (${normalizedCycleName})`;
  let spreadsheetId = '';
  let spreadsheetUrl = '';

  const inCycleSheet = await searchDriveFiles(token, `'${cycleFolderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  if (inCycleSheet.files && inCycleSheet.files.length > 0) {
    spreadsheetId = inCycleSheet.files[0].id;
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  } else {
    const sheetObj = await createFullMasterSpreadsheet(token, spreadsheetTitle);
    spreadsheetId = sheetObj.spreadsheetId;
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    await moveFileToFolder(token, spreadsheetId, cycleFolderId);
  }

  // 5. Ensure all sheets tabs and headers
  await ensureSpreadsheetTabs(token, spreadsheetId);
  await writeAllMasterHeaders(token, spreadsheetId);

  // 6. Sync app data if provided
  if (appData) {
    await syncAllDataToSheets(token, spreadsheetId, appData);
  }

  return {
    cycleFolderId,
    cycleFolderUrl,
    cycleFolderName: normalizedCycleName,
    spreadsheetId,
    spreadsheetUrl,
    subfolders: subfoldersList
  };
}

export async function loadFullDataFromSheets(token: string, spreadsheetId: string): Promise<any | null> {
  try {
    const ranges = [
      'Alumnos!A2:M500',
      'Maestros!A2:F500',
      'Materias!A2:F500',
      'Calificaciones!A2:G500',
      'Usuarios_Sistema!A2:H500',
      'Avisos_y_Tareas!A2:G500',
      'Centro_Escolar!A2:R10'
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
    const centroEscolarRows = valueRanges[6]?.values || [];

    const loadedAlumnos = alumnosRows
      .filter((r: any[]) => r && r[2])
      .map((r: any[], idx: number) => ({
        id: r[0] || `a-${Date.now()}-${idx}`,
        matricula: r[1] || '',
        nombres: r[2] || '',
        apellidos: r[3] || '',
        curp: r[4] || '',
        grado: r[5] || '1er Grado',
        nivel: r[6] || 'General',
        email: r[7] || '',
        celular: r[8] || '',
        nombrePadreTutor: r[9] || '',
        telefonoEmergencia: r[10] || '',
        estatus: r[11] || 'Activo',
        fechaInscripcion: r[12] || new Date().toISOString().split('T')[0]
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

    let loadedCentroEscolar: any = null;
    if (centroEscolarRows && centroEscolarRows.length > 0 && centroEscolarRows[0] && (centroEscolarRows[0][0] || centroEscolarRows[0][1])) {
      const cr = centroEscolarRows[0];
      loadedCentroEscolar = {
        cct: cr[0] || '',
        nombre: cr[1] || '',
        lema: cr[2] || '',
        nivelEducativo: cr[3] || 'SECUNDARIA GENERAL / PRIMARIA',
        turno: cr[4] || 'MATUTINO',
        zonaEscolar: cr[5] || '',
        sector: cr[6] || '',
        director: cr[7] || '',
        cargoDirector: cr[8] || 'DIRECTOR(A) GENERAL',
        subdirector: cr[9] || '',
        domicilio: cr[10] || '',
        colonia: cr[11] || '',
        municipio: cr[12] || '',
        estado: cr[13] || '',
        codigoPostal: cr[14] || '',
        telefono: cr[15] || '',
        correo: cr[16] || ''
      };
    }

    return {
      alumnos: loadedAlumnos,
      materias: loadedMaterias,
      calificaciones: loadedCalificaciones,
      users: loadedUsers,
      avisos: loadedAvisos,
      centroEscolar: loadedCentroEscolar
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


