import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
    globalIgnores(['.wrangler', '.agents', '.claude']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            globals: globals.serviceworker,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['test/**/*.mjs'],
        extends: [js.configs.recommended],
        languageOptions: { globals: globals.node },
    },
])
