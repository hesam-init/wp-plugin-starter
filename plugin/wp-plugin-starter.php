<?php
/**
 * Plugin Name:       WP Plugin Starter
 * Plugin URI:        https://example.com/wp-plugin-starter
 * Description:       A modern WordPress plugin starter built with React, TypeScript and Vite.
 * Version:           0.1.0
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            Your Name
 * Author URI:        https://example.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-plugin-starter
 * Domain Path:       /languages
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter;

defined( 'ABSPATH' ) || exit;

define( 'WP_PLUGIN_STARTER_VERSION', '0.1.0' );
define( 'WP_PLUGIN_STARTER_FILE', __FILE__ );
define( 'WP_PLUGIN_STARTER_DIR', plugin_dir_path( __FILE__ ) );
define( 'WP_PLUGIN_STARTER_URL', plugin_dir_url( __FILE__ ) );

// Bail early (with a notice) on unsupported PHP instead of fatal-erroring.
if ( version_compare( PHP_VERSION, '8.1', '<' ) ) {
	add_action(
		'admin_notices',
		static function (): void {
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html(
					sprintf(
						/* translators: 1: plugin name, 2: required PHP version. */
						__( '%1$s requires PHP %2$s or newer.', 'wp-plugin-starter' ),
						'WP Plugin Starter',
						'8.1'
					)
				)
			);
		}
	);
	return;
}

if ( is_readable( __DIR__ . '/vendor/autoload.php' ) ) {
	require_once __DIR__ . '/vendor/autoload.php';
} else {
	// Fallback PSR-4 autoloader so the plugin also runs before `composer install`.
	spl_autoload_register(
		static function ( string $class_name ): void {
			$prefix = __NAMESPACE__ . '\\';
			if ( ! str_starts_with( $class_name, $prefix ) ) {
				return;
			}
			$relative = str_replace( '\\', '/', substr( $class_name, strlen( $prefix ) ) );
			$file     = __DIR__ . '/src/' . $relative . '.php';
			if ( is_readable( $file ) ) {
				require_once $file;
			}
		}
	);
}

register_activation_hook( __FILE__, array( Lifecycle::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( Lifecycle::class, 'deactivate' ) );

add_action( 'plugins_loaded', array( Plugin::class, 'boot' ) );
