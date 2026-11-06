<?php
/**
 * Registers the admin menu page that hosts the React app.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Admin;

use WpPluginStarter\Plugin;

defined( 'ABSPATH' ) || exit;

/**
 * Admin page.
 */
final class AdminPage {

	public const MENU_SLUG   = 'wp-plugin-starter';
	public const STATUS_SLUG = 'wp-plugin-starter-status';
	public const ROOT_ID     = 'wp-plugin-starter-root';

	/**
	 * Hook suffix of each of our pages → screen name passed to the React app.
	 *
	 * @var array<string, string>
	 */
	private array $screens = array();

	/**
	 * Whether the build was found.
	 *
	 * @var bool
	 */
	private bool $assets_ready = true;

	/**
	 * Constructor.
	 *
	 * @param Assets $assets Asset loader.
	 */
	public function __construct( private Assets $assets ) {}

	/**
	 * Hook into WordPress.
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( WP_PLUGIN_STARTER_FILE ), array( $this, 'action_links' ) );
	}

	/**
	 * Add the top-level menu page and its submenus.
	 */
	public function add_menu(): void {
		$capability = Plugin::capability();

		$main = (string) add_menu_page(
			Plugin::NAME, // Brand names usually stay untranslated.
			Plugin::NAME,
			$capability,
			self::MENU_SLUG,
			array( $this, 'render' ),
			'dashicons-admin-generic',
			80
		);

		// Same slug as the parent: renames the auto-generated first submenu entry.
		add_submenu_page(
			self::MENU_SLUG,
			Plugin::NAME,
			__( 'Dashboard', 'wp-plugin-starter' ),
			$capability,
			self::MENU_SLUG,
			array( $this, 'render' )
		);

		$status = (string) add_submenu_page(
			self::MENU_SLUG,
			__( 'Status', 'wp-plugin-starter' ),
			__( 'Status', 'wp-plugin-starter' ),
			$capability,
			self::STATUS_SLUG,
			array( $this, 'render' )
		);

		$this->screens = array_filter(
			array(
				$main   => 'main',
				$status => 'status',
			),
			static fn ( $hook ): bool => '' !== $hook,
			ARRAY_FILTER_USE_KEY
		);

		// Only load assets on our own screens.
		foreach ( array_keys( $this->screens ) as $hook_suffix ) {
			add_action( 'load-' . $hook_suffix, array( $this, 'on_load' ) );
		}
	}

	/**
	 * Fires before one of our screens renders.
	 */
	public function on_load(): void {
		add_action(
			'admin_enqueue_scripts',
			function ( string $hook ): void {
				if ( isset( $this->screens[ $hook ] ) ) {
					$this->assets_ready = $this->assets->enqueue( $this->screens[ $hook ] );
				}
			}
		);
	}

	/**
	 * Mount point for React.
	 */
	public function render(): void {
		if ( ! $this->assets_ready ) {
			printf(
				'<div class="wrap"><div class="notice notice-error"><p>%s</p></div></div>',
				esc_html__( 'Admin assets are missing. Run "make dev" (development) or "make build" (production).', 'wp-plugin-starter' )
			);
			return;
		}

		printf( '<div class="wrap"><div id="%s"></div></div>', esc_attr( self::ROOT_ID ) );
	}

	/**
	 * Add a "Settings" link on the Plugins screen.
	 *
	 * @param array<int|string, string> $links Existing links.
	 * @return array<int|string, string>
	 */
	public function action_links( array $links ): array {
		$url = admin_url( 'admin.php?page=' . self::MENU_SLUG );
		array_unshift( $links, sprintf( '<a href="%s">%s</a>', esc_url( $url ), esc_html__( 'Settings', 'wp-plugin-starter' ) ) );

		return $links;
	}
}
