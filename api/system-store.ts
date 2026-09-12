const CLOUD_BACKEND_URL = 'https://ais-pre-ogx2s2n5vd2t3usuxsxljy-64544171970.us-west1.run.app';

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gemini-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const backendRes = await fetch(`${CLOUD_BACKEND_URL}/api/system-store`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      return res.status(200).json(data);
    } else {
      return res.status(backendRes.status).json({ success: false, error: 'Error from central bridge' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
