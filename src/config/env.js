const requiredInAllEnvs = ['REACT_APP_SUPABASE_URL', 'REACT_APP_SUPABASE_ANON_KEY'];

function getEnv(name, fallback = '') {
    return process.env[name] ?? fallback;
}

function missingRequiredVars() {
    return requiredInAllEnvs.filter((name) => !getEnv(name).trim());
}

export const env = {
    appEnv: getEnv('NODE_ENV', 'development'),
    isProduction: getEnv('NODE_ENV') === 'production',
    supabaseUrl: getEnv('REACT_APP_SUPABASE_URL'),
    supabaseAnonKey: getEnv('REACT_APP_SUPABASE_ANON_KEY'),
    geoscapeApiKey: getEnv('REACT_APP_GEOSCAPE_API_KEY'),
};

const missing = missingRequiredVars();

if (missing.length > 0 && env.appEnv !== 'test') {
    throw new Error(
        `Missing required environment variables: ${missing.join(', ')}. Add them to your .env file.`
    );
}

/** Absolute URL inside this app, respecting the hosting sub-path (e.g. GitHub Pages). */
export function appUrl(path = '/') {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${window.location.origin}${base}${path.startsWith('/') ? path : `/${path}`}`;
}
