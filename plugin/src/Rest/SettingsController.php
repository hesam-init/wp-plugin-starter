<?php
/**
 * GET/PATCH /settings
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Rest;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use WpPluginStarter\Settings\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Settings endpoint.
 */
final class SettingsController extends AbstractController {

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'settings';

	/**
	 * Constructor.
	 *
	 * @param Settings $settings Settings service.
	 */
	public function __construct( private Settings $settings ) {}

	/**
	 * Register routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_item' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_item' ),
					'permission_callback' => array( $this, 'check_permission' ),
					// Validation + sanitization comes for free from the schema.
					'args'                => $this->get_endpoint_args_for_item_schema( WP_REST_Server::EDITABLE ),
				),
				'schema' => array( $this, 'get_public_item_schema' ),
			)
		);
	}

	/**
	 * GET /settings
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function get_item( $request ): WP_REST_Response { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		return rest_ensure_response( $this->settings->all() );
	}

	/**
	 * PATCH /settings — only keys present in the body are changed.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function update_item( $request ) {
		$changes = array();
		foreach ( array_keys( Settings::schema() ) as $key ) {
			if ( $request->has_param( $key ) ) {
				$changes[ $key ] = $request->get_param( $key );
			}
		}

		$result = $this->settings->update( $changes );

		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/**
	 * JSON schema for the settings resource.
	 *
	 * @return array<string, mixed>
	 */
	public function get_item_schema(): array {
		if ( $this->schema ) {
			return $this->add_additional_fields_schema( $this->schema );
		}

		$this->schema = array(
			'$schema'    => 'http://json-schema.org/draft-04/schema#',
			'title'      => 'wp-plugin-starter-settings',
			'type'       => 'object',
			'properties' => Settings::schema(),
		);

		return $this->add_additional_fields_schema( $this->schema );
	}
}
