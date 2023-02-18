import EventEmitter from 'events';
import WebSocketServer from '@wnynya/websocket-server';
import database from '@wnynya/mysql-client';
import Crypto from '@wnynya/crypto';
import Date from 'datwo';
import { Accounts, Account } from '@wnynya/accounts';

import { AmethyTerminalNode, getUID as getNodeUID, getNodes } from './node.mjs';

const logprefixt = '[Amethy] [Terminal]: ';

const TerminalNodeListener = new (class extends EventEmitter {
  constructor() {
    super();

    this.wss = new WebSocketServer({
      dropUnauthorized: true,
      permission: 'amethy.terminal.websocket.node',
      onUpgrade: this.onUpgrade,
      onDrop: (req, socket, head) => {
        if (socket) {
          socket.destroy();
        }
      },
    });

    this.wss.on('connection', (connection) => {
      connection.node = connection.req.node;
      connection.init();
      console.log(
        logprefixt +
          'Node connection open ' +
          connection.node.id +
          '@' +
          connection.req.ip +
          ' {cid: ' +
          connection.id +
          '}'
      );
      connection.node.status = 'online';
      connection.node.push('status');
      connection.node.update.interval = setInterval(() => {
        if (connection.node.update.logs) {
          try {
            connection.node.push('logs');
          } catch (error) {
            console.warn(error);
          }
          connection.node.update.logs = false;
        }
        if (connection.node.update.systemstatus) {
          try {
            connection.node.push('systemstatus');
          } catch (error) {
            console.warn(error);
          }
          connection.node.update.systemstatus = false;
        }
      }, 10 * 1000);
      connection.node
        .pull('meta')
        .then(() => {
          connection.node.meta.connection = {};
          connection.node.meta.connection.ip = connection.req.ip;
          connection.node
            .push('meta')
            .then(() => {})
            .catch(console.error);
        })
        .catch(console.error);
      TerminalClientListener.eventBroadcast(
        connection.node.id,
        'status',
        connection.node.status
      );
    });

    this.wss.on('close', (connection) => {
      console.log(
        logprefixt +
          'Node connection close ' +
          connection.node.id +
          '@' +
          connection.req.ip +
          ' {cid: ' +
          connection.id +
          '}'
      );
      connection.node.status = 'offline';
      connection.node.push('status');
      TerminalClientListener.eventBroadcast(
        connection.node.id,
        'status',
        connection.node.status
      );
    });

    this.wss.on('json', this.eventHandler);
  }

  handleUpgrade(...args) {
    this.wss.handleUpgrade(...args);
  }

  onUpgrade(req, drop, next) {
    const nid = req.headers['n'];
    const pkey = req.headers['p'];
    const node = new AmethyTerminalNode(nid);
    node
      .pull()
      .then(() => {
        node
          .verify(pkey)
          .then(() => {
            node.verify(pkey);
            req.node = node;
            next();
          })
          .catch((error) => {
            console.log(error);
            drop();
          });
      })
      .catch((error) => {
        console.log(error);
        drop();
      });
  }

  eventHandler(connection, event, data, message) {
    switch (event) {
      case 'console-log': {
        connection.node
          .pushLog(data)
          .then(() => {
            connection.node.update.logs = true;
          })
          .catch((error) => {
            console.error(error);
          });
        break;
      }
      case 'system-info': {
        data.ip = connection.req.ip;
        connection.node.systeminfo = data;
        connection.node
          .push('systeminfo')
          .then(() => {})
          .catch((error) => {
            console.error(error);
          });
        break;
      }
      case 'system-status': {
        connection.node
          .pushSystemstatus(data)
          .then(() => {
            connection.node.update.systemstatus = true;
          })
          .catch((error) => {
            console.error(error);
          });
        break;
      }
      case 'players': {
        break;
      }
      case 'worlds': {
        break;
      }
    }

    if (data.client) {
      TerminalClientListener.eventTo(data.client, event, data.data, message);
    } else {
      TerminalClientListener.eventBroadcast(
        connection.node.id,
        event,
        data,
        message
      );
    }
  }

  eventTo(id, event, data, message) {
    let target = this.getConnection(id);
    if (!target) {
      return;
    }
    target.event(event, data, message);
  }

  getConnection(id) {
    let target = null;
    for (const connection of this.wss.connections) {
      if (connection.node.id == id) {
        target = connection;
        break;
      }
    }
    return target;
  }
})();

