import { JSONGetRequest, GetRequest, Request } from '@wnynya/request';

async function getUUID(eid = '') {
  var eida = eid.toLowerCase();
  eida = eida.replace(/-/g, '');
  if (
    eid.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)
  ) {
    return eida;
  } else if (eida.match(/[0-9a-f]{32}/)) {
    var neid = '';
    for (var i = 0; i < 32; i++) {
      neid += eida[i];
      if ([8, 12, 16, 20].includes(i + 1)) {
        neid += '-';
      }
    }
    return neid;
  } else {
    const res = await JSONGetRequest(
      'https://api.mojang.com/users/profiles/minecraft/' +
        eid +
        '?at=' +
        Date.now()
    );
    if (!res?.body.id) {
      throw 'default404';
    }
    var id = '';
    for (var i = 0; i < 32; i++) {
      id += res.body.id[i];
      if ([8, 12, 16, 20].includes(i + 1)) {
        id += '-';
      }
    }
    return id;
  }
}

async function getPlayerSkin(uuid) {
  const res1 = await JSONGetRequest(
    'https://sessionserver.mojang.com/session/minecraft/profile/' + uuid
  );
  const skinstr = Buffer.from(res1.body.properties[0].value, 'base64').toString(
    'utf8'
  );
  const skinobj = JSON.parse(skinstr);
  return new Request(skinobj.textures.SKIN.url);
}

export default {
  uuid: getUUID,
  skin: getPlayerSkin,
};
