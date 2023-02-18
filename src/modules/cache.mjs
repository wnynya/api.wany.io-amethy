import database from '@wnynya/mysql-client';
import Date from 'datwo';
import Crypto from '@wnynya/crypto';

class Cache {
  constructor(id = '/') {
    this.table = 'caches';
    !id.includes('/') ? (id = '/' + id) : null;
    this.id = new Crypto(id).hash();
    const idi = id.indexOf('/');
    const ids = [id.slice(0, idi), id.slice(idi + 1)];
    this.namespace = ids[0];
    this.key = ids[1];
    this.key.length > 127 ? (this.key = new Crypto(this.key).hash()) : null;
    this.time = 0;
    this.value = {};
    this.fresh = 0;
  }

  async pull() {
    let query = 'SELECT value, time FROM `' + this.table + '` WHERE `id` = ?';
    let values = [this.id];

    const res = await database.query(query, values);

    if (res.length == 0) {
      this.fresh = 1;
      return;
    }
    this.fresh = -1;

    const data = res[0];

    this.value = data.value;

    try {
      this.value = JSON.parse(this.value);
    } catch (error) {}

    this.time = new Date(data.time).getTime();
  }

  async push() {
    let query = 'UPDATE `' + this.table + '` SET ';
    query += '`value` = ?, `time` = ? ';
    query += 'WHERE `id` = ?';

    let value = this.value;
    try {
      value = JSON.stringify(this.value);
    } catch (error) {}

    let values = [
      value,
      new Date(this.time).format('YYYY-MM-DD hh:mm:ss'),
      this.id,
    ];

    await database.query(query, values);
  }

  async insert() {
    let query = 'INSERT INTO ' + this.table + ' ';
    query += '(`id`, `namespace`, `key`, `value`, `time`) ';
    query += 'VALUES (?, ?, ?, ?, ?)';

    let value = this.value;
    try {
      value = JSON.stringify(this.value);
    } catch (error) {}

    let values = [
      this.id,
      this.namespace,
      this.key,
      value,
      new Date(this.time).format('YYYY-MM-DD hh:mm:ss'),
    ];

    await database.query(query, values);
  }

  async update(value) {
    if (this.fresh == 0) {
      return;
    }
    await this.pull();
    this.value = value;
    this.time = new Date().getTime();
    if (this.fresh == 1) {
      await this.insert();
    } else if (this.fresh == -1) {
      await this.push();
    }
  }
}

export default Cache;
