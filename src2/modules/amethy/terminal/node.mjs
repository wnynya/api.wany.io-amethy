import database from '@wnynya/mysql-client';
import Crypto from '@wnynya/crypto';
import Date from 'datwo';
import { Accounts, Account } from '@wnynya/accounts';

const logprefixt = '[Amethy] [Terminal]: ';

class AmethyTerminalNode {
  constructor(id = Crypto.uid()) {
    this.id = id;
    this.eid = this.id;
    this.name = this.id;
    this.keyhash = '';

    this.type = 'default';
    this.status = 'offline';

    this.owner = '';

    this.logs = [];
    this.systeminfo = {};
    this.systemstatus = [];
    this.players = [];
    this.worlds = [];

    this.meta = {
      logsLength: 2000,
      systemstatusLength: 61,
    };

    this.consolehistory = [];

    this.registerdate = new Date().getTime();

    this.table = 'amethy_terminal_nodes';

    this.update = {};
  }

  async pull(part = '*') {
    let query = 'SELECT ' + part + ' FROM `' + this.table + '` WHERE `id` = ?';
    let values = [this.id];

    const res = await database.query(query, values);

    if (res.length == 0) {
      throw new Error('default404');
    }

    const data = res[0];

    for (const key in data) {
      if (['eid', 'name', 'type', 'owner', 'status', 'keyhash'].includes(key)) {
        this[key] = data[key];
      } else if (
        [
          'logs',
          'systeminfo',
          'systemstatus',
          'players',
          'worlds',
          'meta',
          'consolehistory',
        ].includes(key)
      ) {
        try {
          this[key] = JSON.parse(data[key]);
        } catch (error) {
          console.error(error);
        }
      } else if (['registerdate'].includes(key)) {
        this[key] = new Date(data[key]).getTime();
      }
    }
  }

  async push(part) {
    let query = 'UPDATE `' + this.table + '` SET ';
    let values = [];
    if (part) {
      query += '`' + part + '` = ? ';
      const key = part;
      if (['eid', 'name', 'type', 'owner', 'status', 'keyhash'].includes(key)) {
        values.push(this[key]);
      } else if (
        [
          'logs',
          'systeminfo',
          'systemstatus',
          'players',
          'worlds',
          'meta',
          'consolehistory',
        ].includes(key)
      ) {
        values.push(JSON.stringify(this[key]));
      }
    } else {
      query +=
        '`eid` = ?, `name` = ?, `type` = ?, `owner` = ?, `status` =?, `logs` = ?, ';
      query +=
        '`systeminfo` = ?, `systemstatus` = ?, `players` = ?, `worlds` = ?, ';
      query += '`meta` = ?, `consolehistory` = ? ';
      values.push(this.eid, this.name, this.type, this.owner, this.status);
      values.push(
        JSON.stringify(this.logs),
        JSON.stringify(this.systeminfo),
        JSON.stringify(this.systemstatus)
      );
      values.push(
        JSON.stringify(this.players),
        JSON.stringify(this.worlds),
        JSON.stringify(this.meta),
        JSON.stringify(this.consolehistory)
      );
    }
    query += 'WHERE `id` = ?';
    values.push(this.id);

    await database.query(query, values).catch((error) => {
      console.warn(error);
    });
  }

  async insert() {
    let query =
      'INSERT INTO ' +
      this.table +
      ' (`id`, `eid`, `name`, `type`, `meta`, `registerdate`, `keyhash`) VALUES (?, ?, ?, ?, ?, ?, ?)';

    this.name = this.name.replace(/^(.{0,16})/, '$1');
    if (!this.name || this.name == '') {
      this.name = '👻';
    }

    const key = Crypto.uid();
    const hash = new Crypto(key).salt('').hash();

    let values = [];
    values.push(
      this.id,
      this.eid,
      this.name,
      this.type,
      JSON.stringify(this.meta),
      new Date().format('YYYY-MM-DD hh:mm:ss'),
      hash
    );

    await database.query(query, values);

    return key;
  }

