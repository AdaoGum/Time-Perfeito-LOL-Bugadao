import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue()
  ],
  // IMPORTANTE: Coloque exatamente o nome do seu repositório aqui entre as barras
  base: '/Time-Perfeito-LOL-Bugadao/', 
})