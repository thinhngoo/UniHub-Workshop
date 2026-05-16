export function encodeDatabaseUrl(raw: string): string {
  const url = raw.trim();
  const protoMatch = /^(postgres(?:ql)?:\/\/)/i.exec(url);
  if (!protoMatch) {
    return url;
  }

  const rest = url.slice(protoMatch[1].length);
  const atIdx = rest.lastIndexOf('@');
  if (atIdx === -1) {
    return url;
  }

  const userinfo = rest.slice(0, atIdx);
  const hostAndPath = rest.slice(atIdx + 1);
  const colonIdx = userinfo.indexOf(':');

  const user = colonIdx === -1 ? userinfo : userinfo.slice(0, colonIdx);
  const password = colonIdx === -1 ? '' : userinfo.slice(colonIdx + 1);

  const encUser = encodeURIComponent(safeDecodeURIComponent(user));
  const encPass = encodeURIComponent(safeDecodeURIComponent(password));

  const auth = colonIdx !== -1 ? `${encUser}:${encPass}` : encUser;

  return `${protoMatch[1]}${auth}@${hostAndPath}`;
}

function safeDecodeURIComponent(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
