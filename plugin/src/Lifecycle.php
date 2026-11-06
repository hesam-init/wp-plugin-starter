<?php
/**
 * Activation / deactivation handlers.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter;

use WpPluginStarter\Database\Installer;
use WpPluginStarter\Settings\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Plugin lifecycle hooks. Uninstall lives in /uninstall.php.
 */
final class Lifecycle {

	/**
	 * Runs on activation. Handles network activation on multisite.
	 *
	 * @param bool $network_wide Whether the plugin is being network-activated.
	 */
	public static function activate( bool $network_wide = false ): void {
		if ( is_multisite() && $network_wide ) {
			foreach ( get_sites( array( 'fields' => 'ids' ) ) as $site_id ) {
				switch_to_blog( (int) $site_id );
				self::activate_site();
				restore_current_blog();
			}
			return;
		}
		self::activate_site();
	}

	/**
	 * Runs on deactivation. Keep data; only clean up transient state here.
	 */
	public static function deactivate(): void {
		// e.g. wp_clear_scheduled_hook( 'wp_plugin_starter_cron' );
	}

	/**
	 * Per-site activation: create tables and default options.
	 */
	private static function activate_site(): void {
		( new Installer() )->install();
		add_option( Settings::OPTION, Settings::defaults() );
	}
}
