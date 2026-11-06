<?php
/**
 * Composition root: wires every service together and registers hooks.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter;

use WpPluginStarter\Admin\AdminPage;
use WpPluginStarter\Admin\Assets;
use WpPluginStarter\Database\Installer;
use WpPluginStarter\Items\ItemRepository;
use WpPluginStarter\Rest\ItemsController;
use WpPluginStarter\Rest\RestApi;
use WpPluginStarter\Rest\SettingsController;
use WpPluginStarter\Rest\StatusController;
use WpPluginStarter\Settings\Settings;
use WpPluginStarter\Status\StatusReport;
use WpPluginStarter\Support\Vite;

defined( 'ABSPATH' ) || exit;

/**
 * Main plugin class.
 */
final class Plugin {

	public const NAME        = 'WP Plugin Starter';
	public const SLUG        = 'wp-plugin-starter';
	public const TEXT_DOMAIN = 'wp-plugin-starter';

	/**
	 * Singleton guard — boot() is idempotent.
	 *
	 * @var Plugin|null
	 */
	private static ?Plugin $instance = null;

	/**
	 * Entry point, hooked on `plugins_loaded`.
	 */
	public static function boot(): void {
		if ( null !== self::$instance ) {
			return;
		}
		self::$instance = new self();
		self::$instance->register();
	}

	/**
	 * Capability required to use the plugin UI and REST API. Filterable.
	 */
	public static function capability(): string {
		/**
		 * Filters the capability required to manage the plugin.
		 *
		 * @param string $capability Default 'manage_options'.
		 */
		return (string) apply_filters( 'wp_plugin_starter_capability', 'manage_options' );
	}

	/**
	 * Wire services and hooks.
	 */
	private function register(): void {
		( new Installer() )->maybe_upgrade();

		add_action( 'init', array( $this, 'load_textdomain' ) );

		$settings = new Settings();
		$items    = new ItemRepository();
		$vite     = new Vite( WP_PLUGIN_STARTER_DIR . 'assets/dist/', WP_PLUGIN_STARTER_URL . 'assets/dist/' );

		( new RestApi(
			new SettingsController( $settings ),
			new ItemsController( $items ),
			new StatusController( new StatusReport( $vite, $items ) )
		) )->register();

		if ( is_admin() ) {
			( new AdminPage( new Assets( $vite ) ) )->register();
		}
	}

	/**
	 * Load translations from /languages.
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain( self::TEXT_DOMAIN, false, dirname( plugin_basename( WP_PLUGIN_STARTER_FILE ) ) . '/languages' );
	}
}
