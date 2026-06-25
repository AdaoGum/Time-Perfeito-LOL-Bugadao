<template>
  <svg :viewBox="viewBox" class="h-auto w-full select-none">
    <!-- Anéis de referência (grade) -->
    <polygon
      v-for="(ring, r) in rings"
      :key="'ring' + r"
      :points="ring"
      fill="none"
      stroke="#1e293b"
      stroke-width="1"
    />

    <!-- Eixos -->
    <line
      v-for="(p, i) in axisEndpoints"
      :key="'axis' + i"
      :x1="center"
      :y1="center"
      :x2="p.x"
      :y2="p.y"
      stroke="#1e293b"
      stroke-width="1"
    />

    <!-- Área dos dados -->
    <polygon :points="dataPolygon" :fill="`${color}2e`" :stroke="color" stroke-width="2" stroke-linejoin="round" />

    <!-- Pontos -->
    <circle
      v-for="(p, i) in dataDots"
      :key="'dot' + i"
      :cx="p.x"
      :cy="p.y"
      r="2.5"
      :fill="color"
    />

    <!-- Rótulos -->
    <text
      v-for="(p, i) in labelPoints"
      :key="'lbl' + i"
      :x="p.x"
      :y="p.y"
      :text-anchor="p.anchor"
      dominant-baseline="middle"
      class="fill-slate-400"
      style="font-size: 9px; font-weight: 700"
    >
      {{ axes[i].label }}
    </text>
  </svg>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // [{ label: string, value: number(0..100) }]
  axes: { type: Array, default: () => [] },
  size: { type: Number, default: 260 },
  color: { type: String, default: '#f59e0b' }
});

// Padding fora da área do gráfico para os rótulos não serem cortados.
// O viewBox é expandido lateral/verticalmente; o SVG escala junto (w-full).
const PAD_X = 60;
const PAD_Y = 24;

const center = computed(() => props.size / 2);
const radius = computed(() => props.size / 2 - 8); // gráfico ocupa quase todo o size; rótulos ficam no padding
const viewBox = computed(() => `${-PAD_X} ${-PAD_Y} ${props.size + PAD_X * 2} ${props.size + PAD_Y * 2}`);

const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, props.axes.length);

const pointAt = (valuePct, i) => {
  const r = radius.value * (Math.max(0, Math.min(100, valuePct)) / 100);
  const ang = angleFor(i);
  return {
    x: center.value + r * Math.cos(ang),
    y: center.value + r * Math.sin(ang)
  };
};

const toPoints = (arr) => arr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

// 4 anéis: 25/50/75/100%
const rings = computed(() =>
  [25, 50, 75, 100].map((level) => toPoints(props.axes.map((_, i) => pointAt(level, i))))
);

const axisEndpoints = computed(() => props.axes.map((_, i) => pointAt(100, i)));

const dataDots = computed(() => props.axes.map((a, i) => pointAt(Number(a.value) || 0, i)));

const dataPolygon = computed(() => toPoints(dataDots.value));

const labelPoints = computed(() =>
  props.axes.map((_, i) => {
    const ang = angleFor(i);
    const r = radius.value + 14;
    const x = center.value + r * Math.cos(ang);
    const y = center.value + r * Math.sin(ang);
    const cos = Math.cos(ang);
    const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
    return { x, y, anchor };
  })
);
</script>
