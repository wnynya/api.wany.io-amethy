import { console } from '@wnynya/logger';

import express from 'express';
const router = express.Router();

import middlewares from '@wnynya/express-middlewares';
const internal = middlewares.check.internal;
const login = middlewares.check.login;
const body = middlewares.check.body;
const perm = middlewares.check.perm;

import packages from '../modules/amethy/repository/packages.mjs';
import packagesConfig from '../modules/amethy/repository/packages-config.mjs';

router.use((req, res, next) => {
  const key =
    req?.headers?.authorization ||
    req?.headers?.Authorization ||
    req?.headers?.o ||
    req?.body?.o ||
    req?.query?.o;

  req.p = {};

  req.p.permissions = [];

  if (key && packagesConfig.keys.hasOwnProperty(key)) {
    req.p.permissions = packagesConfig.keys[key].permissions;
  }

  req.p.hasPermission = (node) => {
    function check(source, target) {
      const sourceArray = source.split('.');
      const targetArray = target.split('.');
      const loop = Math.max(sourceArray.length, targetArray.length);
      let bool = false;
      let lastSource;
      for (let n = 0; n < loop; n++) {
        if (!(sourceArray[n] == null || sourceArray[n] == undefined)) {
          lastSource = sourceArray[n];
        }
        bool =
          lastSource == targetArray[n] ||
          (lastSource == '*' &&
            !(targetArray[n] == null || targetArray[n] == undefined));
        if (!bool) {
          break;
        }
      }
      return bool;
    }

    function checkArray(array, permission) {
      var bool = false;
      for (const perm of array) {
        if (perm.startsWith('-')) {
          if (check(perm.substring(1), permission)) {
            return false;
          }
        } else {
          bool = check(perm, permission);
        }
        if (bool) {
          return true;
        }
      }
      return false;
    }

    function has(permissions, permission) {
      if (Array.isArray(permissions)) {
        return checkArray(permissions, permission);
      } else if (permissions?.client?.permissions) {
        return checkArray(permissions?.client?.permissions, permission);
      } else {
        return false;
      }
    }

    return has(req.p.permissions, node);
  };

  next();
});

router.get('/', (req, res) => {
  res.data('AmeRepo Server');
});

router.get('/maven', (req, res) => {
  let host = req.hostname;
  let protocol = req.headers['x-forwarded-proto'] || req.protocol;

  const text =
    `AmeRepo Maven Repository

[Repository in pom.xml]

<repository>
  <id>` +
    host +
    `</id>
  <name>AmeRepo ` +
    host +
    `</name>
  <url>` +
    protocol +
    `://` +
    host +
    req.originalUrl +
    `</url>
</repository>

  `;
  res.set('Content-Type', 'text/text');
  res.send(text);
});

router.get('/maven/*', (req, res) => {
  const match = req.originalUrl.match(
    /\/maven\/(?:(.*)\/([^\/]*))\/([^\/]*)\/([^\/]*)$/i
  );
  if (!match) {
    res.error('default404');
    return;
  }
  const group = match[1].replaceAll('/', '.');
  const pid = match[2].toLowerCase();
  const version = match[3];
  const filename = match[4];

  if (!packagesConfig.packages.hasOwnProperty(pid)) {
    res.error('default404');
    return;
  }

  const pkg = packagesConfig.packages[pid];

  if (
    pkg.maven.groupId.toLowerCase() != group.toLowerCase() ||
    pkg.maven.artifactId.toLowerCase() != pid
  ) {
    res.error('default404');
    return;
  }

  if (pkg.private) {
    res.error(403, 'Private Package');
    return;
  }

  packages
    .get2(pid, version)
    .then((data) => {
      if (filename == pid + '-' + version + '.jar') {
        packages
          .file(pid, data.channel, version)
          .then((file) => {
            res.sendFile(file);
          })
          .catch(res.error);
      } else if (filename == pid + '-' + version + '.pom') {
        let xml = '';
        xml += '<project ';
        xml += '  xmlns="http://maven.apache.org/POM/4.0.0" ';
        xml += '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ';
        xml +=
          '  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd"';
        xml += '>';
        xml += '  <modelVersion>4.0.0</modelVersion>';
        xml += '  <groupId>' + pkg.maven.groupId + '</groupId>';
        xml += '  <artifactId>' + pkg.maven.artifactId + '</artifactId>';
        xml += '  <version>' + version + '</version>';
        xml += '</project>';
        res.set('Content-Type', 'text/xml');
        res.send(xml);
      } else {
        res.error('default404');
      }
    })
    .catch(res.error);
});

