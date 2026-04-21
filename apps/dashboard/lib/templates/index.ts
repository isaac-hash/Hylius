export interface EnvField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'number';
  description?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface TemplateContext {
  appName: string;
  dbHost?: string; // container name — from managed DB after provisioning
  dbName?: string;
  dbUser?: string;
  dbPassword?: string;
  extraEnv?: Record<string, string>;
}

export interface TemplateDefinition {
  id: string; // e.g. 'wordpress'
  name: string; // 'WordPress'
  description: string;
  icon: string; // emoji or svg path
  category: 'cms' | 'analytics' | 'automation' | 'backend' | 'other' | 'framework' | 'monitoring';
  tags: string[];
  requiresDatabase: ('POSTGRES' | 'MYSQL' | 'REDIS')[]; // auto-provisioned
  defaultPort: number;
  envSchema: EnvField[]; // list of user-configurable fields shown in UI
  // Either a docker-compose generator OR a repository URL configuration
  generateCompose?: (ctx: TemplateContext) => string; // returns docker-compose YAML
  repository?: {
      url: string;
      branch?: string;
  };
  defaultEnv?: Record<string, string>;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'wordpress',
    name: 'WordPress',
    description: "The world's most popular website builder and CMS.",
    icon: '📝',
    category: 'cms',
    tags: ['blog', 'website', 'php'],
    requiresDatabase: ['MYSQL'],
    defaultPort: 80,
    envSchema: [
      {
        key: 'WORDPRESS_TITLE',
        label: 'Site Title',
        type: 'text',
        description: 'The main title for your WordPress site',
        defaultValue: 'My WordPress Site',
        required: true,
      },
      {
        key: 'WORDPRESS_ADMIN_USER',
        label: 'Admin Username',
        type: 'text',
        defaultValue: 'admin',
        required: true,
      },
      {
        key: 'WORDPRESS_ADMIN_PASSWORD',
        label: 'Admin Password',
        type: 'password',
        required: true,
      },
      {
        key: 'WORDPRESS_ADMIN_EMAIL',
        label: 'Admin Email',
        type: 'email',
        required: true,
      },
    ],
    generateCompose: (ctx) => {
      // NOTE: Hylius will run this stack. The top-level port 80 will be mapped dynamically by Hylius.
      // We expose 80 internally and let Hylius handle routing to the final output container.
      return `version: '3.8'

services:
  wordpress:
    image: wordpress:latest
    restart: always
    ports:
      - "\${APP_PORT}:80"
    environment:
      WORDPRESS_DB_HOST: ${ctx.dbHost}:3306
      WORDPRESS_DB_USER: ${ctx.dbUser}
      WORDPRESS_DB_PASSWORD: ${ctx.dbPassword}
      WORDPRESS_DB_NAME: ${ctx.dbName}
    volumes:
      - wp_data:/var/www/html

volumes:
  wp_data:
`;
    },
  },
  {
    id: 'ghost',
    name: 'Ghost',
    description: 'A powerful app for new-media creators to publish, share, and grow a business around their content.',
    icon: '👻',
    category: 'cms',
    tags: ['blog', 'newsletter'],
    requiresDatabase: ['MYSQL'],
    defaultPort: 2368,
    envSchema: [],
    generateCompose: (ctx) => {
      return `version: '3.8'

services:
  ghost:
    image: ghost:latest
    restart: always
    ports:
      - "\${APP_PORT}:2368"
    environment:
      database__client: mysql
      database__connection__host: ${ctx.dbHost}
      database__connection__user: ${ctx.dbUser}
      database__connection__password: ${ctx.dbPassword}
      database__connection__database: ${ctx.dbName}
      url: \${APP_URL}
    volumes:
      - ghost_data:/var/lib/ghost/content

volumes:
  ghost_data:
`;
    },
  },
  {
    id: 'n8n',
    name: 'n8n',
    description: 'Free and open fair-code licensed node based Workflow Automation Tool.',
    icon: '⚙️',
    category: 'automation',
    tags: ['workflow', 'automation'],
    requiresDatabase: ['POSTGRES'],
    defaultPort: 5678,
    envSchema: [],
    generateCompose: (ctx) => {
      return `version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    restart: always
    ports:
      - "\${APP_PORT}:5678"
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=${ctx.dbHost}
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=${ctx.dbName}
      - DB_POSTGRESDB_USER=${ctx.dbUser}
      - DB_POSTGRESDB_PASSWORD=${ctx.dbPassword}
      - N8N_HOST=\${APP_URL}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=\${APP_URL}/
      - GENERIC_TIMEZONE=UTC
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
`;
    },
  },
  {
    id: 'laravel-blade',
    name: 'Laravel Starter',
    description: 'Clean Laravel 11 application with Blade templating. No frontend build step — ready to build your backend.',
    icon: '🔴',
    category: 'framework',
    tags: ['laravel', 'php', 'blade'],
    requiresDatabase: ['POSTGRES'],
    defaultPort: 80,
    envSchema: [
      {
        key: 'APP_NAME',
        label: 'App Name',
        type: 'text',
        defaultValue: 'Laravel',
        required: true,
      },
      {
        key: 'APP_ENV',
        label: 'Environment',
        type: 'text',
        defaultValue: 'production',
        required: true,
      },
      {
        key: 'APP_DEBUG',
        label: 'Debug Mode',
        type: 'text',
        defaultValue: 'false',
        description: 'Set to true only during development',
      },
      {
        key: 'APP_KEY',
        label: 'App Key',
        type: 'password',
        description: 'Laravel encryption key. Generate with: php artisan key:generate --show',
        required: true,
      },
      {
        key: 'APP_URL',
        label: 'App URL',
        type: 'text',
        description: 'The full URL of your application (e.g. https://myapp.example.com)',
        defaultValue: 'http://localhost',
      },
    ],
    repository: {
      url: 'https://github.com/isaac-hash/laravel.git',
      branch: '13.x',
    },
  },
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    description: 'A self-hosted monitoring tool for tracking uptime of websites, APIs, and services with beautiful dashboards.',
    icon: '📡',
    category: 'monitoring',
    tags: ['monitoring', 'uptime', 'alerts'],
    requiresDatabase: [],
    defaultPort: 3001,
    envSchema: [],
    generateCompose: (_ctx) => {
      return `version: '3.8'

services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: always
    ports:
      - "\${APP_PORT}:3001"
    volumes:
      - uptime_kuma_data:/app/data

volumes:
  uptime_kuma_data:
`;
    },
  },
  {
    id: 'directus',
    name: 'Directus',
    description: 'An open-source headless CMS and data platform that wraps any SQL database with a real-time API and admin app.',
    icon: '🗄️',
    category: 'cms',
    tags: ['cms', 'headless', 'api'],
    requiresDatabase: ['POSTGRES'],
    defaultPort: 8055,
    envSchema: [
      {
        key: 'ADMIN_EMAIL',
        label: 'Admin Email',
        type: 'email',
        required: true,
        description: 'Email address for the initial admin account',
      },
      {
        key: 'ADMIN_PASSWORD',
        label: 'Admin Password',
        type: 'password',
        required: true,
        description: 'Password for the initial admin account (min 8 characters)',
      },
    ],
    generateCompose: (ctx) => {
      // Generate random secrets for Directus security
      const secret = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const adminEmail = ctx.extraEnv?.ADMIN_EMAIL || 'admin@example.com';
      const adminPassword = ctx.extraEnv?.ADMIN_PASSWORD || 'changeme123';

      return `version: '3.8'

services:
  directus:
    image: directus/directus:latest
    restart: always
    ports:
      - "\${APP_PORT}:8055"
    environment:
      SECRET: "${secret}"
      DB_CLIENT: "pg"
      DB_HOST: "${ctx.dbHost}"
      DB_PORT: "5432"
      DB_DATABASE: "${ctx.dbName}"
      DB_USER: "${ctx.dbUser}"
      DB_PASSWORD: "${ctx.dbPassword}"
      ADMIN_EMAIL: "${adminEmail}"
      ADMIN_PASSWORD: "${adminPassword}"
      PUBLIC_URL: \${APP_URL}
    volumes:
      - directus_uploads:/directus/uploads
      - directus_extensions:/directus/extensions

volumes:
  directus_uploads:
  directus_extensions:
`;
    },
  },
  {
    id: 'pocketbase',
    name: 'PocketBase',
    description: 'Open source backend in a single file. Realtime database, auth, file storage and admin UI — all in one.',
    icon: '🗃️',
    category: 'backend',
    tags: ['backend', 'baas', 'database'],
    requiresDatabase: [],
    defaultPort: 8090,
    envSchema: [],
    generateCompose: (_ctx) => {
      return `version: '3.8'

services:
  pocketbase:
    image: ghcr.io/muchobien/pocketbase:latest
    restart: always
    ports:
      - "\${APP_PORT}:8090"
    volumes:
      - pb_data:/pb/pb_data
      - pb_public:/pb/pb_public

volumes:
  pb_data:
  pb_public:
`;
    },
  },
  {
    id: 'umami',
    name: 'Umami',
    description: 'Simple, fast, privacy-focused alternative to Google Analytics. Self-host your website analytics.',
    icon: '📊',
    category: 'analytics',
    tags: ['analytics', 'privacy', 'stats'],
    requiresDatabase: ['POSTGRES'],
    defaultPort: 3000,
    envSchema: [],
    generateCompose: (ctx) => {
      const appSecret = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

      return `version: '3.8'

services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    restart: always
    ports:
      - "\${APP_PORT}:3000"
    environment:
      DATABASE_URL: "postgresql://${ctx.dbUser}:${ctx.dbPassword}@${ctx.dbHost}:5432/${ctx.dbName}"
      APP_SECRET: "${appSecret}"

volumes: {}
`;
    },
  },
];
