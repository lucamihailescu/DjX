"use client";

import { useEffect, useRef } from "react";
import { IconX } from "@tabler/icons-react";

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Glowing green→cyan blob that wobbles with FBM noise and pulses with a beat.
// No real audio — uBeat/uEnergy are driven by a synthetic tempo in JS.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uBeat;
uniform float uEnergy;

float hash(vec2 p){ p = fract(p*vec2(123.34,345.45)); p += dot(p,p+34.345); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p*=2.0; a*=0.5; }
  return v;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float ang = atan(uv.y, uv.x);
  float rad = length(uv);
  float t = uTime * 0.25;

  float wob = fbm(vec2(cos(ang), sin(ang)) * 1.6 + t);
  float base = 0.30 + 0.10*uEnergy;
  float R = base + 0.07*wob + 0.06*uBeat;

  float edge = smoothstep(R + 0.02, R - 0.07, rad);
  float glow = exp(-3.2 * max(rad - R, 0.0)) * (0.5 + 0.9*uBeat);

  float n = fbm(uv*2.0 + t*0.8);
  vec3 green = vec3(0.114, 0.725, 0.329);
  vec3 cyan  = vec3(0.133, 0.827, 0.937);
  vec3 col = mix(green, cyan, 0.5 + 0.5*sin(n*4.0 + uTime*0.5 + ang));

  float inner = smoothstep(R, 0.0, rad);
  vec3 color = col * (0.25 + 1.3*inner) * edge;
  color += col * glow * 0.7;

  float vig = smoothstep(1.25, 0.15, rad);
  color = max(color, vec3(0.015, 0.015, 0.02));
  color *= mix(0.65, 1.0, vig);

  gl_FragColor = vec4(color, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("[DjX visualizer] shader error:", gl.getShaderInfoLog(sh));
  }
  return sh;
}

export function Visualizer({
  open,
  onClose,
  title,
  subtitle,
  image,
  playing,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  image?: string;
  playing: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true });
    if (!gl) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[DjX visualizer] link error:", gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uBeat = gl.getUniformLocation(program, "uBeat");
    const uEnergy = gl.getUniformLocation(program, "uEnergy");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const start = performance.now();
    let energy = 0;
    const BPM = 120;
    const beatInterval = 60 / BPM;

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      // Synthetic beat: sharp pulse each beat, softened, gated by play state.
      const phase = (t % beatInterval) / beatInterval;
      const target = playingRef.current ? 1 : 0;
      energy += (target - energy) * 0.05;
      const beat = Math.pow(1 - phase, 3) * (0.35 + 0.65 * energy);

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uBeat, beat);
      gl.uniform1f(uEnergy, energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-neutral-200 backdrop-blur transition hover:bg-black/60 hover:text-white"
        aria-label="Close visualizer"
      >
        <IconX size={20} />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-4 bg-gradient-to-t from-black/70 to-transparent p-6 pb-28">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-16 w-16 rounded-lg object-cover shadow-2xl"
          />
        )}
        <div className="min-w-0">
          <div className="truncate text-2xl font-bold text-white drop-shadow">
            {title}
          </div>
          <div className="truncate text-sm text-neutral-300">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}
