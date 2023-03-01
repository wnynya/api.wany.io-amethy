import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rep = fs.readFileSync(path.resolve(__dirname, './maven-rep.txt'));
const dep = fs.readFileSync(path.resolve(__dirname, './maven-dep.txt'));
const prj = fs.readFileSync(path.resolve(__dirname, './maven-prj.txt'));

function getRep(data) {
  let str = rep.toString();
  str = str.replace(/\${protocol}/g, data.protocol);
  str = str.replace(/\${host}/g, data.host);
  str = str.replace(/\${path}/g, data.path);
  return str;
}

function getDep(data) {
  let str = dep.toString();
  str = str.replace(/\${protocol}/g, data.protocol);
  str = str.replace(/\${host}/g, data.host);
  str = str.replace(/\${path}/g, data.path);
  str = str.replace(/\${groupId}/g, data.groupId);
  str = str.replace(/\${artifactId}/g, data.artifactId);
  str = str.replace(/\${version}/g, data.version);
  return str;
}

function getPrj(data) {
  let str = prj.toString();
  str = str.replace(/\${groupId}/g, data.groupId);
  str = str.replace(/\${artifactId}/g, data.artifactId);
  str = str.replace(/\${version}/g, data.version);
  returnprj;
}

export default {
  getRep: getRep,
  getDep: getDep,
  getPrj: getPrj,
};
