import Request from '@wnynya/request';
import Date from 'datwo';
import Cache from '../cache.mjs';

async function set(key, value) {
  const cache = new Cache('api.amethy.playersync/' + key);
  await cache.pull();
  await cache.update(value);
  return;
}

async function get(key) {
  const cache = new Cache('api.amethy.playersync/' + key);
  await cache.pull();
  return cache.value;
}

export default {
  set: set,
  get: get,
};
