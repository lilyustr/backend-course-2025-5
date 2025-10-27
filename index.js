import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import superagent from 'superagent';
import { argv } from 'process';

const host = '127.0.0.1';
const port = 3000;
const cacheDir = './cache';

const server = http.createServer(async (req, res) => {
  const urlParts = req.url.split('/');
  const code = urlParts[1];
  const filePath = path.join(cacheDir, `${code}.jpg`);

  if (!code) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  try {
    if (req.method === 'GET') {
      try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(data);
      } catch {
        try {
          const response = await superagent.get(`https://http.cat/${code}.jpg`).responseType('blob');
          const imageBuffer = response.body;
          await fs.writeFile(filePath, imageBuffer); // зберегти в кеш
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(imageBuffer);
        } catch (err) {
          res.statusCode = 404;
          res.end('Not Found');
        }
      }
    } else if (req.method === 'PUT') {
      const data = [];
      for await (const chunk of req) data.push(chunk);
      await fs.writeFile(filePath, Buffer.concat(data));
      res.statusCode = 201;
      res.end('Created');
    } else if (req.method === 'DELETE') {
      await fs.unlink(filePath);
      res.statusCode = 200;
      res.end('Deleted');
    } else {
      res.statusCode = 405;
      res.end('Method Not Allowed');
    }
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`Сервер запущено: http://${host}:${port}`);
});
