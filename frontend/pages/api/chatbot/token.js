export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Forwarding chatbot token request to backend');
    
    // Forward the request to backend
    const backendRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chatbot/token`, {
      method: 'GET',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json'
      }
    });

    const data = await backendRes.json();
    console.log('Backend token response:', backendRes.status, data);
    
    if (!backendRes.ok) {
      return res.status(backendRes.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Token API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}