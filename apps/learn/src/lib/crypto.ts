/* 门禁的密码学部分:浏览器里用输入的密码派生密钥,解 tools/build-learn-content.mjs 产出的密文。
 * 关键点——密码对了不一定能证明什么,但密码错了 AES-GCM 的校验标签一定解不开,
 * 所以「进来了」是真的进来了,不存在看一眼源码就能绕过的那条路。
 */

export interface Envelope {
  v: number;
  kdf: { name: string; hash: string; iterations: number };
  cipher: string;
  salt: string;
  iv: string;
  ct: string;
  builtAt: string;
  parts: string[];
  plainBytes: number;
  cipherBytes: number;
}

export interface Decrypted {
  builtAt: string;
  parts: Record<string, unknown>;
}

export class GateError extends Error {}

function b64ToBytes(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto {
  const s = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (!s) {
    throw new GateError(
      '这台设备没给浏览器加密能力(WebCrypto 不可用)。' +
        '它只在 https 或 http://127.0.0.1 下开放——本地预览请用 127.0.0.1,局域网 IP 会被当成不安全连接。'
    );
  }
  return s;
}

export async function fetchEnvelope(): Promise<Envelope> {
  let res: Response;
  try {
    res = await fetch(import.meta.env.BASE_URL + 'data/content.json', { cache: 'no-cache' });
  } catch (e) {
    throw new GateError('取不到加密内容:网络请求失败(' + String(e) + ')。检查是否在离线状态。');
  }
  if (!res.ok) {
    throw new GateError(
      '取不到加密内容:HTTP ' + res.status + ' ' + res.statusText + '。' +
        '线上必须有 /learn/data/content.json(由 npm run learn:data 生成并提交),缺它就是没跑过这一步。'
    );
  }
  const env = (await res.json()) as Envelope;
  if (!env || env.v !== 1 || !env.ct) throw new GateError('加密内容格式不认识:v=' + String(env && env.v) + ',字段 ct=' + String(env && env.ct ? '有' : '没有'));
  return env;
}

export async function unlock(password: string, env: Envelope): Promise<Decrypted> {
  const sub = subtle();
  const base = await sub.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await sub.deriveKey(
    { name: env.kdf.name, salt: b64ToBytes(env.salt), iterations: env.kdf.iterations, hash: env.kdf.hash },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  let plain: ArrayBuffer;
  try {
    plain = await sub.decrypt({ name: 'AES-GCM', iv: b64ToBytes(env.iv) }, key, b64ToBytes(env.ct));
  } catch {
    throw new GateError('密码不对。');
  }
  const text = new TextDecoder().decode(plain);
  let parsed: Decrypted;
  try {
    parsed = JSON.parse(text) as Decrypted;
  } catch (e) {
    throw new GateError('解开了但不是合法 JSON——密文与明文对不上,重跑一次 npm run learn:data。原始报错:' + String(e));
  }
  return parsed;
}
