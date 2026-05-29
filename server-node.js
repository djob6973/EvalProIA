import { createServer } from 'http';
const handler = (await import('./dist/server/server.js')).default;

const port = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: hasBody ? req : undefined,
      ...(hasBody ? { duplex: 'half' } : {}),
    });

    const response = await handler.fetch(request, {}, {});
    
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    }
    
    res.end();
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
