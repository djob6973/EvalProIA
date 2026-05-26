import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

const server = createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Serve index.html for all routes (SPA)
  let filePath = join(__dirname, 'dist/client', req.url === '/' ? 'index.html' : req.url);
  
  // If file doesn't exist, serve index.html
  if (!existsSync(filePath)) {
    filePath = join(__dirname, 'dist/client/index.html');
  }
  
  const extname = String(filePath).split('.').pop();
  const contentType = mimeTypes[`.${extname}`] || 'application/octet-stream';
  
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  } catch (error) {
    console.error('Error serving file:', error);
    res.writeHead(500);
    res.end('Server Error');
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
