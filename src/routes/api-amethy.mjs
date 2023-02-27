import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.ok('Wanyne API / Amethy');
});

router.get('/ping', (req, res) => {
  res.message('pong200');
});

import repositoryRouter from './api-amethy-repository.mjs';
router.use('/repository', repositoryRouter);

import terminalRouter from './api-amethy-terminal.mjs';
router.use('/terminal', terminalRouter);

import packagesRouter from './api-amethy-packages.mjs';
router.use('/packages', packagesRouter);

/*

import { TerminalNodeListener } from '../modules/amethy/terminal/terminal.mjs';
import {
  AmethyTerminalNode,
  getUID as getNodeUID,
  getNodes,
} from '../modules/amethy/terminal/node.mjs';

router.get('/terminal/client/nodes', (req, res) => {
  getNodes(req.client.id)
    .then((nodes) => {
      res.data(nodes);
    })
    .catch(res.error);
});

router.all('/terminal/client/nodes/:id*', (req, res, next) => {
  if (req.method == 'OPTIONS') {
    next();
  } else {
    getNodeUID(req.params.id)
      .then((uid) => {
        /*req.p.id = uid;
        next();
        return;*
        getNodes(req.client.id)
          .then((nodes) => {
            if (Permissions.has(req, 'amethy.master')) {
              req.p.id = uid;
              req.client.owner = true;
              next();
              return;
            }
            const acc = Object.keys(nodes.owns).concat(
              Object.keys(nodes.coowns)
            );
            if (acc.includes(uid)) {
              req.p.id = uid;
              if (Object.keys(nodes.owns).includes(uid)) {
                req.client.owner = true;
              }
              next();
            } else {
              res.error('default403');
            }
          })
          .catch((error) => {
            res.error('default500');
            console.error(error);
          });
      })
      .catch((error) => {
        res.error('default404');
      });
  }
});

router.get('/terminal/client/nodes/:id', (req, res) => {
  const nid = req.p.id;

  const tnode = new AmethyTerminalNode(nid);
  tnode
    .pull()
    .then(() => {
      res.data({
        id: tnode.id,
        eid: tnode.eid,
        name: tnode.name,
        status: tnode.status,
        owner: tnode.owner,
      });
    })
    .catch(res.error);
});

router.get('/terminal/client/nodes/:id/logs', (req, res) => {
  const nid = req.p.id;

  const connection = TerminalNodeListener.getConnection(nid);

  if (connection) {
    res.data(connection.node.logs);
  } else {
    const tnode = new AmethyTerminalNode(nid);
    tnode
      .pull('logs')
      .then(() => {
        res.data(tnode.logs);
      })
      .catch(res.error);
  }
});

router.get('/terminal/client/nodes/:id/systemstatus', (req, res) => {
  const nid = req.p.id;

  const connection = TerminalNodeListener.getConnection(nid);

  if (connection) {
    res.data(connection.node.systemstatus);
  } else {
    const tnode = new AmethyTerminalNode(nid);
    tnode
      .pull('systemstatus')
      .then(() => {
        res.data(tnode.systemstatus);
      })
      .catch(res.error);
  }
});

router.get('/terminal/client/nodes/:id/systeminfo', (req, res) => {
  const nid = req.p.id;

  const connection = TerminalNodeListener.getConnection(nid);

  if (connection) {
    const data = connection.node.systeminfo;
    data.connection = connection.node.meta.connection;
    res.data(data);
  } else {
    const tnode = new AmethyTerminalNode(nid);
    tnode
      .pull('systeminfo, meta')
      .then(() => {
        const data = tnode.systeminfo;
        data.connection = tnode.meta.connection;
        res.data(data);
      })
      .catch(res.error);
  }
});

router.put('/terminal/client/nodes/:id/coown', (req, res) => {
  const nid = req.p.id;

  const aeid = req.body.aeid;

  accounts
    .uid(aeid)
    .then((uid) => {
      /*if (uid == req.client.id) {
        res.message('400 why');
        return;
      }*
      const account = new Account(uid);
      account
        .pull('meta')
        .then(() => {
          account.meta.amethy ? null : (account.meta.amethy = {});
          account.meta.amethy.terminal
            ? null
            : (account.meta.amethy.terminal = {});
          account.meta.amethy.terminal.coowns
            ? null
            : (account.meta.amethy.terminal.coowns = []);
          if (account.meta.amethy.terminal.coowns.includes(nid)) {
            res.ok();
            return;
          }
          account.meta.amethy.terminal.coowns.push(nid);
          account
            .push('meta')
            .then(() => {
              res.ok();
              return;
            })
            .catch(res.error);
        })
        .catch(res.error);
    })
    .catch(res.error);
});

router.delete('/terminal/client/nodes/:id/coown', (req, res) => {
  const nid = req.p.id;

  const aeid = req.body.aeid;

  accounts
    .uid(aeid)
    .then((uid) => {
      if (req.client.id != uid) {
        if (!req.client.owner) {
          res.error('permission403');
          return;
        }
      }
      const account = new Account(uid);
      account
        .pull('meta')
        .then(() => {
          if (!account.meta?.amethy?.terminal?.coowns) {
            res.ok();
            return;
          }
          let index = account.meta.amethy.terminal.coowns.indexOf(nid);
          if (index < 0) {
            res.ok();
            return;
          }
          account.meta.amethy.terminal.coowns.splice(index, 1);
          account
            .push('meta')
            .then(() => {
              res.ok();
              return;
            })
            .catch(res.error);
        })
        .catch(res.error);
    })
    .catch(res.error);
});

router.patch('/terminal/client/nodes/:id/eid', (req, res) => {
  const nid = req.p.id;

  let eid = req.body.eid + '';

  eid = eid.replace(/[^0-9a-z\-]/g, '');

  if (!eid || eid == '') {
    eid = nid;
  }

  const tnode = new AmethyTerminalNode(nid);
  tnode
    .pull('eid')
    .then(() => {
      tnode.eid = eid;
      tnode.push('eid').then(res.ok).catch(res.error);
    })
    .catch(res.error);
});

router.patch('/terminal/client/nodes/:id/name', (req, res) => {
  const nid = req.p.id;

  let name = req.body.name + '';

  name = name.replace(/[<>]/g, '');

  if (!name || name == '') {
    name = nid;
  }

  const tnode = new AmethyTerminalNode(nid);
  tnode
    .pull('name')
    .then(() => {
      tnode.name = name;
      tnode.push('name').then(res.ok).catch(res.error);
    })
    .catch(res.error);
});

router.post('/terminal/nodes', (req, res) => {
  const tnode = new AmethyTerminalNode();
  tnode
    .insert()
    .then((key) => {
      console.log('new node ' + tnode.id);
      res.data({
        id: tnode.id,
        key: key,
      });
    })
    .catch((error) => {
      res.error(error);
      console.error(error);
    });
});

router.get('/terminal/nodes/:id/check', (req, res) => {
  const nid = req.params.id;
  const pkey = req.query.p;

  const tnode = new AmethyTerminalNode(nid);
  tnode
    .pull('eid')
    .then(() => {
      tnode
        .verify(pkey)
        .then(() => {
          res.ok();
        })
        .catch((error) => {
          res.error(error);
          console.error(error);
        });
    })
    .catch((error) => {
      res.error(error);
    });
});

router.post('/terminal/nodes/:id/grant', (req, res) => {
  const nid = req.params.id;
  const aeid = req.body.account;

  const tnode = new AmethyTerminalNode(nid);
  tnode
    .grant(aeid)
    .then((a) => {
      const data = {};
      data.to = {
        eid: a[0].eid,
      };
      if (a[1]) {
        data.from = {
          eid: a[1]?.eid,
        };
      }
      res.data(data);
    })
    .catch(res.error);
});

import files from '../modules/amethy/terminal/files.mjs';

router.post('/terminal/files', (req, res) => {
  files.upload(req, res).then(res.data).catch(res.error);
});

router.get('/terminal/files/:id', (req, res) => {
  files
    .path(req.params.id)
    .then((path) => {
      res.sendFile(path);
    })
    .catch(res.error);
});

router.delete('/terminal/files/:id', (req, res) => {
  files.delete(req.params.id).then(res.ok).catch(res.error);
});

/**
 * @desc Patch params id (uid, eid, email) to uid
 */
/*router.all('/:id*', (req, res, next) => {
  if (req.method == 'OPTIONS') {
    next();
  } else {
    accounts
      .uid(req.params.id == '@me' && req.client.login ? req.client.id : req.params.id)
      .then((uid) => {
        req.p.id = uid;
        next();
      })
      .catch((error) => {
        req.p.id = '00000000000000000000000000000000';
        next();
      });
  }
});*

router.get('/terminal/nodes/:id', (req, res) => {
  const nid = req.p.id;

  const Node = new AmethyTerminalNode(nid);
  Node.pull()
    .then(() => {
      res.data(Node.toJSON());
    })
    .catch(res.error);
});

import songs from '../modules/amethy/cucumbery/songs.mjs';

router.post('/cucumbery/songs/play', (req, res) => {
  const song = req.body.song;

  songs.play(song).then(res.data).catch(res.error);
});

*/

export default router;
