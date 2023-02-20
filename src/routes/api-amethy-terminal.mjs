import { console } from '@wnynya/logger';

import express from 'express';
const router = express.Router();

import AmethyTerminalNode from '../modules/amethy/terminal/terminal-node.mjs';

import middlewares from '@wnynya/express-middlewares';
const internal = middlewares.check.internal;
const login = middlewares.check.login;
const body = middlewares.check.body;
const perm = middlewares.check.perm;

router.get('/nodes', login(), (req, res) => {
  AmethyTerminalNode.index(10000, 1, false, true)
    .then(res.data)
    .catch(res.error);
});

router.post('/nodes', (req, res) => {
  const node = new AmethyTerminalNode();
  node
    .insert()
    .then((key) => {
      console.log('new node ' + node.uid, key);
      res.data({
        uid: node.uid,
        key: key,
      });
    })
    .catch(res.error);
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

router.patch('/nodes/:nid/label', body(), (req, res) => {
  let label = req.body.label;
  label = label.replace(/^\s+|\s+$/g, '');
  label = label.replace(/\s+/g, ' ');
  if (!label) {
    label = 'Server';
  }
  label = label.replace(/</g, '&lt;');
  label = label.replace(/>/g, '&gt;');
  console.log(label);
  req.p.node.label = label;
  req.p.node
    .update(['label'])
    .then(() => {
      res.ok();
    })
    .catch(res.error);
});

router.get('/nodes/:nid/check', (req, res) => {
  res.ok();
});

router.get('/nodes/:nid/systeminfo', (req, res) => {
  res.data(req.p.node.systeminfo);
});

router.get('/nodes/:nid/systemstatus', (req, res) => {
  res.data(req.p.node.systemstatus);
});

router.get('/nodes/:nid/logs', (req, res) => {
  res.data(req.p.node.logs);
});

router.get('/nodes/:nid/players', (req, res) => {
  res.data(req.p.node.players);
});

router.get('/nodes/:nid/worlds', (req, res) => {
  res.data(req.p.node.worlds);
});

export default router;
