// Stage 1 - Object Representation
// Geometry factories, per-object representation builders, selection, and the Stage 1 detail panel

import { S, getEmissiveColor } from './pipeline_3d_state.js';

// GEOMETRY FACTORY (used by points / voxel / sweep as base approximation)
export function makeBaseGeo(def) {
  switch (def.geoType) {
    case 'tree':  return new THREE.ConeGeometry(0.55, 1.8, 8);
    case 'rock':  return new THREE.IcosahedronGeometry(0.55, 1);
    case 'cabin': return new THREE.BoxGeometry(1.2, 0.9, 1.2);
  }
}

export function disposeGroup(g) {
  g.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
}

// BREP PROP BUILDERS
function buildTreeMeshes(group, def, useLit, useGray) {
  function mat(color, grayColor, roughness = 0.85) {
    const c = useGray ? grayColor : color;
    return useLit
      ? new THREE.MeshStandardMaterial({ color: c, roughness, metalness: 0 })
      : new THREE.MeshBasicMaterial({ color: c });
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.7, 8), mat(0x4a2e00, 0x707070, 0.95));
  trunk.position.y = 0.35;
  trunk.castShadow = true;
  group.add(trunk);

  const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 8), mat(0x2d5a1b, 0x707070, 0.8));
  foliage.position.y = 0.7 + 0.75;
  foliage.castShadow = true;
  group.add(foliage);

  def.mesh = trunk;
}

function buildRockMesh(group, def, useLit, useGray) {
  const geo = new THREE.IcosahedronGeometry(0.52, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const noise = Math.sin(x * 5.3 + z * 3.7) * Math.cos(y * 4.1 + x * 2.9) * 0.07;
    const len = Math.sqrt(x * x + y * y + z * z);
    const f = (len + noise) / len;
    pos.setXYZ(i, x * f, y * f, z * f);
  }
  geo.computeVertexNormals();

  const rockColor = useGray ? 0x909090 : 0x7a7065;
  const mesh = new THREE.Mesh(geo, useLit
    ? new THREE.MeshStandardMaterial({ color: rockColor, roughness: 0.92, metalness: 0.05 })
    : new THREE.MeshBasicMaterial({ color: rockColor }));
  mesh.position.y = 0.3;
  mesh.castShadow = true;
  def.mesh = mesh;
  group.add(mesh);
}

function buildCabinMeshes(group, def, useLit, useGray) {
  function mat(color, grayColor, roughness = 0.9) {
    const c = useGray ? grayColor : color;
    return useLit
      ? new THREE.MeshStandardMaterial({ color: c, roughness, metalness: 0 })
      : new THREE.MeshBasicMaterial({ color: c });
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), mat(0x8b5e3c, 0x808080));
  body.position.y = 0.45;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.6, 4), mat(0x5c2a1a, 0x767676, 0.95));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.9 + 0.3;
  roof.castShadow = true;
  group.add(roof);

  def.mesh = body;
}

