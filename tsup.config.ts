import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        jsonschema: 'src/jsonschema.ts',
    },
    format: ['esm', 'cjs'],
    dts: { entry: ['src/index.ts', 'src/jsonschema.ts'] },
    splitting: true,
    clean: true,
})
