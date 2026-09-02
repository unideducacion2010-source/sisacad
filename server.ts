import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

  // Increase payload size for base64 image transmission
  app.use(express.json({ limit: '15mb' }));

  // API Route: Extract grades from image using Gemini Vision
  app.post('/api/extract-calificaciones', async (req: Request, res: Response): Promise<void> => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', alumnosReferencia, materiasReferencia, parcialDefault } = req.body;

      if (!imageBase64) {
        res.status(400).json({ error: 'No se proporcionó la imagen en base64.' });
        return;
      }

      // Allow either server environment variable or teacher-provided key in header/body
      const teacherKey = req.headers['x-gemini-key'] as string | undefined;
      const apiKey = teacherKey?.trim() || req.body.apiKey?.trim() || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        res.status(400).json({ 
          error: 'No se encontró una clave de API de Gemini configurada. Puedes configurarla en el sistema o en las variables de entorno de Vercel (GEMINI_API_KEY).' 
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Clean base64 header if present (e.g. data:image/png;base64,...)
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

      res.json({
        success: true,
        count: parsedData.length,
        records: parsedData,
      });
    } catch (error: any) {
      console.error('Error en /api/extract-calificaciones:', error);
      res.status(500).json({
        error: error?.message || 'Ocurrió un error al procesar la imagen con Gemini IA.',
      });
    }
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SysAcad server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
