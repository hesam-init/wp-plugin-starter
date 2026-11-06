<?php
/**
 * Registers all REST controllers.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Rest;

defined( 'ABSPATH' ) || exit;

/**
 * Add a controller here and it gets its routes registered on rest_api_init.
 */
final class RestApi {

	/**
	 * Controllers to register.
	 *
	 * @var list<AbstractController>
	 */
	private array $controllers;

	/**
	 * Constructor.
	 *
	 * @param AbstractController ...$controllers Controllers.
	 */
	public function __construct( AbstractController ...$controllers ) {
		$this->controllers = array_values( $controllers );
	}

	/**
	 * Hook into WordPress.
	 */
	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register every controller's routes.
	 */
	public function register_routes(): void {
		foreach ( $this->controllers as $controller ) {
			$controller->register_routes();
		}
	}
}
