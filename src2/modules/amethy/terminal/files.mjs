import Crypto from '@wnynya/crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const datastorage = '/home/wnynya/io.wany.api-amethy/data/terminal/files';

fs.readdirSync(datastorage).forEach((file) => {
  fs.unlinkSync(path.join(datastorage, file));
});

async function upload(req, res) {
  const id = Crypto.uid();

  return new Promise((resolve, reject) => {
    multer({ storage: multer.memoryStorage() }).single('file')(
      req,
      res,
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!req.file) {
          reject('default400');
          return;
        }
        fs.writeFileSync(datastorage + '/' + id, req.file.buffer);

        resolve(id);
      }
    );
  });
}

export { upload };

async function getPath(id) {
  const path = datastorage + '/' + id;

  if (!fs.existsSync(path)) {
    throw new Error('file404');
  }

  return path;
}

async function unlink(id) {
  const path = datastorage + '/' + id;

  if (!fs.existsSync(path)) {
    throw new Error('file404');
  }

  fs.unlinkSync(path);
}

export default {
  upload: upload,
  path: getPath,
  delete: unlink,
};
