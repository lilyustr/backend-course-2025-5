const { Command } = require('commander');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const http = require('http');
const superagent = require('superagent');

const program = new Command();

program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <cacheDir>', 'шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

const HOST = options.host;
const PORT = Number(options.port);
const CACHE_DIR = path.resolve(options.cache);

fsp.mkdir(CACHE_DIR, { recursive: true })
  .then(() => console.log(`Cache directory: ${CACHE_DIR}`))
  .catch(err => { console.error(err); process.exit(1); });

function isValidCode(code) {
  return /^[0-9]{3}$/.test(code);
}

const pendingDownloads = new Map();

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    const code = reqUrl.pathname.split('/')[1] || '';

    if (!isValidCode(code)) {
     res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request: очікується трицифровий HTTP код, наприклад /200');
      return;
    }

    const filePath = path.join(CACHE_DIR, `${code}.jpg`);

    if (req.method === 'GET') {
      try {
        const data = await fsp.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(data);
        return;
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Read file error:', err);
          res.statusCode = 500;
          res.end('Internal Server Error');
          return;
        }
      }

      if (pendingDownloads.has(code)) {
        try {
          const buf = await pendingDownloads.get(code);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(buf);
          return;
        } catch {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
      }

      const downloadPromise = (async () => {
        try {
          const response = await superagent.get(`https://http.cat/${code}.jpg`).buffer(true).timeout({ response: 5000 });
          const buffer = response.body;
          const tmpPath = filePath + '.tmp-' + Date.now();
          await fsp.writeFile(tmpPath, buffer);
          await fsp.rename(tmpPath, filePath);
          return buffer;
        } finally {
          pendingDownloads.delete(code);
        }
      })();

      pendingDownloads.set(code, downloadPromise);

      try {
        const buffer = await downloadPromise;
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(buffer);
      } catch {
        res.statusCode = 404;
        res.end('Not Found');
      }

    } else if (req.method === 'PUT') {
      const tmpPath = filePath + '.tmp-' + Date.now();
      const ws = fs.createWriteStream(tmpPath);

      req.pipe(ws);

      ws.on('finish', async () => {
        try {
          await fsp.rename(tmpPath, filePath);
          res.statusCode = 201;
          res.end('Created');
        } catch (err) {
          console.error('PUT error:', err);
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      });

      ws.on('error', (err) => {
        console.error('Write stream error:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      });

    } else if (req.method === 'DELETE') {
      try {
        await fsp.unlink(filePath);
        res.statusCode = 200;
        res.end('Deleted');
      } catch (err) {
        if (err.code === 'ENOENT') {
          res.statusCode = 404;
          res.end('Not Found');
        } else {
          console.error('DELETE error:', err);
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      }

    } else {
      res.statusCode = 405;
      res.end('Method Not Allowed');
    }

  } catch (err) {
    console.error('Unhandled error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}, cache: ${CACHE_DIR}`);
});
