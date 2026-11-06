<?php
/**
 * Base REST controller: shared namespace + permission checks.
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Rest;

use WP_Error;
use WP_REST_Controller;
use WP_REST_Request;
use WpPluginStarter\Plugin;

defined( 'ABSPATH' ) || exit;

/**
 * All plugin endpoints live under /wp-json/wp-plugin-starter/v1.
 */
abstract class AbstractController extends WP_REST_Controller {

	public const API_NAMESPACE = 'wp-plugin-starter/v1';

	/**
	 * Route namespace.
	 *
	 * @var string
	 */
	protected $namespace = self::API_NAMESPACE;

	/**
	 * Default permission check. Cookie auth + the `wp_rest` nonce (sent by
	 * the React app as X-WP-Nonce) establish the current user.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function check_permission( WP_REST_Request $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		if ( current_user_can( Plugin::capability() ) ) {
			return true;
		}

		return new WP_Error(
			'rest_forbidden',
			__( 'Sorry, you are not allowed to do that.', 'wp-plugin-starter' ),
			array( 'status' => rest_authorization_required_code() )
		);
	}
}