export { TerminalNodeListener };

const TerminalClientListener = new (class extends EventEmitter {
  constructor() {
    super();

    this.wss = new WebSocketServer({
      dropUnauthorized: true,
      permission: 'amethy.terminal.websocket.client',
      onUpgrade: this.onUpgrade,
      onDrop: (req, socket, head) => {
        if (socket) {
          socket.destroy();
        }
      },
    });

    this.wss.on('connection', (connection) => {
      connection.node = connection.req.node;
      connection.init();
      connection.event('status', connection.node.status);
      console.log(
        logprefixt +
          'Client connection open ' +
          connection.req.client.id +
          '@' +
          connection.req.ip +
          ' => ' +
          connection.node.id +
          ' {cid: ' +
          connection.id +
          '}'
      );
    });

    this.wss.on('close', (connection) => {
      console.log(
        logprefixt +
          'Client connection close ' +
          connection.req.client.id +
          '@' +
          connection.req.ip +
          ' => ' +
          connection.node.id +
          ' {cid: ' +
          connection.id +
          '}'
      );
    });

    this.wss.on('json', this.eventHandler);
  }

  handleUpgrade(...args) {
    this.wss.handleUpgrade(...args);
  }

  onUpgrade(req, drop, next) {
    const nid = req.query['n'] || req.headers['n'];
    const node = new AmethyTerminalNode(nid);
    node
      .pull()
      .then(() => {
        req.node = node;
        next();
        return;
        getNodes(req.client.id)
          .then((nodes) => {
            const acc = Object.keys(nodes.owns).concat(
              Object.keys(nodes.coowns)
            );
            if (acc.includes(nid)) {
              req.node = node;
              next();
            } else {
              drop();
            }
          })
          .catch((error) => {
            drop();
          });
      })
      .catch((error) => {
        drop();
      });
  }

  eventHandler(connection, event, data, message) {
    if (
      ![
        'console-command',
        'fs-dir-info',
        'fs-file-upload',
        'fs-file-download',
        'fs-file-delete',
        'players-target',
        'console-tabcompleter',
      ].includes(event)
    ) {
      return;
    }
    if ([''].includes(connection.node.id)) {
    } else {
      if (
        ['fs-dir-info', 'fs-file-download', 'fs-file-delete'].includes(event)
      ) {
        if (!data.startsWith(connection.node.systeminfo.server.dir)) {
          connection.event('fs-error', '접근할 수 없는 디렉터리입니다');
          return;
        }
      }
      if (['fs-file-upload'].includes(event)) {
        if (!data.path.startsWith(connection.node.systeminfo.server.dir)) {
          connection.event('fs-error', '접근할 수 없는 디렉터리입니다');
          return;
        }
      }
    }
    if (['console-command'].includes(event)) {
      // ㄴ 을 say 로
      data = data.replace(/^ㄴ(.*)/, 'say $1');
      // say 시 계졍 아이디 출력
      data = data.replace(
        /^say (.*)/,
        'say [' + connection.req.client.eid + '] $1'
      );
    }
    TerminalNodeListener.eventTo(
      connection.node.id,
      event,
      {
        client: connection.id,
        data: data,
      },
      message
    );
  }

  eventTo(cid, event, data, message) {
    let target = null;
    for (const connection of this.wss.connections) {
      if (connection.id == cid) {
        target = connection;
        break;
      }
    }
    if (!target) {
      return;
    }
    target.event(event, data, message);
  }

  eventBroadcast(nid, event, data, message) {
    for (const connection of this.wss.connections) {
      if (connection.node.id == nid) {
        connection.event(event, data, message);
      }
    }
  }
})();

export { TerminalClientListener };

setTimeout(() => {
  database.query('UPDATE amethy_terminal_nodes SET status = ? ', ['offline']);
  /*database.query('UPDATE amethy_terminal_nodes SET meta = ? ', [
    JSON.stringify({
      logsLength: 2000,
      systemstatusLength: 61,
    }),
  ]);*/
}, 200);
