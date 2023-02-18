import database from '@wnynya/mysql-client';
import Date from 'datwo';
import Crypto from '@wnynya/crypto';

const table = 'bukkit_plugin_packages';

class BukkitPluginPackage {
  constructor(id = Crypto.uid()) {
    this.id = id;

    this.name = '';
    this.version = '';
    this.apiVersion = '';
    this.time = new Date().getTime();
    this.channel = 'default';
    this.uri = '';
  }

  async pull() {
    let query = 'SELECT * FROM `' + table + '` WHERE `id` = ?';
    let values = [this.id];

    const res = await database.query(query, values);

    if (res.length == 0) {
      throw new Error('default404');
    }

    const data = res[0];

    this.name = data.name;
    this.version = data.version;
    this.apiVersion = data.apiVersion;
    this.time = new Date(data.time).getTime();
    this.channel = data.channel;
    this.uri = data.uri;
  }

  async insert() {
    let query =
      'INSERT INTO ' +
      table +
      ' (`id`, `name`, `version`, `apiVersion`, `time`, `channel`, `uri`) VALUES (?, ?, ?, ?, ?, ?, ?)';

    let values = [
      this.id,
      this.name,
      this.version,
      this.apiVersion,
      new Date(this.time).format('YYYY-MM-DD hh:mm:ss'),
      this.channel,
      this.uri,
    ];

    await database.query(query, values);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      apiVersion: this.apiVersion,
      time: this.time,
      channel: this.channel,
      uri: this.uri,
    };
  }
}

async function get(name, version = 'latest', apiVersion, channel) {
  let query = 'SELECT `id` FROM `' + table + '` WHERE `name` = ? ';
  let values = [name];

  if (apiVersion) {
    query += 'AND `apiVersion` = ? ';
    values.push(apiVersion);
  }
  if (channel) {
    query += 'AND `channel` = ? ';
    values.push(channel);
  }

  if (version == 'latest') {
    query += 'ORDER BY time DESC LIMIT 1';
  } else {
    query += 'AND `version` = ?';
    values.push(version);
  }

  const res = await database.query(query, values);

  if (res.length == 0) {
    throw new Error('default404');
  }

  const data = res[0];

  const bpp = new BukkitPluginPackage(data.id);
  await bpp.pull();

  return bpp;
}

async function index(
  name,
  size,
  page,
  where = false,
  and = false,
  count = false
) {
  size = size * 1;
  page = page * 1;

  let query = '';
  let values = [name];

  if (!count) {
    query += 'SELECT * FROM ' + table + ' ';
  } else {
    query += 'SELECT COUNT(id) FROM ' + table + ' ';
  }

  if (where) {
    query += 'WHERE NAME = ? AND ( ';
    if (and) {
      for (const key in where) {
        query += key + ' LIKE ? AND ';
        values.push('%' + where[key] + '%');
      }
      query = query.slice(0, -5);
    } else {
      for (const key in where) {
        query += key + ' LIKE ? OR ';
        values.push('%' + where[key] + '%');
      }
      query = query.slice(0, -4);
    }
    query += ' ) ';
  }

  if (size == -1) {
    query += 'ORDER BY time DESC;';
  } else {
    query += 'ORDER BY time DESC LIMIT ? OFFSET ?';
    values.push(size);
    values.push((page - 1) * size);
  }

  const res = await database.query(query, values);

  if (!count) {
    const results = [];
    for (const r of res) {
      const data = {
        id: r.id,
        name: r.name,
        version: r.version,
        apiVersion: r.apiVersion,
        time: new Date(r.time).getTime(),
        channel: r.channel,
      };
      try {
        data.meta = JSON.parse(r.meta);
      } catch (error) {}
      results.push(data);
    }

    return results;
  } else {
    return res[0]['COUNT(id)'];
  }
}

import fs from 'fs';
import path, { resolve } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import multer from 'multer';

const filesdir = '/data/amethy/packages';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      const dir = filesdir;
      fs.existsSync(dir) ? null : fs.mkdirSync(dir, { recursive: true });
      callback(null, dir);
    },
    filename: (req, file, callback) => {
      const filename = req.p.bpp.id;
      callback(null, filename);
    },
  }),
}).single('package');

async function post(req, res) {
  return new Promise((resolve, reject) => {
    try {
      const bpp = new BukkitPluginPackage();
      req.p.bpp = bpp;
      upload(req, res, (error) => {
        if (error) {
          reject(error);
          return;
        }
        bpp.name = req.body.name;
        bpp.version = req.body.version;
        bpp.apiVersion = req.body.apiVersion;
        bpp.channel = req.body.channel;
        bpp
          .insert()
          .then(() => {
            resolve(bpp);
          })
          .catch((error) => {
            reject(error);
          });
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function getFileReadStream(
  name,
  version = 'latest',
  apiVersion,
  channel
) {
  const bpp = await get(name, (version = 'latest'), apiVersion, channel);
  const filepath = path.resolve(filesdir, bpp.id);
  if (!fs.existsSync(filepath)) {
    throw 'file404';
  }
  const stream = fs.createReadStream(filepath);
  return {
    stream: stream,
    filename: bpp.name + '-' + bpp.version + '.jar',
  };
}

export default {
  get: get,
  index: index,
  post: post,
  file: getFileReadStream,
};
