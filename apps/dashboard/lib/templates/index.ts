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
  category: 'cms' | 'analytics' | 'automation' | 'backend' | 'other' | 'framework';
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
    tags: ['blog', 'newsletter', 'newsletter'],
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
    tags: ['workflow', 'automation', 'zapier-alternative'],
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
    id: 'laravel-inertia-react',
    name: 'Laravel React Starter',
    description: 'Laravel 11, React, Inertia, and Tailwind CSS starter kit provided by Laravel.',
    icon: '🚀',
    category: 'framework',
    tags: ['laravel', 'react', 'inertia', 'typescript'],
    requiresDatabase: ['POSTGRES'], // Default to standard Postgres, can also be MySQL
    defaultPort: 80,
    envSchema: [
      {
        key: 'APP_NAME',
        label: 'App Name',
        type: 'text',
        defaultValue: 'LaravelReactApp',
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
      }
    ],
    repository: {
      url: 'https://github.com/laravel/react-starter-kit.git',
      branch: 'main'
    }
  }
];
