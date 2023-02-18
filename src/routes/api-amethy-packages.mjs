import { console } from '@wnynya/logger';

import express from 'express';
const router = express.Router();

import packages from '../modules/amethy/packages.mjs';
const packageName = 'Amethy';

router.get('/', (req, res) => {
  if (req.query.latest == '') {
    packages
      .get(packageName, 'latest', req.query.apiVersion, req.query.channel)
      .then((pkg) => {
        res.data([pkg.toJSON()]);
      })
      .catch(res.error);
  } else {
    let where = false;
    let size = -1;
    let page = 1;
    let and = false;
    let count = false;

    if (req.query.count == '') {
      count = true;
    }
    if (req.query.and == '') {
      and = true;
    }
    if (req.query.channel) {
      if (!where) {
        where = new Object();
      }
      where.channel = req.query.channel;
    }
    if (req.query.api || req.query.apiVersion) {
      if (!where) {
        where = new Object();
      }
      where.apiVersion = req.query.api || req.query.apiVersion;
    }

    packages
      .index(packageName, size, page, where, and, count)
      .then((pkgs) => {
        res.data(pkgs);
      })
      .catch(res.error);
  }
});

router.post('/', (req, res) => {
  packages
    .post(req, res)
    .then((pkg) => {
      res.ok();
      console.log(logprefixp + 'New package uploaded (' + pkg.version + ')');
    })
    .catch(res.error);
});

router.get('/:version', (req, res) => {
  packages
    .get(
      packageName,
      req.params.version,
      req.query.apiVersion,
      req.query.channel
    )
    .then((pkg) => {
      res.data(pkg.toJSON());
    })
    .catch(res.error);
});

router.get('/:version/download', (req, res) => {
  packages
    .file(
      packageName,
      req.params.version,
      req.query.apiVersion,
      req.query.channel
    )
    .then((pkg) => {
      res.setHeader(
        'Content-disposition',
        'attachment; filename=' + pkg.filename
      );
      res.setHeader('content-type', 'application/java-archive');
      pkg.stream.pipe(res);
    })
    .catch(res.error);
});

export default router;
