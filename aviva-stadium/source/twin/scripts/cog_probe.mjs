// Prints the structure of a remote COG (first IFD only). Usage: node cog_probe.mjs URL
const url = process.argv[2];
const r = await fetch(url, { headers: { Range: 'bytes=0-65535' } });
const buf = Buffer.from(await r.arrayBuffer());
console.log(r.status, buf.length, r.headers.get('content-range'));
const le = buf.toString('ascii', 0, 2) === 'II';
const magic = le ? buf.readUInt16LE(2) : buf.readUInt16BE(2);
console.log('little endian', le, 'magic', magic);
