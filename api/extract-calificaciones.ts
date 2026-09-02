import { GoogleGenAI, Type } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg', alumnosReferencia, materiasReferencia, parcialDefault } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'No se proporcionó la imagen en base64.' });
    }

    const teacherKey = req.headers['x-gemini-key'] as string | undefined;
    const apiKey = teacherKey?.trim() || req.body?.apiKey?.trim() || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'No se encontró una clave de API de Gemini configurada. Puedes configurarla en el sistema o en las variables de entorno de Vercel (GEMINI_API_KEY).',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const cleanedBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanedBase64,
      },
    };

    const refAlumnosText = Array.isArray(alumnosReferencia) && alumnosReferencia.length > 0
      ? `\nLista de alumnos inscritos en este sistema (úsalos como referencia para corregir posibles faltas ortográficas o abreviaturas en los nombres):\n- ${alumnosReferencia.slice(0, 80).join('\n- ')}`
      : '';

    const refMateriasText = Array.isArray(materiasReferencia) && materiasReferencia.length > 0
      ? `\nLista de materias disponibles en el sistema:\n- ${materiasReferencia.slice(0, 30).join('\n- ')}`
      : '';

    const promptText = `Eres un asistente especializado en digitalización y transcripción académica de actas de calificaciones y listas de asistencia de colegios.
Analiza con alta precisión la imagen proporcionada (lista manuscrita o impresa de calificaciones).
Extrae cada fila con:
1. "alumno": Nombre completo del alumno (formato Apellidos Nombres si es posible).
2. "materia": Nombre de la materia o asignatura (si no está especificada en la foto, deduce de la lista de materias o usa "Materia General").
3. "parcial": Período o parcial (por ejemplo: "${parcialDefault || 'Primer Parcial'}", "Segundo Parcial", "Examen Final" o lo que indique la imagen).
4. "calificacion": Número decimal o entero de la calificación asignada (ejemplo: 9.5, 8.0, 10, 6). Si es una escala de 0 a 100, conviértela a escala de 0 a 10 (ej. 85 -> 8.5).
${refAlumnosText}
${refMateriasText}

Devuelve un arreglo JSON con todos los alumnos encontrados en la lista. Si alguna fila no tiene calificación visible o está vacía, no la incluyas.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          imagePart,
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: 'Lista de calificaciones extraídas de la imagen',
          items: {
            type: Type.OBJECT,
            properties: {
              alumno: {
                type: Type.STRING,
                description: 'Nombre completo del alumno',
              },
              materia: {
                type: Type.STRING,
                description: 'Nombre de la materia',
              },
              parcial: {
                type: Type.STRING,
                description: 'Parcial o período escolar evaluado',
              },
              calificacion: {
                type: Type.NUMBER,
                description: 'Calificación numérica entre 0 y 10',
              },
            },
            required: ['alumno', 'calificacion'],
          },
        },
      },
    });

    const responseText = response.text || '[]';
    let parsedData: any[] = [];
    try {
      parsedData = JSON.parse(responseText.trim());
    } catch (e) {
      console.error('Error parsing Gemini JSON response:', responseText);
      parsedData = [];
    }

    return res.status(200).json({
      success: true,
      count: parsedData.length,
      records: parsedData,
    });
  } catch (error: any) {
    console.error('Error en Vercel Serverless /api/extract-calificaciones:', error);
    return res.status(500).json({
      error: error?.message || 'Ocurrió un error al procesar la imagen con Gemini IA.',
    });
  }
}
