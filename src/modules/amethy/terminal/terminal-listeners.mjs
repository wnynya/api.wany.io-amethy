import config from '../../../config.mjs';

import WebSocketServer from '@wnynya/websocket-server';

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
      connection.node.update(['status', 'ip', 'lastused']).catch(console.error);
      connection.node.logsUpdateInterval = setInterval(() => {
        if (connection.node.logsUpdated) {
          connection.node.update(['logs']).catch(console.error);
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
      connection.node.update(['status', 'lastused']).catch(console.error);
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
        connection.node.systeminfo = data.data;
        connection.node.update(['systeminfo']).catch(console.error);
        break;
      }
      case 'dashboard/systemstatus': {
        connection.node.systemstatus.push(data.data);
        while (
          connection.node.systemstatus.length >
          connection.node.systemstatusLength
        ) {
          connection.node.systemstatus.shift();
        }
        connection.node.update(['systemstatus']).catch(console.error);
        break;
      }
      case 'console/log': {
        connection.node.logs.push(data.data);
        while (connection.node.logs.length > connection.node.logsLength) {
          connection.node.logs.shift();
        }
        connection.node.logsUpdated = true;
        break;
      }
      case 'players/players': {
        connection.node.players = data.data.players;
        connection.node.update(['players']).catch(console.error);
        break;
      }
      case 'worlds/worlds': {
        connection.node.worlds = data.data.worlds;
        connection.node.update(['worlds']).catch(console.error);
        break;
      }
    }

    if (data.client.uid) {
      TerminalClientListener.eventTo(data.client, event, data.data, message);
    } else {
      TerminalClientListener.eventBroadcast(
        connection.node.uid,
        event,
        data.data,
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

  kill(nid) {
    const target = this.of(nid);
    if (!target) {
      return;
    }
    target.destroy();
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
      const nid = req.query.nid;
      AmethyTerminalNode.of(nid)
        .then((node) => {
          req.p.node = node;
          if (
            node.owner.uid == req.account.uid ||
            req.hasPermission('amethy.terminal.master')
          ) {
            req.p.scope = 'owner';
            next();
          } else if (node.members[req.account]) {
            req.p.scope = 'member';
            res.p.mperms = node.members[req.account];
            next();
          } else {
            req.destroy();
          }
        })
        .catch(() => {
          return;
        });
    });

    this.wss.on('connection', (connection) => {
      connection.node = connection.req.p.node;
      connection.scope = connection.req.p.scope;
      if (connection.req.p.mperms) {
        connection.mperms = connection.req.p.mperms;
      }
      console.log(
        logprefix,
        `Client connection opened ${connection.req.account.eid}@${connection.req.client.ip} (${connection.scope}) => ${connection.node.label}`
      );
    });
    this.wss.on('json', (connection, event, data, message) => {
      this.handleEvent(connection, event, data, message);
    });
    this.wss.on('close', (connection) => {
      console.log(
        logprefix,
        `Client connection closed ${connection.req.account.eid}@${connection.req.client.ip} (${connection.scope}) => ${connection.node.label}`
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
        'console/tabcompleter',
        'filesystem/dir-read',
        'filesystem/dir-create',
        'filesystem/dir-delete',
        'filesystem/file-read',
        'filesystem/file-create',
        'filesystem/file-write-open',
        'filesystem/file-write-chunk',
        'filesystem/file-write-close',
        'filesystem/file-delete',
        'players/player',
        'worlds/world',
        'worlds/gamerule',
      ].includes(event)
    ) {
      return;
    }

    // console.write
    if (['console/command', 'console/tabcompleter'].includes(event)) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('console.write')
        )
      ) {
        return;
      }
    }
    // filesyste.read
    else if (['filesystem/dir-read', 'filesystem/file-read'].includes(event)) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('filesystem.read')
        )
      ) {
        return;
      }
    }
    // filesyste.write
    else if (
      [
        'filesystem/dir-create',
        'filesystem/dir-delete',
        'filesystem/file-create',
        'filesystem/file-write-open',
        'filesystem/file-write-chunk',
        'filesystem/file-write-close',
        'filesystem/file-delete',
      ].includes(event)
    ) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('filesystem.write')
        )
      ) {
        return;
      }
    }
    // players.read
    else if (['players/player'].includes(event)) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('players.read')
        )
      ) {
        return;
      }
    }
    // worlds.read
    else if (['worlds/world'].includes(event)) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('worlds.read')
        )
      ) {
        return;
      }
    }
    // worlds.write
    else if (['worlds/gamerule'].includes(event)) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('worlds.write')
        )
      ) {
        return;
      }
    }

    // filesystem path verify
    if ([''].includes(connection.node.id)) {
    } else {
      if (event.startsWith('filesystem')) {
        if (
          data.path &&
          !data.path.startsWith(connection.node.systeminfo.server.dir)
        ) {
          connection.event('filesystem/error', {
            message: '접근할 수 없는 디렉터리입니다.',
          });
          return;
        }
      }
    }

    // console command say
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
        client: {
          uid: connection.uid,
        },
        data: data,
      },
      message
    );
  }

  eventTo(client, event, data, message) {
    let connection = null;
    for (const conn of this.wss.connections) {
      if (conn.uid == client.uid) {
        connection = conn;
        break;
      }
    }
    if (!connection) {
      return;
    }

    // filesyste.read
    if (
      [
        'filesystem/dir-read',
        'filesystem/file-read-open',
        'filesystem/file-read-chunk',
        'filesystem/file-read-close',
      ].includes(event)
    ) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('filesystem.read')
        )
      ) {
        return;
      }
    }
    // filesyste.write
    else if (
      [
        'filesystem/dir-create',
        'filesystem/dir-delete',
        'filesystem/file-create',
        'filesystem/file-write-open',
        'filesystem/file-write-chunk',
        'filesystem/file-write-close',
        'filesystem/file-delete',
      ].includes(event)
    ) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('filesystem.write')
        )
      ) {
        return;
      }
    }
    // players.read
    else if (['players/player'].includes(event)) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('players.read')
        )
      ) {
        return;
      }
    }
    // worlds.read
    else if (['worlds/world'].includes(event)) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('worlds.read')
        )
      ) {
        return;
      }
    }
    // worlds.write
    else if (['worlds/gamerule'].includes(event)) {
      if (
        !(
          connection.scope == 'owner' ||
          connection.mperms.includes('worlds.write')
        )
      ) {
        return;
      }
    }

    connection.event(event, data, message);
  }

  eventBroadcast(nid, event, data, message) {
    for (const connection of this.wss.connections) {
      if (connection.node.uid == nid) {
        // console.read
        if (['console/log'].includes(event)) {
          if (
            !(
              connection.scope == 'owner' ||
              connection.mperms.includes('console.read')
            )
          ) {
            return;
          }
        }

        connection.event(event, data, message);
      }
    }
  }
})();

export { TerminalClientListener };
