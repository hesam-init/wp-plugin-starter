declare global {
  interface Window {
    wp?: Record<string, unknown>;
  }
}

/** Read `window.wp[name]`, failing loudly if the PHP side forgot the script dependency. */
export function wpGlobal<T>(name: string, handle: string): T {
  const value = window.wp?.[name];
  if (!value) {
    throw new Error(
      `window.wp.${name} is missing — enqueue the "${handle}" script as a dependency.`,
    );
  }
  return value as T;
}
