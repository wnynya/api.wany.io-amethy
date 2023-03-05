import { console } from '@wnynya/logger';

import express from 'express';
const router = express.Router();

import AmethyTerminalNode from '../modules/amethy/terminal/terminal-node.mjs';
import {
  TerminalNodeListener,
  TerminalClientListener,
} from '../modules/amethy/terminal/terminal-listeners.mjs';
import { AuthAccount } from '@wnynya/auth';

import middlewares from '@wnynya/express-middlewares';
const internal = middlewares.check.internal;
const login = middlewares.check.login;
const body = middlewares.check.body;
const perm = middlewares.check.perm;

const logprefix = '[Amethy] [Terminal]:';

router.get('/nodes', login(), perm('amethy.terminal.master'), (req, res) => {
  AmethyTerminalNode.index(10000, 1, false, true)
    .then(res.data)
    .catch(res.error);
});

router.post('/nodes', body(), (req, res) => {
  if (!req.body.type || !['bukkit', 'bungeecord'].includes(req.body.type)) {
    res.error('default400');
    return;
  }
  const node = new AmethyTerminalNode();
  node
    .insert(req.body.type)
    .then((key) => {
      console.log(logprefix, `New node issued: ${node.uid}@${req.client.ip}`);
      res.data({
        uid: node.uid,
        key: key,
      });
    })
    .catch(res.error);
});

router.get('/nodes/owns', login(), (req, res) => {
  AmethyTerminalNode.ofOwner(req.account.uid, 10000, 1, false, true)
    .then(res.data)
    .catch(res.error);
});

router.get('/nodes/members', login(), (req, res) => {
  AmethyTerminalNode.ofMember(req.account.uid, 10000, 1, false, true)
    .then(res.data)
    .catch(res.error);
});

router.get('/nodes/ping', (req, res) => {
  res.message('pong200');
});

/* 노드 정보 필요 (req.p.node) */
router.all('/nodes/:nid*', (req, res, next) => {
  // Preflight 요청 처리
  if (req.method == 'OPTIONS') {
    next();
    return;
  }
  let nid = req.params.nid;
  let key = req.headers['amethy-terminal-node-key'];
  // 노드가 존재하는지 확인
  AmethyTerminalNode.of(nid)
    .then((node) => {
      // 노드 키 인증
      if (node.verify(key)) {
        req.p.node = node;
        req.p.scope = 'plugin';
        next();
      } else if (req.login) {
        if (
          node.owner.element.uid == req.account.uid ||
          req.hasPermission('amethy.terminal.master')
        ) {
          req.p.node = node;
          req.p.scope = 'owner';
          next();
        } else if (node.members[req.account.uid]) {
          req.p.node = node;
          req.p.scope = 'member';
          req.p.mperms = node.members[req.account.uid];
          next();
        } else {
          res.error('auth401');
          return;
        }
      } else {
        res.error('auth401');
        return;
      }
    })
    .catch(res.error);
});

/**
 * @scope owner, member
 * @mperm dashboard.read
 */
