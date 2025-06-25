import http from 'http';
import { parse } from 'url';
import { StringDecoder } from 'string_decoder';
import { sanitizeCode } from './lib/sanitizer.mjs';

const PORT = 3000;

const server = http.createServer((req, res) => {
  const { pathname } = parse(req.url, true);

  if (req.method === 'POST' && pathname === '/sanitize') {
    let body = '';
    const decoder = new StringDecoder('utf-8');
    req.on('data', (chunk) => {
      body += decoder.write(chunk);
    });
    req.on('end', () => {
      body += decoder.end();
      let json;

      try {
        json = JSON.parse(body);
      } catch {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }

      const inputCode = json.code;

      console.log('Received code:', inputCode);

      if (typeof inputCode !== 'string') {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: '`code` must be a string' }));
      }

      const output = sanitizeCode(inputCode);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: output }));
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
