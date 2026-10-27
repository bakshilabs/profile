// Minimal glTF 2.0 binary writer: named nodes, each with one mesh of several primitives (positions, normals, uint32 indices, material).
import fs from 'node:fs';

export function writeGLB(file, { materials, nodes, extras = {} }) {
  // nodes: [{ name, primitives: [{ positions: Float32Array, normals: Float32Array, indices: Uint32Array, material: index }] }]
  const chunks = []; let offset = 0;
  const bufferViews = [], accessors = [], meshes = [], gltfNodes = [];
  const addView = (arr, target) => {
    const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target }); chunks.push(buf); offset += buf.length; return bufferViews.length - 1;
  };
  for (const node of nodes) {
    const prims = [];
    for (const p of node.primitives) {
      if (!p.indices.length) continue;
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p.positions[i + k]); mx[k] = Math.max(mx[k], p.positions[i + k]); }
      const vPos = addView(p.positions, 34962), vNor = addView(p.normals, 34962), vIdx = addView(p.indices, 34963);
      accessors.push({ bufferView: vPos, componentType: 5126, count: p.positions.length / 3, type: 'VEC3', min: mn, max: mx }); const aPos = accessors.length - 1;
      accessors.push({ bufferView: vNor, componentType: 5126, count: p.normals.length / 3, type: 'VEC3' }); const aNor = accessors.length - 1;
      accessors.push({ bufferView: vIdx, componentType: 5125, count: p.indices.length, type: 'SCALAR' }); const aIdx = accessors.length - 1;
      prims.push({ attributes: { POSITION: aPos, NORMAL: aNor }, indices: aIdx, material: p.material, mode: 4 });
    }
    if (!prims.length) continue;
    meshes.push({ name: node.name, primitives: prims });
    gltfNodes.push({ name: node.name, mesh: meshes.length - 1, ...(node.extras ? { extras: node.extras } : {}) });
  }
  const gltf = {
    asset: { version: '2.0', generator: 'populous twin build_context.mjs', extras },
    scene: 0, scenes: [{ nodes: gltfNodes.map((_, i) => i) }], nodes: gltfNodes, meshes, materials, accessors, bufferViews,
    buffers: [{ byteLength: offset }],
  };
  let json = Buffer.from(JSON.stringify(gltf)); const jpad = (4 - (json.length % 4)) % 4; json = Buffer.concat([json, Buffer.alloc(jpad, 0x20)]);
  const bin = Buffer.concat(chunks); const bpad = (4 - (bin.length % 4)) % 4; const binP = Buffer.concat([bin, Buffer.alloc(bpad)]);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + binP.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binP.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([header, jh, json, bh, binP]));
  return { bytes: 12 + 8 + json.length + 8 + binP.length, meshes: meshes.length };
}
