import { console } from '@wnynya/logger';

import express from 'express';
const router = express.Router();

import AmethyTerminalNode from '../modules/amethy/terminal/node.mjs';

import middlewares from '@wnynya/express-middlewares';
const internal = middlewares.check.internal;
const login = middlewares.check.login;
const body = middlewares.check.body;
const perm = middlewares.check.perm;

router.post('/nodes', (req, res) => {
  const node = new AmethyTerminalNode();
  node
    .insert()
    .then((key) => {
      console.log('new node ' + node.uid);
      res.data({
        uid: node.uid,
        key: key,
      });
    })
    .catch(res.error);
});

/* 키 정보 필요 (req.p.node) */
router.all('/nodes/:nid', (req, res, next) => {
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
      node
        .verify(key)
        .then(() => {
          req.p.node = node;
          next();
        })
        .catch(() => {
          res.error('auth401');
          return;
        });
    })
    .catch(res.error);
});

router.get('/nodes/:nid/check', (req, res) => {
  res.ok();
});

export default router;
