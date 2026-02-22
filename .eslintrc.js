module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    // 에러 레벨
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // 봇이므로 console.log 허용
    'no-undef': 'error',
    
    // 코드 스타일
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'indent': ['warn', 2],
    'comma-dangle': ['warn', 'always-multiline'],
    
    // 베스트 프랙티스
    'no-var': 'error',
    'prefer-const': 'warn',
    'eqeqeq': ['error', 'always'],
    'no-throw-literal': 'error',
    
    // 비동기 처리
    'require-await': 'warn',
    'no-return-await': 'warn',
  },
};
