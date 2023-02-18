const servers = {};

function websocket(req, socket, head) {
  const path = req.url.replace(/\?(.*)/, '').toLowerCase();
  const server = servers[path];
  if (!server) {
    socket.destroy();
    return;
  }
  server.handleUpgrade(req, socket, head);
}

function use(path, server) {
  servers[path] = server;
}

import dropServer from './modules/drop-server.mjs';

use('/network/drop', dropServer);

export default websocket;
