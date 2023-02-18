import config from '../config.mjs';

import express from 'express';
const router = express.Router();
import { console } from '@wnynya/logger';

import middlewares from '@wnynya/express-middlewares';
const internal = middlewares.check.internal;
const login = middlewares.check.login;
const body = middlewares.check.body;
const perm = middlewares.check.perm;

import Cache from '../modules/cache.mjs';

import { request } from '../modules/drop-server.mjs';

router.get('/', (req, res) => {
  res.ok('Wanyne API / Amethy');
});

/**
 * @desc GeoIP 위치 정보
 */
import geoip from 'geoipasn';
router.get('/geoip', (req, res) => {
  let target = req.client.ip;

  try {
    res.data(geoip(target));
  } catch (error) {
    res.error(error);
  }
});
router.get(
  '/geoip/:target',
  internal('network.geoip.target.get'),
  (req, res) => {
    let target = req.params.target;

    try {
      res.data(geoip(target));
    } catch (error) {
      res.error(error);
    }
  }
);

/**
 * @desc WHOIS 정보 (3일 캐싱) (Drop 사용)
 */
router.get(
  '/whois/:target',
  internal('network.whois.target.get'),
  (req, res) => {
    let target = req.params.target;

    (async () => {
      const cache = new Cache('api.network.whois/' + target.toLowerCase());
      await cache.pull();
      if (
        req.query.cache == 'false' ||
        cache.time < new Date().getTime() - 1000 * 86400 * 3
      ) {
        const value = await request('whois', { host: target });
        await cache.update(value);
        const result = cache.value;
        return result;
      } else {
        const result = cache.value;
        result.cached = cache.time;
        return result;
      }
    })()
      .then(res.data)
      .catch((error) => {
        if (error.message == 'default503') {
          res.message('default503', 503);
        } else {
          res.error(error);
        }
      });
  }
);

/**
 * @desc DNS 레코드
 */
import dns from '@wnynya/dns';
router.get('/dns/:target', internal('network.dns.target.get'), (req, res) => {
  let target = req.params.target;

  dns(target).then(res.data).catch(res.error);
});

/**
 * @desc 서브도메인 검색 결과 (30일 캐싱) (Drop 사용)
 */
router.get(
  '/subdomains/:target',
  internal('network.subdomains.target.get'),
  (req, res) => {
    let target = req.params.target;

    (async () => {
      const cache = new Cache('api.network.subdomains/' + target.toLowerCase());
      await cache.pull();
      if (
        req.query.cache == 'false' ||
        cache.time < new Date().getTime() - 1000 * 86400 * 30
      ) {
        const value = await request('subdomains', { host: target });
        await cache.update(value);
        const result = cache.value;
        return result;
      } else {
        const result = cache.value;
        result.cached = cache.time;
        return result;
      }
    })()
      .then(res.data)
      .catch((error) => {
        if (error.message == 'default503') {
          res.message('default503', 503);
        } else {
          res.error(error);
        }
      });
  }
);

/**
 * @desc ICMP 핑 (Drop 사용)
 */
router.get(
  '/ping/icmp/:target',
  internal('network.ping.icmp.target.get'),
  (req, res) => {
    let target = req.params.target;

    request('ping/icmp', { host: target })
      .then(res.data)
      .catch((error) => {
        if (error.type == 'ping/icmp') {
          res.data(error);
        } else if (error.message == 'default503') {
          res.message('default503', 503);
        } else {
          res.error(error);
        }
      });
  }
);

/**
 * @desc TCP 포트 스캔 (7일 캐싱) (Drop 사용)
 */
router.get(
  '/ping/tcp/scan/:target',
  internal('network.ping.tcp.scan.target.get'),
  (req, res) => {
    let target = req.params.target;
    target = target.replace(/:(.*)/, '');

    (async () => {
      const cache = new Cache(
        'api.network.ping.tcp.scan/' + target.toLowerCase()
      );
      await cache.pull();
      if (
        req.query.cache == 'false' ||
        cache.time < new Date().getTime() - 1000 * 86400 * 7
      ) {
        const value = await request('ping/tcp/scan', { host: target });
        await cache.update(value);
        const result = cache.value;
        return result;
      } else {
        const result = cache.value;
        result.cached = cache.time;
        return result;
      }
    })()
      .then(res.data)
      .catch((error) => {
        if (error.type == 'ping/tcp/scan') {
          res.data(error);
        } else if (error.message == 'default503') {
          res.message('default503', 503);
        } else {
          res.error(error);
        }
      });
  }
);

/**
 * @desc UDP 포트 스캔 (7일 캐싱) (Drop 사용)
 */
router.get(
  '/ping/udp/scan/:target',
  internal('network.ping.udp.scan.target.get'),
  (req, res) => {
    let target = req.params.target;
    target = target.replace(/:(.*)/, '');

    (async () => {
      const cache = new Cache(
        'api.network.ping.udp.scan/' + target.toLowerCase()
      );
      await cache.pull();
      if (
        req.query.cache == 'false' ||
        cache.time < new Date().getTime() - 1000 * 86400 * 7
      ) {
        const value = await request('ping/udp/scan', { host: target });
        await cache.update(value);
        const result = cache.value;
        return result;
      } else {
        const result = cache.value;
        result.cached = cache.time;
        return result;
      }
    })()
      .then(res.data)
      .catch((error) => {
        if (error.type == 'ping/udp/scan') {
          res.data(error);
        } else if (error.message == 'default503') {
          res.message('default503', 503);
        } else {
          res.error(error);
        }
      });
  }
);

export default router;
