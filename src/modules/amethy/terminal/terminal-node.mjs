import Crypto from '@wnynya/crypto';
import mysql from '@wnynya/mysql-client';
import { MySQLClass } from '@wnynya/mysql-client';
import { AuthAccount, AuthElement } from '@wnynya/auth';

const table = 'amethy_terminal_nodes';

export default class AmethyTerminalNode extends MySQLClass {
  constructor(uid = Crypto.uid()) {
    super(mysql);

    this.uid = uid;
    this.label = `Server-${Crypto.randomString(6)}`;
    this.hash = new Crypto().hash();
    this.salt = new Crypto().hash();
    this.type = '';
    this.creation = new Date();
    this.lastused = this.creation;
    this.owner = null;
    this.members = {};
    this.status = 'offline';
    this.ip = '';
    this.systeminfo = {};
    this.systemstatus = [];
    this.logs = [];
    this.players = [];
    this.worlds = [];
    this.consolehistory = [];
    this.meta = {};

    this.memberPermissions = [
      'dashboard.read', // default
      'console.read',
      'console.write',
      'filesystem.read',
      'filesystem.write',
      'players.read',
      'players.write',
      'worlds.read',
      'worlds.write',
    ];

    this.table = table;
    this.schema = {
      uid: 'string',
      label: 'string',
      hash: 'string',
      salt: 'string',
      type: 'string',
      creation: 'date',
      lastused: 'date',
      owner: [
        async (uid) => {
          const account = new AuthAccount(new AuthElement(uid));
          await account.select().catch((e) => {});
          return account;
        },
        (acn) => {
          return acn ? acn.element.uid : '';
        },
      ],
      members: 'object',
      status: 'string',
      ip: 'string',
      systeminfo: 'object',
      systemstatus: 'object',
      logs: 'array',
      players: 'array',
      worlds: 'array',
      consolehistory: 'array',
      meta: 'object',
    };
    this.filter = { uid: this.uid };

    this.logsLength = 2000;
    this.logsUpdated = false;
    this.systemstatusLength = 61;
    this.consolehistoryLength = 100;
  }

  async insert(type, key = Crypto.randomString(42)) {
    this.type = type;
    this.salt = this.crypt(this.salt);
    this.hash = this.crypt(key);
    await this.insertQuery();
    return key;
  }

  async select(parts = '*') {
    await this.selectQuery(parts);
  }

  async update(parts) {
    await this.updateQuery(parts);
  }

  async delete() {
    await this.deleteQuery();
  }

  async grant(account) {
    this.owner = account;
    await this.update(['owner']);
  }

  async setMember(account, permissions = []) {
    if (!permissions.includes('dashboard.read')) {
      permissions.push('dashboard.read');
    }
    this.members[account.element.uid] = permissions;
    await this.update(['members']);
  }

  async deleteMember(account) {
    delete this.members[account.element.uid];
    await this.update(['members']);
  }

  toJSON() {
    return {
      uid: this.uid,
      label: this.label,
      type: this.type,
      creation: this.creation.getTime(),
      lastused: this.lastused.getTime(),
      owner: this.owner,
      members: this.members,
      status: this.status,
      ip: this.ip,
      systeminfo: this.systeminfo,
      players: this.players.length,
      worlds: this.worlds.length,
    };
  }

  crypt(string) {
    return new Crypto(string).salt(this.salt).hash();
  }

  verify(key) {
    return this.hash === this.crypt(key);
  }

  static async of(uid) {
    const node = new AmethyTerminalNode(uid);

    await node.select();

    return node;
  }

  static async index(size = 20, page = 1, count = false, toJSON = false) {
    const res = await mysql.query({
      statement: 'SELECT',
      table: table,
      imports: {
        uid: 'string',
      },
      filter: {},
      join: 'OR',
      like: true,
      size: size,
      page: page,
      count: count,
    });

    let nodes = [];
    const tasks = [];

    for (const data of res) {
      const node = new AmethyTerminalNode(data.uid);
      nodes.push(node);
      tasks.push(node.select());
    }

    await Promise.all(tasks);

    if (toJSON) {
      const nodesJSON = [];
      for (const node of nodes) {
        let json = node.toJSON();
        delete json.systeminfo?.system;
        delete json.systeminfo?.user;
        delete json.systeminfo?.os;
        delete json.systeminfo?.java;
        delete json.systeminfo?.network;
        delete json.systeminfo?.commands;
        delete json.worlds;
        nodesJSON.push(node.toJSON());
      }
      nodes = nodesJSON;
    }

    return nodes;
  }

  static async ofOwner(
    aid,
    size = 20,
    page = 1,
    count = false,
    toJSON = false
  ) {
    const res = await mysql.query({
      statement: 'SELECT',
      table: table,
      imports: {
        uid: 'string',
      },
      filter: {
        owner: aid,
      },
      join: 'OR',
      like: true,
      size: size,
      page: page,
      count: count,
    });

    let nodes = [];
    const tasks = [];

    for (const data of res) {
      const node = new AmethyTerminalNode(data.uid);
      nodes.push(node);
      tasks.push(node.select());
    }

    await Promise.all(tasks);

    if (toJSON) {
      const nodesJSON = [];
      for (const node of nodes) {
        let json = node.toJSON();
        delete json.systeminfo?.system;
        delete json.systeminfo?.user;
        delete json.systeminfo?.os;
        delete json.systeminfo?.java;
        delete json.systeminfo?.network;
        delete json.systeminfo?.commands;
        delete json.worlds;
        nodesJSON.push(node.toJSON());
      }
      nodes = nodesJSON;
    }

    return nodes;
  }

  static async ofMember(
    aid,
    size = 20,
    page = 1,
    count = false,
    toJSON = false
  ) {
    const res = await mysql.query({
      statement: 'SELECT',
      table: table,
      imports: {
        uid: 'string',
      },
      filter: {
        members: `%${aid}%`,
      },
      join: 'OR',
      like: true,
      size: size,
      page: page,
      count: count,
    });

    let nodes = [];
    const tasks = [];

    for (const data of res) {
      const node = new AmethyTerminalNode(data.uid);
      nodes.push(node);
      tasks.push(node.select());
    }

    await Promise.all(tasks);

    if (toJSON) {
      const nodesJSON = [];
      for (const node of nodes) {
        let json = node.toJSON();
        delete json.systeminfo?.system;
        delete json.systeminfo?.user;
        delete json.systeminfo?.os;
        delete json.systeminfo?.java;
        delete json.systeminfo?.network;
        delete json.systeminfo?.commands;
        delete json.worlds;
        nodesJSON.push(node.toJSON());
      }
      nodes = nodesJSON;
    }

    return nodes;
  }
}