// REPRESENTATION BUILDER 
export function buildRepr(def) {
  if (def.reprGroup) {
    S.scene.remove(def.reprGroup);
    disposeGroup(def.reprGroup);
    def.reprGroup = null;
  }

  const group = new THREE.Group();
  group.position.copy(S.stages[1] ? def.worldPos : new THREE.Vector3(0, 0, 0));
  group.rotation.copy(S.stages[1] ? def.worldRot : new THREE.Euler(0, 0, 0));
  group.scale.copy(S.stages[1] ? def.worldScale : new THREE.Vector3(1, 1, 1));

  const useLit        = S.stages[2];
  const useGray       = !S.stages[2];
  const effectiveColor = useGray ? def.grayColor : def.color;

  function makeStdMat() {
    return useLit
      ? new THREE.MeshStandardMaterial({ color: effectiveColor, roughness: 0.6, metalness: 0.1 })
      : new THREE.MeshBasicMaterial({ color: effectiveColor });
  }

  switch (def.repr) {
    case 'brep': {
      if (def.geoType === 'tree')       buildTreeMeshes(group, def, useLit, useGray);
      else if (def.geoType === 'rock')  buildRockMesh(group, def, useLit, useGray);
      else if (def.geoType === 'cabin') buildCabinMeshes(group, def, useLit, useGray);

      break;
    }
    case 'points': {
      // Build into a temp group using the same composite builders as BRep so multi-part objects (trunk+foliage, body+roof) are fully sampled
      const tmpGroup = new THREE.Group();
      if (def.geoType === 'tree')       buildTreeMeshes(tmpGroup, def, false, useGray);
      else if (def.geoType === 'rock')  buildRockMesh(tmpGroup, def, false, useGray);
      else if (def.geoType === 'cabin') buildCabinMeshes(tmpGroup, def, false, useGray);

      const allPositions = [];
      tmpGroup.traverse(child => {
        if (!child.isMesh) return;
        child.updateMatrix();
        const pos = child.geometry.attributes.position;
        const tmp = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          tmp.fromBufferAttribute(pos, i).applyMatrix4(child.matrix);
          allPositions.push(tmp.x, tmp.y, tmp.z);
        }
      });

      const vertCount = allPositions.length / 3;
      const sampled = [];
      for (let i = 0; i < Math.min(def.pointDensity, vertCount); i++) {
        const idx = Math.floor(Math.random() * vertCount);
        sampled.push(allPositions[idx * 3], allPositions[idx * 3 + 1], allPositions[idx * 3 + 2]);
      }

      const ptGeo = new THREE.BufferGeometry();
      ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(sampled, 3));
      group.add(new THREE.Points(ptGeo,
        new THREE.PointsMaterial({ color: effectiveColor, size: def.pointSize, sizeAttenuation: true })));
      def.mesh = null;
      break;
    }
    case 'voxel': {
      // Build actual composite geometry so tree/cabin use all their parts
      const tmpGroup = new THREE.Group();
      if (def.geoType === 'tree')       buildTreeMeshes(tmpGroup, def, false, useGray);
      else if (def.geoType === 'rock')  buildRockMesh(tmpGroup, def, false, useGray);
      else if (def.geoType === 'cabin') buildCabinMeshes(tmpGroup, def, false, useGray);

      // Sample vertices + face centers from every mesh part in group-local space
      const samples = [];
      const _v = new THREE.Vector3();
      tmpGroup.traverse(child => {
        if (!child.isMesh) return;
        child.updateMatrix();
        const geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry;
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i += 3) {
          for (let j = 0; j < 3; j++) {
            _v.fromBufferAttribute(pos, i + j).applyMatrix4(child.matrix);
            samples.push(_v.clone());
          }
          _v.set(
            (pos.getX(i) + pos.getX(i+1) + pos.getX(i+2)) / 3,
            (pos.getY(i) + pos.getY(i+1) + pos.getY(i+2)) / 3,
            (pos.getZ(i) + pos.getZ(i+1) + pos.getZ(i+2)) / 3
          ).applyMatrix4(child.matrix);
          samples.push(_v.clone());
        }
      });

      const bbox = new THREE.Box3();
      samples.forEach(p => bbox.expandByPoint(p));

      const res = def.voxelRes;
      const sz = bbox.getSize(new THREE.Vector3());
      const dx = sz.x / res, dy = sz.y / res, dz = sz.z / res;
      // Expand the acceptance radius slightly beyond the exact half-cell so surface triangles crossing a cell boundary still activate that cell.
      const rx = dx * 0.55, ry = dy * 0.55, rz = dz * 0.55;

      for (let xi = 0; xi < res; xi++) {
        for (let yi = 0; yi < res; yi++) {
          for (let zi = 0; zi < res; zi++) {
            const cx = bbox.min.x + (xi + 0.5) * dx;
            const cy = bbox.min.y + (yi + 0.5) * dy;
            const cz = bbox.min.z + (zi + 0.5) * dz;
            const occupied = samples.some(p =>
              Math.abs(p.x - cx) <= rx &&
              Math.abs(p.y - cy) <= ry &&
              Math.abs(p.z - cz) <= rz
            );
            if (occupied) {
              const vc = new THREE.Mesh(new THREE.BoxGeometry(dx * 0.9, dy * 0.9, dz * 0.9), makeStdMat());
              vc.castShadow = true;
              vc.position.set(cx, cy, cz);
              group.add(vc);
            }
          }
        }
      }
      def.mesh = null;
      break;
    }
    case 'sweep': {
      // Cabin is blocked upstream. Tree and rock use per-object profiles
      const sweepAngle = THREE.MathUtils.degToRad(def.sweepAngle);

      function addSweep(pts, setAsMesh) {
        const m = new THREE.Mesh(
          new THREE.LatheGeometry(pts, 24, 0, sweepAngle),
          makeStdMat()
        );
        m.castShadow = true;
        if (setAsMesh) def.mesh = m;
        group.add(m);
      }

      if (def.geoType === 'tree') {
        // Trunk: closed tapered cylinder, cap points at x=0 close top and bottom
        addSweep([
          new THREE.Vector2(0,    0),    // bottom cap centre
          new THREE.Vector2(0.14, 0),   // bottom edge
          new THREE.Vector2(0.08, 0.7), // top edge
          new THREE.Vector2(0,    0.7), // top cap centre
        ], true);
        // Foliage: cone with closed base, apex at x=0 closes the top naturally
        addSweep([
          new THREE.Vector2(0,    0.7), // bottom cap centre
          new THREE.Vector2(0.55, 0.7), // base edge
          new THREE.Vector2(0,    2.2), // apex
        ], false);
      } else {
        // Rock: semicircle profile, radius 0.52, centered at y=0.3
        const pts = [];
        for (let i = 0; i <= 16; i++) {
          const a = Math.PI * (i / 16);
          pts.push(new THREE.Vector2(Math.sin(a) * 0.52, 0.3 - Math.cos(a) * 0.52));
        }
        addSweep(pts, true);
      }
      break;
    }
  }

  group.userData.defRef = def;
  def.reprGroup = group;
  S.scene.add(group);
  return group;
}

