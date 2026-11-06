<?php
/**
 * Collects environment information for the Status screen.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Status;

use WpPluginStarter\Database\Installer;
use WpPluginStarter\Items\ItemRepository;
use WpPluginStarter\Support\Vite;

defined( 'ABSPATH' ) || exit;

// The `wordpress` key below is a JSON property name, not a misspelling.
// phpcs:disable WordPress.WP.CapitalPDangit.MisspelledInComment
/**
 * Builds the status report served by GET /status. The shape must match
 * StatusController::get_item_schema() and admin-client/src/api/schemas.ts.
 *
 * Deliberately exposes no absolute filesystem paths or secrets.
 *
 * @phpstan-type Requirement array{required: string, ok: bool}
 * @phpstan-type Report array{
 *     plugin: array{version: string, dbVersion: string, dbVersionInstalled: string|null, assetMode: string, itemsTable: array{exists: bool, rows: int}},
 *     wordpress: array{version: string, requirement: Requirement, siteUrl: string, homeUrl: string, multisite: bool, locale: string, timezone: string, environment: string, debug: bool, memoryLimit: string, permalinks: string, theme: array{name: string, version: string}, activePlugins: int, cronDisabled: bool},
 *     server: array{phpVersion: string, requirement: Requirement, sapi: string, software: string, memoryLimit: string, maxExecutionTime: string, uploadMaxFilesize: string, postMaxSize: string, extensions: array<string, bool>},
 *     database: array{type: string, version: string, prefix: string, charset: string, collate: string}
 * }
 */
final class StatusReport {
	// phpcs:enable WordPress.WP.CapitalPDangit.MisspelledInComment

	/**
	 * PHP extensions worth reporting. Add the ones your plugin depends on.
	 */
	public const EXTENSIONS = array( 'curl', 'mbstring', 'intl', 'json', 'openssl', 'zip', 'gd', 'imagick', 'opcache' );

	/**
	 * Constructor.
	 *
	 * @param Vite           $vite  Vite bridge (tells dev server from production build).
	 * @param ItemRepository $items Items repository.
	 */
	public function __construct(
		private Vite $vite,
		private ItemRepository $items
	) {}

	/**
	 * The full report.
	 *
	 * @return Report
	 */
	public function report(): array {
		$requires = $this->requirements();

		return array(
			'plugin'    => $this->plugin(),
			'wordpress' => $this->wordpress( $requires['wp'] ),
			'server'    => $this->server( $requires['php'] ),
			'database'  => $this->database(),
		);
	}

	/**
	 * Plugin section.
	 *
	 * @return array{version: string, dbVersion: string, dbVersionInstalled: string|null, assetMode: string, itemsTable: array{exists: bool, rows: int}}
	 */
	private function plugin(): array {
		$installed = get_option( Installer::OPTION );
		$exists    = $this->items->table_exists();

		return array(
			'version'            => WP_PLUGIN_STARTER_VERSION,
			'dbVersion'          => Installer::DB_VERSION,
			'dbVersionInstalled' => is_string( $installed ) ? $installed : null,
			'assetMode'          => null !== $this->vite->dev_server_url() ? 'dev' : 'build',
			'itemsTable'         => array(
				'exists' => $exists,
				'rows'   => $exists ? $this->items->count() : 0,
			),
		);
	}

	/**
	 * WordPress section.
	 *
	 * @param string $required Minimum WordPress version from the plugin header.
	 * @return array{version: string, requirement: Requirement, siteUrl: string, homeUrl: string, multisite: bool, locale: string, timezone: string, environment: string, debug: bool, memoryLimit: string, permalinks: string, theme: array{name: string, version: string}, activePlugins: int, cronDisabled: bool}
	 */
	private function wordpress( string $required ): array {
		$version = (string) get_bloginfo( 'version' );
		$theme   = wp_get_theme();

		return array(
			'version'       => $version,
			'requirement'   => $this->requirement( $version, $required ),
			'siteUrl'       => site_url(),
			'homeUrl'       => home_url(),
			'multisite'     => is_multisite(),
			'locale'        => get_locale(),
			'timezone'      => wp_timezone_string(),
			'environment'   => wp_get_environment_type(),
			'debug'         => defined( 'WP_DEBUG' ) && WP_DEBUG,
			'memoryLimit'   => defined( 'WP_MEMORY_LIMIT' ) ? (string) WP_MEMORY_LIMIT : '',
			'permalinks'    => (string) get_option( 'permalink_structure', '' ),
			'theme'         => array(
				'name'    => (string) $theme->get( 'Name' ),
				'version' => (string) $theme->get( 'Version' ),
			),
			'activePlugins' => count( (array) get_option( 'active_plugins', array() ) ),
			'cronDisabled'  => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON,
		);
	}

	/**
	 * Server & PHP section.
	 *
	 * @param string $required Minimum PHP version from the plugin header.
	 * @return array{phpVersion: string, requirement: Requirement, sapi: string, software: string, memoryLimit: string, maxExecutionTime: string, uploadMaxFilesize: string, postMaxSize: string, extensions: array<string, bool>}
	 */
	private function server( string $required ): array {
		$extensions = array();
		foreach ( self::EXTENSIONS as $extension ) {
			$extensions[ $extension ] = extension_loaded( 'opcache' === $extension ? 'Zend OPcache' : $extension );
		}

		$software = isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( (string) $_SERVER['SERVER_SOFTWARE'] ) ) : '';

		return array(
			'phpVersion'        => PHP_VERSION,
			'requirement'       => $this->requirement( PHP_VERSION, $required ),
			'sapi'              => PHP_SAPI,
			'software'          => $software,
			'memoryLimit'       => (string) ini_get( 'memory_limit' ),
			'maxExecutionTime'  => (string) ini_get( 'max_execution_time' ),
			'uploadMaxFilesize' => (string) ini_get( 'upload_max_filesize' ),
			'postMaxSize'       => (string) ini_get( 'post_max_size' ),
			'extensions'        => $extensions,
		);
	}

	/**
	 * Database section.
	 *
	 * @return array{type: string, version: string, prefix: string, charset: string, collate: string}
	 */
	private function database(): array {
		global $wpdb;

		$info = (string) $wpdb->db_server_info();

		return array(
			'type'    => false !== stripos( $info, 'mariadb' ) ? 'MariaDB' : 'MySQL',
			'version' => (string) $wpdb->db_version(),
			'prefix'  => (string) $wpdb->prefix,
			'charset' => (string) $wpdb->charset,
			'collate' => (string) $wpdb->collate,
		);
	}

	/**
	 * Minimum versions declared in the plugin header.
	 *
	 * @return array{wp: string, php: string}
	 */
	private function requirements(): array {
		$headers = get_file_data(
			WP_PLUGIN_STARTER_FILE,
			array(
				'wp'  => 'Requires at least',
				'php' => 'Requires PHP',
			)
		);

		return array(
			'wp'  => (string) ( $headers['wp'] ?? '' ),
			'php' => (string) ( $headers['php'] ?? '' ),
		);
	}

	/**
	 * Compare a version with a requirement. An empty requirement always passes.
	 *
	 * @param string $current  Running version.
	 * @param string $required Minimum version.
	 * @return Requirement
	 */
	private function requirement( string $current, string $required ): array {
		return array(
			'required' => $required,
			'ok'       => '' === $required || version_compare( $current, $required, '>=' ),
		);
	}
}