  async pushLog(data) {
    data.message = data.message.replace(/\u007f/g, '\u00a7');
    while (this.logs.length >= this.meta.logsLength) {
      this.logs.shift();
    }
    this.logs.push(data);
  }

  async pushSystemstatus(data) {
    while (this.systemstatus.length >= this.meta.systemstatusLength) {
      this.systemstatus.shift();
    }
    this.systemstatus.push(data);
  }

  async pushConsolehistory(data) {}

  async grant(aeid) {
    await this.pull('owner');

    let oa = null;
    if (this.owner) {
      try {
        oa = new Account(this.owner);
        await oa.pull('eid, meta');
        !oa.meta.amethy ? (oa.meta.amethy = {}) : null;
        !oa.meta.amethy.terminal ? (oa.meta.amethy.terminal = {}) : null;
        !oa.meta.amethy.terminal.owns
          ? (oa.meta.amethy.terminal.owns = [])
          : null;
        var i = oa.meta.amethy.terminal.owns.indexOf(this.id);
        if (i > -1) {
          oa.meta.amethy.terminal.owns.splice(i, 1);
        }
        await oa.push('meta');
      } catch (error) {}
    }

    const aid = await Accounts.uid(aeid);
    const account = new Account(aid);
    await account.pull('eid, meta');

    !account.meta.amethy ? (account.meta.amethy = {}) : null;
    !account.meta.amethy.terminal ? (account.meta.amethy.terminal = {}) : null;
    !account.meta.amethy.terminal.owns
      ? (account.meta.amethy.terminal.owns = [])
      : null;
    account.meta.amethy.terminal.owns.push(this.id);

    await account.push('meta');

    this.owner = account.id;

    await this.push('owner');

    console.log(
      logprefixt + 'Node ' + this.id + ' granted to Account ' + account.id
    );

    return [account, oa];
  }

  async verify(key) {
    await this.pull('keyhash');
    const hash = new Crypto(key).salt('').hash();
    if (this.keyhash === hash) {
      return true;
    } else {
      throw new Error('default401');
    }
  }
}

export default AmethyTerminalNode;
export { AmethyTerminalNode };

/**
 * @async
 * @function getUID
 * @description Get account uid of eid
 * @param {string} id uid, eid, email...
 */
async function getUID(id) {
  let query =
    'SELECT `id` FROM `amethy_terminal_nodes` WHERE `eid` = ? OR `id` = ?';
  let values = [id, id];

  const res = await database.query(query, values);

  if (res.length == 0) {
    throw new Error('default404');
  }

  const data = res[0];

  return data.id;
}
export { getUID };

async function getNodes(aid) {
  const account = new Account(aid);

  await account.pull('meta');

  let owns = account.meta?.amethy?.terminal?.owns || [];
  let coowns = account.meta?.amethy?.terminal?.coowns || [];

  let tasks = [];
  for (const id of owns) {
    tasks.push(
      new Promise((resolve, reject) => {
        const node = new AmethyTerminalNode(id);
        node
          .pull('eid, name, owner, status, systeminfo')
          .then(() => {
            resolve(node);
          })
          .catch((error) => {
            resolve(null);
          });
      })
    );
  }
  for (const id of coowns) {
    tasks.push(
      new Promise((resolve, reject) => {
        const node = new AmethyTerminalNode(id);
        node
          .pull('eid, name, owner, status, systeminfo')
          .then(() => {
            resolve(node);
          })
          .catch((error) => {
            resolve(null);
          });
      })
    );
  }

  let nodes = { owns: {}, coowns: {} };
  for (const node of await Promise.all(tasks)) {
    if (!node) {
      continue;
    }
    if (owns.includes(node.id)) {
      if (node.owner != aid) {
        continue;
      }
      nodes.owns[node.id] = {
        id: node.id,
        eid: node.eid,
        name: node.name,
        status: node.status,
        ip: node?.systeminfo?.ip || '',
      };
    } else if (coowns.includes(node.id)) {
      nodes.coowns[node.id] = {
        id: node.id,
        eid: node.eid,
        name: node.name,
        status: node.status,
        ip: node?.systeminfo?.ip || '',
      };
    }
  }

  return nodes;
}
export { getNodes };
