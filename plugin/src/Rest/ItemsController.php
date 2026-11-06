<?php
/**
 * CRUD for /items
 *
 * @package WpPluginStarter
 */

declare( strict_types=1 );

namespace WpPluginStarter\Rest;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use WpPluginStarter\Items\ItemRepository;

defined( 'ABSPATH' ) || exit;

/**
 * Items endpoint — a complete example of a WordPress-style REST resource:
 * schema-driven args, context filtering, pagination headers and links.
 *
 * @phpstan-import-type ItemRow from ItemRepository
 */
final class ItemsController extends AbstractController {

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'items';

	/**
	 * Constructor.
	 *
	 * @param ItemRepository $items Repository.
	 */
	public function __construct( private ItemRepository $items ) {}

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
					'callback'            => array( $this, 'get_items' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => $this->get_collection_params(),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_item' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => $this->get_endpoint_args_for_item_schema( WP_REST_Server::CREATABLE ),
				),
				'schema' => array( $this, 'get_public_item_schema' ),
			)
		);

		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base . '/(?P<id>[\d]+)',
			array(
				'args'   => array(
					'id' => array(
						'description' => __( 'Unique identifier for the item.', 'wp-plugin-starter' ),
						'type'        => 'integer',
					),
				),
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_item' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => array( 'context' => $this->get_context_param( array( 'default' => 'view' ) ) ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_item' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => $this->get_endpoint_args_for_item_schema( WP_REST_Server::EDITABLE ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete_item' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
				'schema' => array( $this, 'get_public_item_schema' ),
			)
		);
	}

	/**
	 * GET /items
	 *
	 * @param WP_REST_Request $request Request.
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function get_items( $request ): WP_REST_Response {
		$per_page = (int) $request['per_page'];
		$result   = $this->items->paginate(
			array(
				'page'     => (int) $request['page'],
				'per_page' => $per_page,
				'search'   => (string) $request['search'],
				'status'   => (string) $request['status'],
				'orderby'  => (string) $request['orderby'],
				'order'    => (string) $request['order'],
			)
		);

		$data = array();
		foreach ( $result['items'] as $item ) {
			$data[] = $this->prepare_response_for_collection( $this->prepare_item_for_response( $item, $request ) );
		}

		$response = rest_ensure_response( $data );
		$response->header( 'X-WP-Total', (string) $result['total'] );
		$response->header( 'X-WP-TotalPages', (string) (int) ceil( $result['total'] / max( 1, $per_page ) ) );

		return $response;
	}

	/**
	 * GET /items/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function get_item( $request ) {
		$item = $this->items->find( (int) $request['id'] );

		return null === $item ? $this->not_found() : $this->prepare_item_for_response( $item, $request );
	}

	/**
	 * POST /items
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function create_item( $request ) {
		$id = $this->items->create(
			array(
				'title'   => (string) $request['title'],
				'content' => (string) $request['content'],
				'status'  => (string) $request['status'],
			)
		);

		if ( is_wp_error( $id ) ) {
			return $id;
		}

		$item = $this->items->find( $id );
		if ( null === $item ) {
			return $this->not_found();
		}

		$response = $this->prepare_item_for_response( $item, $request );
		$response->set_status( 201 );
		$response->header( 'Location', rest_url( sprintf( '%s/%s/%d', $this->namespace, $this->rest_base, $id ) ) );

		return $response;
	}

	/**
	 * PUT/PATCH /items/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function update_item( $request ) {
		$id = (int) $request['id'];
		if ( null === $this->items->find( $id ) ) {
			return $this->not_found();
		}

		$changes = array();
		foreach ( array( 'title', 'content', 'status' ) as $field ) {
			if ( $request->has_param( $field ) ) {
				$changes[ $field ] = (string) $request->get_param( $field );
			}
		}

		$result = $this->items->update( $id, $changes );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$item = $this->items->find( $id );

		return null === $item ? $this->not_found() : $this->prepare_item_for_response( $item, $request );
	}

	/**
	 * DELETE /items/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function delete_item( $request ) {
		$id   = (int) $request['id'];
		$item = $this->items->find( $id );
		if ( null === $item ) {
			return $this->not_found();
		}

		$previous = $this->prepare_item_for_response( $item, $request )->get_data();

		if ( ! $this->items->delete( $id ) ) {
			return new WP_Error( 'wp_plugin_starter_cannot_delete', __( 'The item could not be deleted.', 'wp-plugin-starter' ), array( 'status' => 500 ) );
		}

		return rest_ensure_response(
			array(
				'deleted'  => true,
				'previous' => $previous,
			)
		);
	}

	/**
	 * Map a repository row to the public API shape (camelCase, ISO 8601 dates).
	 *
	 * @param mixed           $item    Item row (ItemRow) from the repository.
	 * @param WP_REST_Request $request Request.
	 *
	 * @phpstan-param WP_REST_Request<array<string, mixed>> $request
	 */
	public function prepare_item_for_response( $item, $request ): WP_REST_Response {
		/**
		 * Rows come from ItemRepository::hydrate().
		 *
		 * @var ItemRow $item
		 */
		$data = array(
			'id'        => $item['id'],
			'title'     => $item['title'],
			'content'   => $item['content'],
			'status'    => $item['status'],
			'authorId'  => $item['author_id'],
			'createdAt' => mysql_to_rfc3339( $item['created_at'] ) . 'Z',
			'updatedAt' => mysql_to_rfc3339( $item['updated_at'] ) . 'Z',
		);

		$context  = ! empty( $request['context'] ) ? (string) $request['context'] : 'view';
		$data     = $this->add_additional_fields_to_object( $data, $request );
		$data     = $this->filter_response_by_context( $data, $context );
		$response = rest_ensure_response( $data );

		$response->add_links(
			array(
				'self'       => array( 'href' => rest_url( sprintf( '%s/%s/%d', $this->namespace, $this->rest_base, $item['id'] ) ) ),
				'collection' => array( 'href' => rest_url( sprintf( '%s/%s', $this->namespace, $this->rest_base ) ) ),
			)
		);

		return $response;
	}

	/**
	 * Item schema.
	 *
	 * @return array<string, mixed>
	 */
	public function get_item_schema(): array {
		if ( $this->schema ) {
			return $this->add_additional_fields_schema( $this->schema );
		}

		$this->schema = array(
			'$schema'    => 'http://json-schema.org/draft-04/schema#',
			'title'      => 'wp-plugin-starter-item',
			'type'       => 'object',
			'properties' => array(
				'id'        => array(
					'description' => __( 'Unique identifier.', 'wp-plugin-starter' ),
					'type'        => 'integer',
					'context'     => array( 'view', 'edit' ),
					'readonly'    => true,
				),
				'title'     => array(
					'description' => __( 'Item title.', 'wp-plugin-starter' ),
					'type'        => 'string',
					'minLength'   => 1,
					'maxLength'   => 191,
					'required'    => true,
					'context'     => array( 'view', 'edit' ),
					'arg_options' => array( 'sanitize_callback' => 'sanitize_text_field' ),
				),
				'content'   => array(
					'description' => __( 'Item content (limited HTML allowed).', 'wp-plugin-starter' ),
					'type'        => 'string',
					'default'     => '',
					'context'     => array( 'view', 'edit' ),
					'arg_options' => array( 'sanitize_callback' => 'wp_kses_post' ),
				),
				'status'    => array(
					'description' => __( 'Publication status.', 'wp-plugin-starter' ),
					'type'        => 'string',
					'enum'        => ItemRepository::STATUSES,
					'default'     => 'draft',
					'context'     => array( 'view', 'edit' ),
				),
				'authorId'  => array(
					'description' => __( 'ID of the user who created the item.', 'wp-plugin-starter' ),
					'type'        => 'integer',
					'context'     => array( 'view', 'edit' ),
					'readonly'    => true,
				),
				'createdAt' => array(
					'description' => __( 'Creation date (UTC, ISO 8601).', 'wp-plugin-starter' ),
					'type'        => 'string',
					'format'      => 'date-time',
					'context'     => array( 'view', 'edit' ),
					'readonly'    => true,
				),
				'updatedAt' => array(
					'description' => __( 'Last update date (UTC, ISO 8601).', 'wp-plugin-starter' ),
					'type'        => 'string',
					'format'      => 'date-time',
					'context'     => array( 'view', 'edit' ),
					'readonly'    => true,
				),
			),
		);

		return $this->add_additional_fields_schema( $this->schema );
	}

	/**
	 * Query params for the collection.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public function get_collection_params(): array {
		$params = parent::get_collection_params();

		$params['status']  = array(
			'description' => __( 'Limit results to a status.', 'wp-plugin-starter' ),
			'type'        => 'string',
			'enum'        => ItemRepository::STATUSES,
		);
		$params['orderby'] = array(
			'description' => __( 'Sort collection by attribute.', 'wp-plugin-starter' ),
			'type'        => 'string',
			'enum'        => ItemRepository::ORDERABLE,
			'default'     => 'created_at',
		);
		$params['order']   = array(
			'description' => __( 'Sort direction.', 'wp-plugin-starter' ),
			'type'        => 'string',
			'enum'        => array( 'asc', 'desc' ),
			'default'     => 'desc',
		);

		return $params;
	}

	/**
	 * Standard 404 error.
	 */
	private function not_found(): WP_Error {
		return new WP_Error( 'rest_not_found', __( 'Item not found.', 'wp-plugin-starter' ), array( 'status' => 404 ) );
	}
}
