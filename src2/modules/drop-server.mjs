import config from '../config.mjs';

import Crypto from '@wnynya/crypto';

import WebsocketServer from '@wnynya/websocket-server';

const wss = new WebsocketServer();

import middlewares from '@wnynya/express-middlewares';
import auth from '@wnynya/auth';

wss.use(middlewares.cookies()); // Cookie parser
wss.use(middlewares.client()); // Client infomations
wss.use(auth.session(config.session)); // Auth session (req.session)
wss.use(auth.account()); // Auth account (req.account)

const tasks = {};

wss.on('connection', (connection) => {
  console.log('Drop connection opened: ' + connection.uid);
});
wss.on('json', (connection, event, data, message) => {
  const resolve = tasks[data.req];
  if (resolve) {
    resolve(data.data || data.error);
  }
  delete tasks[data.req];
});
wss.on('close', (connection) => {
  console.log('Drop connection closed: ' + connection.uid);
});

function request(event, data) {
  return new Promise((resolve, reject) => {
    const uid = Crypto.uid();
    tasks[uid] = (res) => {
      resolve(res);
    };
    data.req = uid;

    if (wss.connections.length < 1) {
      reject(new Error('default503'));
    }
    wss.connections[0].event(event, data);
  });
}

export { request };

export default wss;
