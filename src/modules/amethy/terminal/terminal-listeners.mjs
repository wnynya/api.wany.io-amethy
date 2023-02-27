import config from '../../../config.mjs';

import EventEmitter from 'events';
import WebSocketServer from '@wnynya/websocket-server';
import mysql from '@wnynya/mysql-client';

import middlewares from '@wnynya/express-middlewares';
import auth from '@wnynya/auth';

import AmethyTerminalNode from './terminal-node.mjs';

const logprefix = '[Amethy] [Terminal]:';

const TerminalNodeListener = new (class {
  constructor() {
    this.wss = new WebSocketServer();

    this.wss.use(middlewares.client()); // Client infomations

    // Verify server
    this.wss.use((req, res, next, socket, head) => {
      const nid = req.headers['amethy-terminal-node-nid'];
      const key = req.headers['amethy-terminal-node-key'];
      // 노드가 존재하는지 확인
      AmethyTerminalNode.of(nid)
        .then((node) => {
          // 노드 키 인증
          if (node.verify(key)) {
            req.p.node = node;
            next();
          } else {
            return;
          }
        })
        .catch(() => {
          return;
        });
    });

    this.wss.on('connection', (connection) => {
      connection.node = connection.req.p.node;
      console.log(
        logprefix,
        `Node connection opened ${connection.node.label} ${connection.node.uid}@${connection.req.client.ip}`
      );
      connection.node.status = 'online';
      connection.node.ip = connection.req.client.ip;
      connection.node.lastused = new Date();
      connection.node.update(['status', 'ip', 'lastused']);
      connection.node.logsUpdateInterval = setInterval(() => {
        if (connection.node.logsUpdated) {
          connection.node.update(['logs']);
        }
      }, 1000 * 10);
      TerminalClientListener.eventBroadcast(
        connection.node.uid,
        'status',
        'online'
      );
    });
    this.wss.on('json', (connection, event, data, message) => {
      this.handleEvent(connection, event, data, message);
    });
    this.wss.on('close', (connection) => {
      console.log(
        logprefix,
        `Node connection closed ${connection.node.label} ${connection.node.uid}@${connection.req.client.ip}`
      );
      connection.node.status = 'offline';
      connection.node.lastused = new Date();
      connection.node.update(['status', 'lastused']);
      clearInterval(connection.node.logsUpdateInterval);
      TerminalClientListener.eventBroadcast(
        connection.node.uid,
        'status',
        'offline'
      );
    });
    this.wss.on('error', (error) => {
      console.error(error);
    });
  }

  handleUpgrade(...args) {
    this.wss.handleUpgrade(...args);
  }

  handleEvent(connection, event, data, message) {
    switch (event) {
      case 'dashboard/systeminfo': {
        connection.node.systeminfo = data;
        connection.node.update(['systeminfo']);
        break;
      }
      case 'dashboard/systemstatus': {
        connection.node.systemstatus.push(data);
        while (
          connection.node.systemstatus.length >
          connection.node.systemstatusLength
        ) {
          connection.node.systemstatus.shift();
        }
        connection.node.update(['systemstatus']);
        break;
      }
      case 'console/log': {
        connection.node.logs.push(data);
        while (connection.node.logs.length > connection.node.logsLength) {
          connection.node.logs.shift();
        }
        connection.node.logsUpdated = true;
        break;
      }
      case 'players': {
        connection.node.players = data;
        connection.node.update(['players']);
        break;
      }
      case 'worlds': {
        connection.node.worlds = data;
        connection.node.update(['worlds']);
        break;
      }
    }

    if (data.client) {
      TerminalClientListener.eventTo(data.client, event, data.data, message);
    } else {
      TerminalClientListener.eventBroadcast(
        connection.node.uid,
        event,
        data,
        message
      );
    }
  }

  eventTo(nid, event, data, message) {
    let target = this.of(nid);
    if (!target) {
      return;
    }
    target.event(event, data, message);
  }

  of(nid) {
    for (const connection of this.wss.connections) {
      if (connection.node.uid == nid) {
        return connection;
      }
    }
    return null;
  }
})();

export { TerminalNodeListener };

const TerminalClientListener = new (class {
  constructor() {
    this.wss = new WebSocketServer();

    this.wss.use(middlewares.cookies()); // Cookie parser
    this.wss.use(middlewares.client()); // Client infomations
    this.wss.use(auth.session(config.session)); // Auth session (req.session)
    this.wss.use(auth.account()); // Auth account (req.account)

    // Check access permission
    this.wss.use((req, res, next, socket, head) => {
      if (!req.hasPermission('amethy.terminal.client.websocket')) {
        return;
      }
      const nid = req.query.nid;
      if (!req.hasPermission(`amethy.terminal.nodes.${nid}`)) {
        return;
      }
      AmethyTerminalNode.of(nid)
        .then((node) => {
          req.p.node = node;
          next();
        })
        .catch(() => {
          return;
        });
    });

    this.wss.on('connection', (connection) => {
      connection.node = connection.req.p.node;
      console.log(
        logprefix,
        `Client connection opened ${connection.req.account.eid}@${connection.req.client.ip} => ${connection.node.label}`
      );
    });
    this.wss.on('json', (connection, event, data, message) => {
      this.handleEvent(connection, event, data, message);
    });
    this.wss.on('close', (connection) => {
      console.log(
        logprefix,
        `Client connection closed ${connection.req.account.eid}@${connection.req.client.ip} => ${connection.node.label}`
      );
    });
    this.wss.on('error', (error) => {
      console.error(error);
    });
  }

  handleUpgrade(...args) {
    this.wss.handleUpgrade(...args);
  }

  handleEvent(connection, event, data, message) {
    if (
      ![
        'console/command',
        'fs/dir/open',
        'fs/dir/info',
        'fs/file/upload',
        'fs/file/download',
        'fs/file/delete',
        'players/target',
        'console/tabcompleter',
      ].includes(event)
    ) {
      return;
    }
    if ([''].includes(connection.node.id)) {
    } else {
      if (
        ['fs/dir/info', 'fs/file/download', 'fs/file/delete'].includes(event)
      ) {
        if (!data.startsWith(connection.node.systeminfo.server.dir)) {
          connection.event('fs/error', '접근할 수 없는 디렉터리입니다.');
          return;
        }
      }
      if (['fs/file/upload'].includes(event)) {
        if (!data.path.startsWith(connection.node.systeminfo.server.dir)) {
          connection.event('fs/error', '접근할 수 없는 디렉터리입니다.');
          return;
        }
      }
    }
    if (['console/command'].includes(event)) {
      if (!data?.command) {
        return;
      }
      let command = data?.command;
      // ㄴ 을 say 로
      command = command.replace(/^ㄴ(.*)/, 'say $1');
      // say 시 계졍 아이디 출력
      command = command.replace(
        /^say (.*)/,
        'say [' + connection.req.account.eid + '] $1'
      );
      data.command = command;
    }
    TerminalNodeListener.eventTo(
      connection.node.uid,
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
      if (connection.node.uid == nid) {
        connection.event(event, data, message);
      }
    }
  }
})();

export { TerminalClientListener };
