import { defineConfig } from 'vite'
import { resolve } from 'path'

export default {
    root: 'src',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
                umaDaily: resolve(__dirname, 'src/uma.html'),
                supportDaily: resolve(__dirname, 'src/support.html'),
                skillDaily: resolve(__dirname, 'src/skill.html')
            },
        }
    },
    publicDir: '../public'
}
