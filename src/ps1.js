// Rendu « PlayStation 1 » :
//  - rendu dans une petite texture (240 lignes) puis agrandie sans filtrage
//  - sommets arrondis à la grille de pixels (le fameux tremblement des polygones)
//  - couleurs réduites à 15 bits avec un tramage ordonné (dithering Bayer)
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

export const INTERNAL_HEIGHT = 240;

const snapRes = { value: new THREE.Vector2(160, 120) };

function patchVertexSnap(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnapRes = snapRes;
    shader.vertexShader = 'uniform vec2 uSnapRes;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      if (gl_Position.w > 0.5) {
        vec4 snapped = gl_Position;
        snapped.xyz /= snapped.w;
        snapped.xy = floor(snapped.xy * uSnapRes + 0.5) / uSnapRes;
        snapped.xyz *= snapped.w;
        gl_Position = snapped;
      }`,
    );
  };
  material.customProgramCacheKey = () => 'ps1-snap';
  return material;
}

const matCache = new Map();

// Matériau plat à facettes, partagé par couleur.
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, patchVertexSnap(new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts })));
  }
  return matCache.get(key);
}

export function basicMat(params) {
  return patchVertexSnap(new THREE.MeshBasicMaterial(params));
}

export function lambertMat(params) {
  return patchVertexSnap(new THREE.MeshLambertMaterial({ flatShading: true, ...params }));
}

const postVertex = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const postFragment = `
uniform sampler2D tScene;
uniform vec2 uRes;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float d = bayer4(floor(vUv * uRes)) - 0.5;
  c += d / 24.0;
  c = floor(c * 31.0 + 0.5) / 31.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export class PS1Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.target = new THREE.WebGLRenderTarget(320, 240, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: this.target.texture }, uRes: { value: new THREE.Vector2(320, 240) } },
      vertexShader: postVertex,
      fragmentShader: postFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));
  }

  resize(camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const ih = INTERNAL_HEIGHT;
    const iw = Math.round(ih * (w / h));
    this.target.setSize(iw, ih);
    this.postMat.uniforms.uRes.value.set(iw, ih);
    snapRes.value.set(iw / 2, ih / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  render(scene, camera) {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
