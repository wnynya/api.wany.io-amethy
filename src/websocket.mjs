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

import {
  TerminalNodeListener,
  TerminalClientListener,
} from './modules/amethy/terminal/terminal.mjs';
use('/amethy/terminal/node', TerminalNodeListener);

use('/amethy/terminal/client', TerminalClientListener);

export default websocket;
