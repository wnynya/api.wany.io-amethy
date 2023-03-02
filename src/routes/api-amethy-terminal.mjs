import { console } from '@wnynya/logger';

import express from 'express';
const router = express.Router();

import AmethyTerminalNode from '../modules/amethy/terminal/terminal-node.mjs';
import { TerminalNodeListener } from '../modules/amethy/terminal/terminal-listeners.mjs';

import middlewares from '@wnynya/express-middlewares';
const internal = middlewares.check.internal;
const login = middlewares.check.login;
const body = middlewares.check.body;
const perm = middlewares.check.perm;

const logprefix = '[Amethy] [Terminal]:';

router.get('/nodes', login(), (req, res) => {
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
        next();
      } else if (req.hasPermission(`amethy.terminal.nodes.${nid}`)) {
        req.p.node = node;
        next();
      } else {
        res.error('auth401');
        return;
      }
    })
    .catch(res.error);
});

router.get('/nodes/:nid', (req, res) => {
  res.data(req.p.node.toJSON());
});

router.delete('/nodes/:nid', (req, res) => {
  req.p.node.delete().then(res.ok).catch(res.error);
});

router.get('/nodes/:nid/check', (req, res) => {
  res.ok();
});

router.patch('/nodes/:nid/label', body(), (req, res) => {
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

router.get('/nodes/:nid/systeminfo', (req, res) => {
  res.data(req.p.node.systeminfo);
});

router.get('/nodes/:nid/systemstatus', (req, res) => {
  res.data(req.p.node.systemstatus);
});

router.get('/nodes/:nid/logs', (req, res) => {
  let connection = TerminalNodeListener.of(req.p.node.uid);

  if (!connection) {
    res.data(req.p.node.logs);
  } else {
    res.data(connection.node.logs);
  }
});

router.get('/nodes/:nid/players', (req, res) => {
  res.data(req.p.node.players);
});

router.get('/nodes/:nid/worlds', (req, res) => {
  res.data(req.p.node.worlds);
});

router.post('/nodes/:nid/command', body(), (req, res) => {
  let command = req.body.command;

  let connection = TerminalNodeListener.of(req.p.node.uid);

  if (!connection) {
    return;
  }

  connection.event('console/command', { data: command });

  res.ok();
});

export default router;
