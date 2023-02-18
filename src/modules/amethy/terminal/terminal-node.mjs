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
    this.status = 'offline';
    this.ip = '';
    this.systeminfo = {};
    this.systemstatus = {};
    this.logs = [];
    this.consolehistory = [];
    this.meta = {};

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
        (uid) => {
          return new AuthAccount(new AuthElement(uid));
        },
        (acn) => {
          return acn ? acn.element.uid : '';
        },
      ],
      status: 'string',
      ip: 'string',
      systeminfo: 'object',
      systemstatus: 'object',
      logs: 'array',
      consolehistory: 'array',
      meta: 'object',
    };
    this.filter = { uid: this.uid };

    this.logsLength = 2000;
    this.systemstatusLength = 61;
    this.consolehistoryLength = 100;
  }

  async insert(key = Crypto.randomString(42)) {
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

  toJSON() {
    return {
      uid: this.element.uid,
      label: this.element.label,
      creation: this.element.creation.getTime(),
      lastused: this.element.lastused.getTime(),
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
}