// SELECTION
export function selectObject(def) {
  clearSelection();
  if (!def) return;
  S.selectedObj = def;
  if (def.reprGroup) {
    const toOutline = [];
    def.reprGroup.traverse(obj => {
      if (!obj.isMesh) return;
      if (obj.material?.emissive) {
        obj.material.emissive.setHex(getEmissiveColor());
      } else {
        toOutline.push(obj);
      }
    });
    // Stages 1-2 use MeshBasicMaterial (no emissive), so add an edge outline instead
    toOutline.forEach(mesh => {
      mesh.updateMatrix();
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: 0x4da6ff })
      );
      outline.matrix.copy(mesh.matrix);
      outline.matrixAutoUpdate = false;
      outline.userData.isSelectionHighlight = true;
      def.reprGroup.add(outline);
    });
  }
  S.updateDetailPanels?.();
}

export function clearSelection() {
  if (S.selectedObj?.reprGroup) {
    const toRemove = [];
    S.selectedObj.reprGroup.traverse(obj => {
      if (obj.isMesh && obj.material?.emissive)
        obj.material.emissive.set(0x000000);
      if (obj.userData.isSelectionHighlight)
        toRemove.push(obj);
    });
    toRemove.forEach(obj => S.selectedObj.reprGroup.remove(obj));
  }
  S.selectedObj = null;
  S.updateDetailPanels?.();
}

