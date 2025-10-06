export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Frontend API: Forwarding chat message request to backend');
    console.log('Request body:', req.body);
    
    // Forward the request to backend
    const backendRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/chatbot/message`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await backendRes.json();
    console.log('Backend response:', backendRes.status, data);
    
    if (!backendRes.ok) {
      return res.status(backendRes.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Frontend message API error:', error);
    res.status(500).json({ 
      error: 'Internal server error in message API: ' + error.message 
    });
  }
}