router.all('/:pid*', (req, res, next) => {
  if (packagesConfig.packages.hasOwnProperty(req.params.pid)) {
    req.package = packagesConfig.packages[req.params.pid];
    req.package.id = req.params.pid;
    req.p.pid = req.params.pid;

    if (req.package.private) {
      if (!req.p.hasPermission('packages.' + req.package.id + '.post')) {
        res.error('permission403');
        return;
      } else {
        next();
      }
    } else {
      next();
    }
  } else {
    res.error('default404');
    return;
  }
});

router.get('/:pid', (req, res) => {
  let protocol = req.headers['x-forwarded-proto'] || req.protocol;
  let host = req.hostname;
  let path = req.originalUrl.replace('/' + req.p.pid, '/maven');
  let primaryChannel;
  for (const channel in req.package.channels) {
    if (req.package.channels[channel].primary) {
      primaryChannel = channel;
    }
  }

  packages
    .get(req.p.pid, primaryChannel, 'latest')
    .then((data) => {
      let text = '';
      text += '\n';
      text += '\n';
      text += '[maven repository]\n';
      text += '\n';
      text += '<repository>\n';
      text += '  <id>' + host + '</id>\n';
      text += '  <name>AmeRepo ' + host + '</name>\n';
      text += '  <url>' + protocol + '://' + host + path + '</url>\n';
      text += '</repository>\n';
      text += '\n';
      text += '<!-- ' + protocol + '://' + host + path + ' -->\n';
      text += '<dependency>\n';
      text += '  <groupId>' + req.package.maven.groupId + '</groupId>\n';
      text +=
        '  <artifactId>' + req.package.maven.artifactId + '</artifactId>\n';
      text += '  <version>' + data.version + '</version>\n';
      text += '</dependency>\n';
      text += '\n';
      text += '[bukkit plugin updater]\n';
      text += '\n';
      text +=
        protocol +
        '://' +
        host +
        req.originalUrl +
        '/BukkitPluginUpdater.java\n';
      res.set('Content-Type', 'text/text');
      res.send(text);
    })
    .catch(res.error);
});

router.get('/:pid/BukkitPluginUpdater.java', (req, res) => {
  const java = `
  `;
  res.set('Content-Type', 'text/text');
  res.send(java);
});

router.all('/:pid/:channel*', (req, res, next) => {
  if (req.package.channels.hasOwnProperty(req.params.channel)) {
    req.p.channel = req.params.channel;
    next();
  } else {
    res.error('default404');
    return;
  }
});

router.get('/:pid/:channel', (req, res) => {
  packages.index(req.p.pid, req.p.channel).then(res.data).catch(res.error);
});

router.post('/:pid/:channel', (req, res) => {
  if (!req.p.hasPermission('packages.' + req.p.pid + '.post')) {
    res.error('permission403');
    return;
  }
  packages.post(req, res).then(res.ok).catch(res.error);
});

router.get('/:pid/:channel/:version', (req, res) => {
  packages
    .get(req.p.pid, req.p.channel, req.params.version)
    .then((data) => {
      res.data(data);
    })
    .catch(res.error);
});

router.get('/:pid/:channel/:version/:filename', (req, res) => {
  packages
    .file(req.p.pid, req.p.channel, req.params.version)
    .then((file) => {
      res.sendFile(file);
    })
    .catch(res.error);
});

export default router;