// DETAIL PANEL 
export function buildDetail0() {
  document.getElementById('detail-0').innerHTML = `
    <div class="detail-section">
      <div class="notice-box">Flat shading, grayscale — lighting and color are introduced in Stage 3.</div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Selected Object</div>
      <select id="s1-obj-dropdown" class="obj-select">
        <option value="">— None —</option>
        ${S.objectDefs.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}
      </select>
    </div>
    <div class="detail-section">
      <div class="detail-label">Representation</div>
      <div class="btn-row">
        <button class="btn repr-btn active" data-repr="brep">B-Rep</button>
        <button class="btn repr-btn" data-repr="points">Points</button>
        <button class="btn repr-btn" data-repr="voxel">Voxels</button>
        <button class="btn repr-btn" data-repr="sweep">Sweep</button>
      </div>
      <div id="repr-warn" class="warn-text" style="display:none"></div>
    </div>
    <div id="repr-controls-brep" class="detail-section">
      <div class="detail-label">Vertices</div>
      <div id="vertex-list">Select an object</div>
    </div>
    <div id="repr-controls-points" class="detail-section" style="display:none">
      <div class="slider-row"><label>Size</label><input type="range" id="pt-size" min="0.01" max="0.3" step="0.01" value="0.05"><span class="slider-val" id="pt-size-val">0.05</span></div>
      <div class="slider-row"><label>Count</label><input type="range" id="pt-density" min="50" max="500" step="10" value="200"><span class="slider-val" id="pt-density-val">200</span></div>
      <div class="detail-label">Point count: <span id="pt-count">0</span></div>
    </div>
    <div id="repr-controls-voxel" class="detail-section" style="display:none">
      <div class="slider-row"><label>Res</label><input type="range" id="vx-res" min="3" max="10" step="1" value="5"><span class="slider-val" id="vx-res-val">5</span></div>
      <div class="detail-label">Voxel count: <span id="vx-count">0</span></div>
    </div>
    <div id="repr-controls-sweep" class="detail-section" style="display:none">
      <div class="slider-row"><label>Ang</label><input type="range" id="sw-angle" min="0" max="360" step="1" value="360"><span class="slider-val" id="sw-angle-val">360°</span></div>
    </div>
  `;

  document.getElementById('s1-obj-dropdown').addEventListener('change', function() {
    const def = S.objectDefs.find(d => d.name === this.value);
    if (def) selectObject(def); else clearSelection();
  });

  document.querySelectorAll('#detail-0 [data-repr]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!S.selectedObj) return;
      const repr = btn.dataset.repr;
      if (repr === 'sweep' && S.selectedObj.geoType === 'cabin') {
        document.getElementById('repr-warn').style.display = 'block';
        document.getElementById('repr-warn').textContent = 'Sweep/revolution: cabin is not rotationally symmetric';
        return;
      }
      document.getElementById('repr-warn').style.display = 'none';
      S.selectedObj.repr = repr;
      buildRepr(S.selectedObj);
      selectObject(S.selectedObj);
      updateDetail0();
    });
  });

  document.getElementById('pt-size').addEventListener('input', function() {
    if (!S.selectedObj) return;
    S.selectedObj.pointSize = parseFloat(this.value);
    document.getElementById('pt-size-val').textContent = this.value;
    buildRepr(S.selectedObj); selectObject(S.selectedObj);
  });

  document.getElementById('pt-density').addEventListener('input', function() {
    if (!S.selectedObj) return;
    S.selectedObj.pointDensity = parseInt(this.value);
    document.getElementById('pt-density-val').textContent = this.value;
    buildRepr(S.selectedObj); selectObject(S.selectedObj);
  });

  document.getElementById('vx-res').addEventListener('input', function() {
    if (!S.selectedObj) return;
    S.selectedObj.voxelRes = parseInt(this.value);
    document.getElementById('vx-res-val').textContent = this.value;
    buildRepr(S.selectedObj); selectObject(S.selectedObj);
    document.getElementById('vx-count').textContent = Math.pow(S.selectedObj.voxelRes, 3);
  });

  document.getElementById('sw-angle').addEventListener('input', function() {
    if (!S.selectedObj) return;
    S.selectedObj.sweepAngle = parseInt(this.value);
    document.getElementById('sw-angle-val').textContent = this.value + '°';
    buildRepr(S.selectedObj); selectObject(S.selectedObj);
  });
}

export function updateDetail0() {
  const dropdown = document.getElementById('s1-obj-dropdown');
  if (!dropdown) return;
  dropdown.value = S.selectedObj ? S.selectedObj.name : '';
  if (!S.selectedObj) return;

  document.querySelectorAll('[data-repr]').forEach(b => {
    b.classList.toggle('active', b.dataset.repr === S.selectedObj.repr);
  });
  ['brep', 'points', 'voxel', 'sweep'].forEach(r => {
    const el = document.getElementById(`repr-controls-${r}`);
    if (el) el.style.display = S.selectedObj.repr === r ? '' : 'none';
  });

  if (S.selectedObj.repr === 'brep' && S.selectedObj.mesh) {
    const pos = S.selectedObj.mesh.geometry.attributes.position;
    let html = '';
    const limit = Math.min(pos.count, 24);
    for (let i = 0; i < limit; i++)
      html += `v${i}: [${pos.getX(i).toFixed(2)}, ${pos.getY(i).toFixed(2)}, ${pos.getZ(i).toFixed(2)}]<br>`;
    if (pos.count > 24) html += `... ${pos.count - 24} more`;
    document.getElementById('vertex-list').innerHTML = html;
  }
  if (S.selectedObj.repr === 'points') {
    document.getElementById('pt-count').textContent = S.selectedObj.pointDensity;
    document.getElementById('pt-size').value = S.selectedObj.pointSize;
    document.getElementById('pt-density').value = S.selectedObj.pointDensity;
  }
  if (S.selectedObj.repr === 'voxel') {
    document.getElementById('vx-count').textContent = Math.pow(S.selectedObj.voxelRes, 3);
    document.getElementById('vx-res').value = S.selectedObj.voxelRes;
  }
  if (S.selectedObj.repr === 'sweep')
    document.getElementById('sw-angle').value = S.selectedObj.sweepAngle;
}
