<?php
/**
 * GET /status
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Rest;

use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use WpPluginStarter\Status\StatusReport;

defined( 'ABSPATH' ) || exit;

/**
 * Read-only environment report for the Status screen.
 */
final class StatusController extends AbstractController {

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'status';

	/**
	 * Constructor.
	 *
	 * @param StatusReport $report Report builder.
	 */
	public function __construct( private StatusReport $report ) {}

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
				'schema' => array( $this, 'get_public_item_schema' ),
			)
		);
	}

	/**
	 * GET /status
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function get_item( $request ): WP_REST_Response { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		return rest_ensure_response( $this->report->report() );
	}

	/**
	 * JSON schema for the status report. Mirrored by StatusSchema in
	 * admin-client/src/api/schemas.ts.
	 *
	 * @return array<string, mixed>
	 */
	public function get_item_schema(): array {
		if ( $this->schema ) {
			return $this->add_additional_fields_schema( $this->schema );
		}

		$string      = array( 'type' => 'string' );
		$boolean     = array( 'type' => 'boolean' );
		$integer     = array( 'type' => 'integer' );
		$requirement = self::object(
			array(
				'required' => $string,
				'ok'       => $boolean,
			)
		);

		$this->schema = array(
			'$schema'    => 'http://json-schema.org/draft-04/schema#',
			'title'      => 'wp-plugin-starter-status',
			'type'       => 'object',
			'readonly'   => true,
			'properties' => array(
				'plugin'    => self::object(
					array(
						'version'            => $string,
						'dbVersion'          => $string,
						'dbVersionInstalled' => array( 'type' => array( 'string', 'null' ) ),
						'assetMode'          => array(
							'type' => 'string',
							'enum' => array( 'dev', 'build' ),
						),
						'itemsTable'         => self::object(
							array(
								'exists' => $boolean,
								'rows'   => $integer,
							)
						),
					),
					__( 'This plugin.', 'wp-plugin-starter' )
				),
				'wordpress' => self::object(
					array(
						'version'       => $string,
						'requirement'   => $requirement,
						'siteUrl'       => $string,
						'homeUrl'       => $string,
						'multisite'     => $boolean,
						'locale'        => $string,
						'timezone'      => $string,
						'environment'   => $string,
						'debug'         => $boolean,
						'memoryLimit'   => $string,
						'permalinks'    => $string,
						'theme'         => self::object(
							array(
								'name'    => $string,
								'version' => $string,
							)
						),
						'activePlugins' => $integer,
						'cronDisabled'  => $boolean,
					),
					__( 'WordPress installation.', 'wp-plugin-starter' )
				),
				'server'    => self::object(
					array(
						'phpVersion'        => $string,
						'requirement'       => $requirement,
						'sapi'              => $string,
						'software'          => $string,
						'memoryLimit'       => $string,
						'maxExecutionTime'  => $string,
						'uploadMaxFilesize' => $string,
						'postMaxSize'       => $string,
						'extensions'        => array(
							'type'                 => 'object',
							'additionalProperties' => $boolean,
						),
					),
					__( 'Web server and PHP.', 'wp-plugin-starter' )
				),
				'database'  => self::object(
					array(
						'type'    => array(
							'type' => 'string',
							'enum' => array( 'MySQL', 'MariaDB' ),
						),
						'version' => $string,
						'prefix'  => $string,
						'charset' => $string,
						'collate' => $string,
					),
					__( 'Database server.', 'wp-plugin-starter' )
				),
			),
		);

		return $this->add_additional_fields_schema( $this->schema );
	}

	/**
	 * Read-only object schema.
	 *
	 * @param array<string, array<string, mixed>> $properties  Property schemas.
	 * @param string                              $description Optional description.
	 * @return array<string, mixed>
	 */
	private static function object( array $properties, string $description = '' ): array {
		$schema = array(
			'type'       => 'object',
			'context'    => array( 'view' ),
			'readonly'   => true,
			'properties' => $properties,
		);
		if ( '' !== $description ) {
			$schema['description'] = $description;
		}

		return $schema;
	}
}
