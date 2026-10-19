import { supabase } from './supabaseConfig';

export const BUCKET = 'uploads';

const safeName = name => (name || 'file').replace(/[^\w.-]+/g, '_');

/** Upload a File/Blob and return { url, name, path }. */
export async function uploadFile(path, file) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, name: file.name || path.split('/').pop(), path };
}

const isBlob = v => typeof Blob !== 'undefined' && v instanceof Blob;

/**
 * Deep-copies `value`, uploading any File/Blob found along the way under
 * `prefix/` and replacing it with `{ url, name }` so the result is JSON-safe.
 */
export async function persistFiles(value, prefix) {
  if (isBlob(value)) {
    const name = value.name || `blob-${Date.now()}`;
    const stamp = Date.now().toString(36);
    const { url } = await uploadFile(`${prefix}/${stamp}-${safeName(name)}`, value);
    return { url, name };
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await persistFiles(v, prefix));
    return out;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await persistFiles(v, prefix);
    return out;
  }
  return value;
}

export { safeName };
