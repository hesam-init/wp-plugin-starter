<?php
/**
 * Loads Vite assets: dev server (HMR) when a `hot` file exists, otherwise the
 * production build described by .vite/manifest.json.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Support;

defined( 'ABSPATH' ) || exit;

/**
 * Minimal Vite ↔ WordPress bridge.
 *
 * The Vite config writes `<dist>/hot` (containing the dev-server URL) while
 * `vite` runs and removes it on exit. `vite build` empties dist/, so a stale
 * hot file can never survive a production build.
 */
final class Vite {

	/**
	 * Script handles that must be printed as type="module".
	 *
	 * @var array<string, true>
	 */
	private array $module_handles = array();

	/**
	 * Parsed manifest cache.
	 *
	 * @var array<string, array<string, mixed>>|null
	 */
	private ?array $manifest = null;

	/**
	 * Constructor.
	 *
	 * @param string $dist_dir Absolute path to the build dir (trailing slash).
	 * @param string $dist_url Public URL of the build dir (trailing slash).
	 * @param string $entry    Entry point, relative to the Vite root.
	 */
	public function __construct(
		private string $dist_dir,
		private string $dist_url,
		private string $entry = 'src/main.tsx'
	) {
		add_filter( 'wp_script_attributes', array( $this, 'add_module_type' ) );
	}

	/**
	 * Dev server URL, or null when running from the production build.
	 */
	public function dev_server_url(): ?string {
		$hot = $this->dist_dir . 'hot';
		if ( ! is_readable( $hot ) ) {
			return null;
		}
		$url = trim( (string) file_get_contents( $hot ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local file.

		return '' === $url ? null : untrailingslashit( esc_url_raw( $url ) );
	}

	/**
	 * Enqueue the entry point (JS + CSS). Returns false if assets are missing.
	 *
	 * @param string   $handle Script handle; inline data can be attached to it.
	 * @param string[] $deps   Script dependencies (e.g. WordPress packages used as globals).
	 *
	 * @phpstan-param list<string> $deps
	 */
	public function enqueue( string $handle, array $deps = array() ): bool {
		$dev = $this->dev_server_url();

		return null !== $dev ? $this->enqueue_dev( $handle, $dev, $deps ) : $this->enqueue_build( $handle, $deps );
	}

	/**
	 * Make our handles print as ES modules.
	 *
	 * @param array<string, mixed> $attributes Script tag attributes.
	 * @return array<string, mixed>
	 */
	public function add_module_type( array $attributes ): array {
		$id = isset( $attributes['id'] ) ? (string) $attributes['id'] : '';
		if ( '' !== $id && isset( $this->module_handles[ (string) preg_replace( '/-js$/', '', $id ) ] ) ) {
			$attributes['type'] = 'module';
		}
		return $attributes;
	}

	/**
	 * Dev: load @vite/client and the raw entry from the dev server.
	 *
	 * @param string   $handle Script handle.
	 * @param string   $dev    Dev server URL.
	 * @param string[] $deps   Script dependencies.
	 *
	 * @phpstan-param list<string> $deps
	 */
	private function enqueue_dev( string $handle, string $dev, array $deps ): bool {
		$client = $handle . '-vite-client';

		// phpcs:disable WordPress.WP.EnqueuedResourceParameters.MissingVersion -- dev server handles cache busting.
		wp_enqueue_script( $client, $dev . '/@vite/client', array(), null, false );
		wp_enqueue_script( $handle, $dev . '/' . $this->entry, array_merge( $deps, array( $client ) ), null, true );
		// phpcs:enable

		$this->module_handles[ $client ] = true;
		$this->module_handles[ $handle ] = true;

		// The React Refresh preamble is imported by src/main.tsx (@vitejs/plugin-react/preamble).

		return true;
	}

	/**
	 * Production: resolve hashed files from the manifest.
	 *
	 * @param string   $handle Script handle.
	 * @param string[] $deps   Script dependencies.
	 *
	 * @phpstan-param list<string> $deps
	 */
	private function enqueue_build( string $handle, array $deps ): bool {
		$manifest = $this->manifest();
		$chunk    = $manifest[ $this->entry ] ?? null;

		if ( ! is_array( $chunk ) || empty( $chunk['file'] ) ) {
			return false;
		}

		// Hashed filenames → no version query string needed.
		// phpcs:disable WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_enqueue_script( $handle, $this->dist_url . $chunk['file'], $deps, null, true );
		$this->module_handles[ $handle ] = true;

		foreach ( $this->collect_css( $this->entry ) as $i => $css ) {
			wp_enqueue_style( $handle . '-' . $i, $this->dist_url . $css, array(), null );
		}
		// phpcs:enable

		// Preload shared chunks (vendor, runtime) so the browser fetches them in parallel.
		$preload = array();
		foreach ( (array) ( $chunk['imports'] ?? array() ) as $import ) {
			$file = $manifest[ (string) $import ]['file'] ?? null;
			if ( is_string( $file ) ) {
				$preload[] = $this->dist_url . $file;
			}
		}
		add_action(
			'admin_head',
			static function () use ( $preload ): void {
				foreach ( $preload as $url ) {
					printf( '<link rel="modulepreload" href="%s" />' . "\n", esc_url( $url ) );
				}
			}
		);

		return true;
	}

	/**
	 * CSS for a chunk and all its static imports.
	 *
	 * @param string             $key  Manifest key.
	 * @param array<string,bool> $seen Visited keys.
	 * @return list<string>
	 */
	private function collect_css( string $key, array &$seen = array() ): array {
		if ( isset( $seen[ $key ] ) ) {
			return array();
		}
		$seen[ $key ] = true;
		$chunk        = $this->manifest()[ $key ] ?? array();
		$css          = array();

		foreach ( (array) ( $chunk['imports'] ?? array() ) as $import ) {
			$css = array_merge( $css, $this->collect_css( (string) $import, $seen ) );
		}
		foreach ( (array) ( $chunk['css'] ?? array() ) as $file ) {
			$css[] = (string) $file;
		}

		return array_values( array_unique( $css ) );
	}

	/**
	 * Read and cache the manifest.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	private function manifest(): array {
		if ( null !== $this->manifest ) {
			return $this->manifest;
		}

		$path           = $this->dist_dir . '.vite/manifest.json';
		$raw            = is_readable( $path ) ? file_get_contents( $path ) : false; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local file.
		$data           = false === $raw ? null : json_decode( $raw, true );
		$this->manifest = is_array( $data ) ? $data : array();

		return $this->manifest;
	}
}
