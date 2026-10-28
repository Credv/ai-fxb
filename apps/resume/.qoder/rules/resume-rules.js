export default [
  {
    name: 'resume-react-rules',
    rules: [
      {
        id: 'component-naming',
        description: '组件文件名必须使用 PascalCase',
        pattern: 'src/components/*.tsx',
        check: 'filename[0] === filename[0].toUpperCase()',
      },
      {
        id: 'no-console-log',
        description: '禁止 console.log/warn/debug/info 残留',
        pattern: 'src/**/*.{ts,tsx}',
        check: '!/console\\.(log|warn|debug|info)\\(/.test(content)',
      },
      {
        id: 'no-any-type',
        description: '禁止使用 any 类型，请使用具体类型或 unknown',
        pattern: 'src/**/*.{ts,tsx}',
        check: '!/: any\\b/.test(content)',
      },
      {
        id: 'props-interface',
        description: '组件 Props 必须定义 TypeScript 接口',
        pattern: 'src/components/*.tsx',
        check: '/interface \\w+Props|type \\w+Props =/.test(content)',
      },
      {
        id: 'echarts-cleanup',
        description: 'ECharts 实例必须在组件卸载时 dispose',
        pattern: 'src/components/Dashboard.tsx',
        check: '/chart\\.dispose\\(\\)/.test(content)',
      },
    ],
  },
]
