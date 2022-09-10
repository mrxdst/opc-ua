import { WebSocketServer } from 'ws';
import net from 'net';

const wss = new WebSocketServer({port: 8080});

wss.on('connection', ws => {
  const socket = net.createConnection({
    port: 4840
  });

  const buff: Buffer[] = [];

  socket.on('connect', () => {
    while (buff.length) {
      socket.write(buff.shift() as Buffer);
    }
  });
  
  socket.on('data', msg => {
    console.log('From Server:', msg);
    ws.send(msg);
  });

  socket.on('close', () => {
    ws.close();
  });

  ws.on('message', (msg: Buffer) => {
    console.log('From Client:', msg);
    if (socket.connecting) {
      buff.push(msg);
    } else {
      socket.write(msg);
    }
  });

  ws.on('close', () => {
    socket.destroy();
  });
});