router.get('/nodes/:nid', (req, res) => {
  if (!['owner', 'member'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  if (req.p.scope == 'member') {
    if (!req.p.mperms.includes('dashboard.read')) {
      res.error('auth401');
      return;
    }
  }

  res.data(req.p.node.toJSON());
});

/**
 * @scope owner
 */
router.delete('/nodes/:nid', (req, res) => {
  if (!['owner'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  req.p.node
    .delete()
    .then(() => {
      TerminalNodeListener.kill(req.p.node.uid);
      res.ok();
    })
    .catch(res.error);
});

/**
 * @scope owner
 */
router.patch('/nodes/:nid/label', body(), (req, res) => {
  if (!['owner'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  let label = req.body.label;
  label = label.replace(/^\s+|\s+$/g, '');
  label = label.replace(/\s+/g, ' ');
  if (!label) {
    label = 'Server';
  }
  label = label.replace(/</g, '&lt;');
  label = label.replace(/>/g, '&gt;');
  req.p.node.label = label;
  req.p.node
    .update(['label'])
    .then(() => {
      res.ok();
    })
    .catch(res.error);
});

/**
 * @scope owner
 */
router.get('/nodes/:nid/members', (req, res) => {
  if (!['owner'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  const tasks = [];

  for (const mem in req.p.node.members) {
    tasks.push(AuthAccount.of(mem));
  }

  Promise.all(tasks)
    .then((data) => {
      for (let i = 0; i < data.length; i++) {
        data[i] = data[i].toJSON(true);
        data[i].mperms = req.p.node.members[data[i].uid];
      }
      res.data(data);
    })
    .catch(res.error);
});

/**
 * @scope owner
 */
router.post('/nodes/:nid/members', body(), (req, res) => {
  if (!['owner'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  let member = req.body.member;
  let perms = req.body.permissions;

  AuthAccount.of(member)
    .then((account) => {
      if (account.element.uid == req.p.node.owner.element.uid) {
        res.error('서버 소유자는 멤버로 등록하실 수 없습니다.', 400);
        return;
      }
      req.p.node
        .setMember(account, perms)
        .then(() => {
          TerminalClientListener.eventToAccount(
            account.element.uid,
            'reload',
            {},
            '터미널 권한이 변경되었습니다.'
          );
          res.ok();
        })
        .catch(res.error);
    })
    .catch((error) => {
      if (error == 'default404') {
        res.error('해당 와니네 계정을 찾을 수 없습니다.', 404);
      } else {
        res.error(error);
      }
    });
});

/**
 * @scope owner
 */
router.delete('/nodes/:nid/members', body(), (req, res) => {
  if (!['owner'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  let member = req.body.member;

  AuthAccount.of(member)
    .then((account) => {
      req.p.node
        .deleteMember(account)
        .then(() => {
          TerminalClientListener.eventToAccount(
            account.element.uid,
            'exit',
            {},
            '터미널 노드가 제거되었습니다.'
          );
          res.ok();
        })
        .catch(res.error);
    })
    .catch(res.error);
});

/**
 * @scope owner, member
 * @mperm dashboard.read
 */
router.get('/nodes/:nid/systeminfo', (req, res) => {
  if (!['owner', 'member'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  if (req.p.scope == 'member') {
    if (!req.p.mperms.includes('dashboard.read')) {
      res.error('auth401');
      return;
    }
  }

  res.data(req.p.node.systeminfo);
});

/**
 * @scope owner, member
 * @mperm dashboard.read
 */
router.get('/nodes/:nid/systemstatus', (req, res) => {
  if (!['owner', 'member'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  if (req.p.scope == 'member') {
    if (!req.p.mperms.includes('dashboard.read')) {
      res.error('auth401');
      return;
    }
  }

  res.data(req.p.node.systemstatus);
});

/**
 * @scope owner, member
 * @mperm console.read
 */
router.get('/nodes/:nid/logs', (req, res) => {
  if (!['owner', 'member'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  if (req.p.scope == 'member') {
    if (!req.p.mperms.includes('console.read')) {
      res.error('auth401');
      return;
    }
  }

  let connection = TerminalNodeListener.of(req.p.node.uid);

  if (!connection) {
    res.data(req.p.node.logs);
  } else {
    res.data(connection.node.logs);
  }
});

/**
 * @scope owner, member
 * @mperm players.read
 */
router.get('/nodes/:nid/players', (req, res) => {
  if (!['owner', 'member'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  if (req.p.scope == 'member') {
    if (!req.p.mperms.includes('players.read')) {
      res.error('auth401');
      return;
    }
  }

  res.data(req.p.node.players);
});

/**
 * @scope owner, member
 * @mperm worlds.read
 */
router.get('/nodes/:nid/worlds', (req, res) => {
  if (!['owner', 'member'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  if (req.p.scope == 'member') {
    if (!req.p.mperms.includes('worlds.read')) {
      res.error('auth401');
      return;
    }
  }

  res.data(req.p.node.worlds);
});

/**
 * @scope owner, member
 * @mperm console.write
 */
router.post('/nodes/:nid/command', body(), (req, res) => {
  if (!['owner', 'member'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  if (req.p.scope == 'member') {
    if (!req.p.mperms.includes('console.write')) {
      res.error('auth401');
      return;
    }
  }

  let command = req.body.command;

  let connection = TerminalNodeListener.of(req.p.node.uid);

  if (!connection) {
    return;
  }

  connection.event('console/command', { data: command });

  res.ok();
});

/**
 * @scope plugin
 */
router.get('/nodes/:nid/check', (req, res) => {
  if (!['plugin'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  res.ok();
});

/**
 * @scope plugin
 */
router.post('/nodes/:nid/grant', body(), (req, res) => {
  if (!['plugin'].includes(req.p.scope)) {
    res.error('auth401');
    return;
  }

  if (req.p.node.owner.element.uid) {
    res.error('default400');
    return;
  }

  let owner = req.body.owner;

  AuthAccount.of(owner)
    .then((account) => {
      req.p.node
        .grant(account)
        .then(() => {
          res.data({
            account: {
              uid: account.uid,
              eid: account.eid,
              labal: account.element.labal,
            },
          });
        })
        .catch(res.error);
    })
    .catch(res.error);
});

import mojang from '../modules/amethy/terminal/mojang-api.mjs';

router.get('/mojang/players/:uuid/skin', (req, res) => {
  const uuid = req.params.uuid;

  mojang
    .skin(uuid)
    .then((data) => {
      data.pipe(res);
    })
    .catch((error) => {
      res.error(error.status);
    });
});

export default router;
