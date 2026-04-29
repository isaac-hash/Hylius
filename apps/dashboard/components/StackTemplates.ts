export const STACK_TEMPLATES = [
  {
    id: 'nextjs-api-postgres',
    label: 'Next.js + API + Postgres',
    icon: '⚡',
    services: [
      { name: 'web', role: 'frontend', deployStrategy: 'dagger', branch: 'main' },
      { name: 'api', role: 'backend', deployStrategy: 'dagger', branch: 'main' },
    ],
    databases: [
      { name: 'db', engine: 'POSTGRES', version: '16' },
    ],
  },
  {
    id: 'mern',
    label: 'MERN Stack',
    icon: '🟢',
    services: [
      { name: 'client', role: 'frontend', deployStrategy: 'dagger', branch: 'main' },
      { name: 'server', role: 'backend', deployStrategy: 'dagger', branch: 'main' },
    ],
    databases: [
      { name: 'db', engine: 'MYSQL', version: '8' },
    ],
  },
  {
    id: 'django-redis',
    label: 'Django + Redis',
    icon: '🐍',
    services: [
      { name: 'app', role: 'backend', deployStrategy: 'auto', branch: 'main' },
    ],
    databases: [
      { name: 'cache', engine: 'REDIS', version: '7' },
    ],
  },
  { id: 'blank', label: 'Blank Stack', icon: '📦', services: [], databases: [] },
];
